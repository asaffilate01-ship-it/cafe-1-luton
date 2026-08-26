ALTER TABLE public.till_shifts
  DROP CONSTRAINT IF EXISTS till_shifts_terminal_check;

ALTER TABLE public.till_shifts
  ADD CONSTRAINT till_shifts_terminal_check
  CHECK (terminal IN ('jury', 'judge', 'public', 'futures_public'));

CREATE OR REPLACE FUNCTION public.open_till_shift(
  _terminal text,
  _opening_float_cents integer
)
RETURNS public.till_shifts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  opened public.till_shifts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _terminal NOT IN ('jury', 'judge', 'public', 'futures_public') THEN
    RAISE EXCEPTION 'Invalid terminal';
  END IF;
  IF _opening_float_cents < 0 OR _opening_float_cents > 1000000 THEN
    RAISE EXCEPTION 'Invalid opening float';
  END IF;

  INSERT INTO public.till_shifts (terminal, staff_id, opening_float_cents)
  VALUES (_terminal, auth.uid(), _opening_float_cents)
  RETURNING * INTO opened;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, terminal, detail)
  VALUES (
    auth.uid(), 'till.shift.open', 'till_shift', opened.id, _terminal,
    jsonb_build_object('opening_float_cents', _opening_float_cents)
  );
  RETURN opened;
END $$;

