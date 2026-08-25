-- Fix: prepare_counter_order rejected orders with "An open shift for this
-- terminal is required" whenever the order's routing terminal (jury/judge,
-- used to tag the order for KDS/print routing) differed from the terminal
-- the physical till shift was opened under. Crown Court sites open a single
-- shift under terminal = 'public' (one physical till per branch) but route
-- individual orders to 'jury' or 'judge' via _terminal, so the old
-- `terminal = _terminal` predicate on till_shifts could never match and the
-- shift lookup always failed for those orders.
--
-- Fix: validate the shift by id/staff ownership/open status only. _terminal
-- keeps being used purely for order routing, validity checks, and auditing,
-- decoupled from which physical till the shift was opened on.

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

  -- Validate by shift id + open status only. The order's _terminal is a
  -- routing/audit tag (jury/judge/public) and may legitimately differ from
  -- the terminal the physical till shift was opened under (one shift can
  -- serve orders routed to several sides at a Crown Court site).
  SELECT * INTO shift_row FROM public.till_shifts
  WHERE id = _shift_id AND closed_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT (
    public.has_role(auth.uid(), 'admin') OR shift_row.staff_id = auth.uid()
  ) THEN RAISE EXCEPTION 'An open shift for this terminal is required'; END IF;

  IF _order_type NOT IN ('dine_in', 'collection') THEN
    RAISE EXCEPTION 'Counter delivery orders require a full delivery address';
  END IF;
  IF _terminal NOT IN ('jury', 'judge', 'public') THEN RAISE EXCEPTION 'Invalid terminal'; END IF;
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
    subtotal, 0, 0, 0, 0, subtotal, 'pending_payment', 'pending',
    CASE WHEN _payment_mode = 'cash' THEN 'cash' ELSE 'card' END,
    _terminal, 'counter', 'asap'
  ) RETURNING * INTO created;

  IF NULLIF(trim(_voucher_code), '') IS NOT NULL THEN
    SELECT v.holder_id, v.code, v.status
      INTO holder_id, canonical_voucher_code, voucher_status
    FROM public.get_voucher_balance_by_code(trim(_voucher_code)) v LIMIT 1;
    IF holder_id IS NULL THEN RAISE EXCEPTION 'That voucher code is not recognised'; END IF;
    IF voucher_status <> 'ok' THEN RAISE EXCEPTION 'That voucher cannot be used today'; END IF;
    redeemed := public.redeem_voucher(holder_id, created.id, subtotal);
  END IF;

  payable := GREATEST(subtotal - redeemed, 0);
  IF holder_id IS NOT NULL AND payable > 0 AND food_subtotal > 0 THEN
    juror_discount := ROUND(LEAST(food_subtotal, payable) * 0.10)::integer;
    payable := GREATEST(payable - juror_discount, 0);
  END IF;

  IF NULLIF(trim(COALESCE(_manual_discount_type, '')), '') IS NOT NULL AND payable > 0 THEN
    manual_discount := CASE
      WHEN _manual_discount_type = 'percent'
        THEN ROUND(payable * (_manual_discount_value::numeric / 100))::integer
      ELSE _manual_discount_value
    END;
    manual_discount := LEAST(GREATEST(manual_discount, 0), payable);
    payable := payable - manual_discount;
  END IF;

  settled := _payment_mode IN ('cash', 'manual') OR payable = 0;
  final_method := CASE
    WHEN payable = 0 THEN 'voucher'
    WHEN _payment_mode = 'cash' THEN 'cash'
    ELSE 'card'
  END;

  UPDATE public.orders SET
    voucher_cents = redeemed,
    voucher_holder_id = holder_id,
    juror_discount_cents = juror_discount,
    discount_cents = manual_discount,
    total_cents = payable,
    payment_method = final_method,
    payment_status = CASE WHEN settled THEN 'paid'::public.payment_status ELSE 'pending'::public.payment_status END,
    status = CASE WHEN settled THEN 'preparing'::public.order_status ELSE 'pending_payment'::public.order_status END,
    sumup_transaction_id = CASE WHEN _payment_mode = 'manual' THEN trim(_manual_card_reference) ELSE NULL END
  WHERE id = created.id
  RETURNING * INTO created;

  FOR item IN SELECT value FROM jsonb_array_elements(_items)
  LOOP
    SELECT * INTO menu FROM public.menu_items WHERE id = (item->>'menu_item_id')::uuid;
    SELECT COALESCE(SUM(mm.price_cents), 0)::integer INTO modifier_total
    FROM public.menu_modifiers mm
    WHERE mm.id IN (
      SELECT jsonb_array_elements_text(COALESCE(item->'modifier_ids', '[]'::jsonb))::uuid
    );
    INSERT INTO public.order_items (
      order_id, menu_item_id, name, qty, unit_price_cents, notes
    ) VALUES (
      created.id, menu.id, menu.name, (item->>'qty')::integer,
      menu.price_cents + modifier_total,
      NULLIF(concat_ws(
        ' · ',
        NULLIF((
          SELECT string_agg(mm.name, ' · ' ORDER BY mm.name)
          FROM public.menu_modifiers mm
          WHERE mm.id IN (
            SELECT jsonb_array_elements_text(COALESCE(item->'modifier_ids', '[]'::jsonb))::uuid
          )
        ), ''),
        NULLIF(left(trim(COALESCE(item->>'notes', '')), 200), '')
      ), '')
    );
  END LOOP;

  IF redeemed > 0 THEN
    INSERT INTO public.order_payments (
      order_id, method, amount_cents, received_by
    ) VALUES (created.id, 'voucher', redeemed, auth.uid());
  END IF;
  IF settled AND payable > 0 THEN
    INSERT INTO public.order_payments (
      order_id, method, amount_cents, provider, provider_transaction_id, received_by
    ) VALUES (
      created.id, CASE WHEN _payment_mode = 'cash' THEN 'cash' ELSE 'card' END,
      payable, CASE WHEN _payment_mode = 'manual' THEN 'external_terminal' ELSE NULL END,
      CASE WHEN _payment_mode = 'manual' THEN trim(_manual_card_reference) ELSE NULL END,
      auth.uid()
    );
  END IF;
  IF _payment_mode = 'cash' AND payable > 0 THEN
    INSERT INTO public.till_cash_events (
      shift_id, actor_id, order_id, event_type, amount_cents, reason
    ) VALUES (_shift_id, auth.uid(), created.id, 'sale', payable, 'Counter cash sale');
  END IF;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, terminal, detail)
  VALUES (
    auth.uid(), CASE WHEN settled THEN 'order.counter.settled' ELSE 'order.counter.prepared' END,
    'order', created.id, _terminal,
    jsonb_build_object(
      'order_number', created.order_number,
      'subtotal_cents', subtotal,
      'voucher_cents', redeemed,
      'juror_discount_cents', juror_discount,
      'manual_discount_cents', manual_discount,
      'manual_discount_type', _manual_discount_type,
      'manual_discount_reason', NULLIF(trim(COALESCE(_manual_discount_reason, '')), ''),
      'total_cents', payable,
      'payment_mode', _payment_mode,
      'shift_id', _shift_id
    )
  );

  RETURN QUERY SELECT created.id, created.order_number, created.total_cents,
    created.subtotal_cents, created.voucher_cents, canonical_voucher_code,
    created.juror_discount_cents, created.payment_status;
END $fn$;