CREATE OR REPLACE FUNCTION public.prepare_counter_order(
  _idempotency_key uuid,
  _shift_id uuid,
  _customer_name text,
  _order_type text,
  _table_number text,
  _terminal text,
  _voucher_code text,
  _payment_mode text,
  _manual_card_reference text,
  _items jsonb,
  _manual_discount_type text DEFAULT NULL,
  _manual_discount_value integer DEFAULT 0,
  _manual_discount_reason text DEFAULT NULL
)
RETURNS TABLE(
  order_id uuid,
  order_number integer,
  total_cents integer,
  subtotal_cents integer,
  voucher_cents integer,
  voucher_code text,
  juror_discount_cents integer,
  payment_status public.payment_status
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  existing public.orders%ROWTYPE;
  shift_row public.till_shifts%ROWTYPE;
  created public.orders%ROWTYPE;
  item jsonb;
  menu public.menu_items%ROWTYPE;
  modifier_total integer;
  modifier_count integer;
  requested_modifier_count integer;
  unit_cents integer;
  subtotal integer := 0;
  food_subtotal integer := 0;
  redeemed integer := 0;
  juror_discount integer := 0;
  manual_discount integer := 0;
  payable integer := 0;
  holder_id uuid;
  canonical_voucher_code text;
  voucher_status text;
  final_method text;
  settled boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')
  ) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT * INTO existing FROM public.orders WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN
    RETURN QUERY SELECT existing.id, existing.order_number, existing.total_cents,
      existing.subtotal_cents, existing.voucher_cents, canonical_voucher_code,
      existing.juror_discount_cents, existing.payment_status;
    RETURN;
  END IF;

  SELECT * INTO shift_row FROM public.till_shifts
  WHERE id = _shift_id AND closed_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT (
    public.has_role(auth.uid(), 'admin') OR shift_row.staff_id = auth.uid()
  ) THEN RAISE EXCEPTION 'An open shift for this terminal is required'; END IF;

  IF _order_type NOT IN ('dine_in', 'collection') THEN
    RAISE EXCEPTION 'Counter delivery orders require a full delivery address';
  END IF;
  IF _terminal NOT IN ('jury', 'judge', 'public', 'futures_public') THEN RAISE EXCEPTION 'Invalid terminal'; END IF;
  IF _payment_mode NOT IN ('reader', 'cash', 'manual') THEN RAISE EXCEPTION 'Invalid payment mode'; END IF;
  IF _payment_mode = 'manual' AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Manager approval required for a manual card payment';
  END IF;
  IF _payment_mode = 'manual' AND length(trim(COALESCE(_manual_card_reference, ''))) < 4 THEN
    RAISE EXCEPTION 'Card terminal receipt reference is required';
  END IF;
  IF NULLIF(trim(COALESCE(_manual_discount_type, '')), '') IS NOT NULL THEN
    IF _manual_discount_type NOT IN ('percent', 'fixed_amount') THEN
      RAISE EXCEPTION 'Invalid manual discount type';
    END IF;
    IF COALESCE(_manual_discount_value, 0) <= 0 THEN
      RAISE EXCEPTION 'Enter a manual discount amount';
    END IF;
    IF _manual_discount_type = 'percent' AND _manual_discount_value > 100 THEN
      RAISE EXCEPTION 'A manual discount cannot exceed 100 percent';
    END IF;
    IF length(trim(COALESCE(_manual_discount_reason, ''))) < 3 THEN
      RAISE EXCEPTION 'A reason is required for a manual discount';
    END IF;
  END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) < 1
    OR jsonb_array_length(_items) > 60 THEN
    RAISE EXCEPTION 'Order must contain 1 to 60 lines';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(_items)
  LOOP
    SELECT * INTO menu FROM public.menu_items
      WHERE id = (item->>'menu_item_id')::uuid AND active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'An item is unavailable'; END IF;
    IF COALESCE((item->>'qty')::integer, 0) < 1 OR (item->>'qty')::integer > 50 THEN
      RAISE EXCEPTION 'Invalid item quantity';
    END IF;

    requested_modifier_count := COALESCE(jsonb_array_length(COALESCE(item->'modifier_ids', '[]'::jsonb)), 0);
    SELECT COALESCE(SUM(mm.price_cents), 0)::integer, COUNT(*)::integer
      INTO modifier_total, modifier_count
    FROM public.menu_modifiers mm
    WHERE mm.active = true
      AND mm.id IN (
        SELECT jsonb_array_elements_text(COALESCE(item->'modifier_ids', '[]'::jsonb))::uuid
      )
      AND (mm.item_id = menu.id OR (mm.item_id IS NULL AND mm.category_id = menu.category_id));
    IF modifier_count <> requested_modifier_count THEN
      RAISE EXCEPTION 'An add-on is unavailable for this item';
    END IF;

    unit_cents := menu.price_cents + modifier_total;
    subtotal := subtotal + unit_cents * (item->>'qty')::integer;
    IF NOT menu.is_beverage THEN
      food_subtotal := food_subtotal + unit_cents * (item->>'qty')::integer;
    END IF;
  END LOOP;

  INSERT INTO public.orders (
    idempotency_key, till_shift_id, customer_name, customer_phone, type, table_number,
    subtotal_cents, delivery_fee_cents, discount_cents, juror_discount_cents,
    voucher_cents, total_cents, status, payment_status, payment_method,
    pos_terminal, source, schedule_mode
  ) VALUES (
    _idempotency_key, _shift_id, COALESCE(NULLIF(trim(_customer_name), ''), 'Counter'), '',
    _order_type::public.order_type,
    CASE WHEN _order_type = 'dine_in' THEN NULLIF(trim(_table_number), '') ELSE NULL END,
    subtotal, 0, 0, 0, 0, subtotal, 'pending', 'unpaid',
    CASE WHEN _payment_mode = 'cash' THEN 'cash' WHEN _payment_mode = 'manual' THEN 'sumup' ELSE NULL END,
    _terminal, 'counter', 'asap'
  ) RETURNING * INTO created;

  IF NULLIF(trim(COALESCE(_voucher_code, '')), '') IS NOT NULL THEN
    SELECT vh.id, vh.code, vh.status::text
      INTO holder_id, canonical_voucher_code, voucher_status
    FROM public.voucher_holders vh
    WHERE upper(vh.code) = upper(trim(_voucher_code)) FOR UPDATE;
    IF NOT FOUND OR voucher_status <> 'active' THEN RAISE EXCEPTION 'Voucher is not valid'; END IF;

    SELECT COALESCE(SUM(vr.redeemed_cents), 0)::integer INTO redeemed
    FROM public.voucher_redemptions vr WHERE vr.holder_id = holder_id;
    juror_discount := LEAST(
      GREATEST(0, 1200 - redeemed),
      LEAST(food_subtotal, subtotal)
    );
    IF juror_discount <= 0 THEN RAISE EXCEPTION 'Voucher has no remaining value'; END IF;

    INSERT INTO public.voucher_redemptions (holder_id, order_id, redeemed_cents)
    VALUES (holder_id, created.id, juror_discount);
  END IF;

  IF NULLIF(trim(COALESCE(_manual_discount_type, '')), '') IS NOT NULL THEN
    manual_discount := CASE
      WHEN _manual_discount_type = 'percent'
        THEN LEAST(subtotal - juror_discount, floor((subtotal - juror_discount) * _manual_discount_value / 100.0)::integer)
      ELSE LEAST(subtotal - juror_discount, _manual_discount_value)
    END;
  END IF;

  payable := GREATEST(0, subtotal - juror_discount - manual_discount);
  settled := _payment_mode IN ('cash', 'manual');
  final_method := CASE WHEN _payment_mode = 'cash' THEN 'cash' WHEN _payment_mode = 'manual' THEN 'sumup' ELSE NULL END;

  UPDATE public.orders SET
    juror_discount_cents = juror_discount,
    discount_cents = manual_discount,
    total_cents = payable,
    payment_status = CASE WHEN settled THEN 'paid'::public.payment_status ELSE 'unpaid'::public.payment_status END,
    payment_method = final_method,
    status = CASE WHEN settled THEN 'confirmed'::public.order_status ELSE 'pending'::public.order_status END
  WHERE id = created.id RETURNING * INTO created;

  IF settled THEN
    INSERT INTO public.order_payments (order_id, provider, provider_reference, amount_cents, status, raw)
    VALUES (
      created.id,
      CASE WHEN _payment_mode = 'cash' THEN 'cash' ELSE 'sumup' END,
      CASE WHEN _payment_mode = 'cash' THEN 'till-' || created.id::text ELSE trim(_manual_card_reference) END,
      payable,
      'paid',
      jsonb_build_object(
        'terminal', _terminal,
        'shift_id', _shift_id,
        'manual_discount_type', _manual_discount_type,
        'manual_discount_value', _manual_discount_value,
        'manual_discount_reason', _manual_discount_reason
      )
    );
  END IF;

  IF _payment_mode = 'cash' THEN
    INSERT INTO public.till_cash_events (shift_id, staff_id, event_type, amount_cents, reason)
    VALUES (_shift_id, auth.uid(), 'sale', payable, 'Order #' || created.order_number::text);
  END IF;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, terminal, detail)
  VALUES (
    auth.uid(), 'order.counter.prepare', 'order', created.id, _terminal,
    jsonb_build_object(
      'order_number', created.order_number,
      'payment_mode', _payment_mode,
      'manual_card_reference', NULLIF(trim(COALESCE(_manual_card_reference, '')), ''),
      'manual_discount_type', _manual_discount_type,
      'manual_discount_value', _manual_discount_value,
      'manual_discount_reason', _manual_discount_reason,
      'total_cents', payable
    )
  );

  RETURN QUERY SELECT created.id, created.order_number, created.total_cents,
    created.subtotal_cents, created.voucher_cents, canonical_voucher_code,
    created.juror_discount_cents, created.payment_status;
END $fn$;

REVOKE ALL ON FUNCTION public.open_till_shift(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_till_shift(text, integer) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.prepare_counter_order(uuid, uuid, text, text, text, text, text, text, text, jsonb, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_counter_order(uuid, uuid, text, text, text, text, text, text, text, jsonb, text, integer, text) TO authenticated, service_role;