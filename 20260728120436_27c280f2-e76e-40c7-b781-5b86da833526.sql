-- Cafe 1 production hardening: payment integrity, till accountability and least privilege.
-- This migration is intentionally additive so it can be applied to an existing Lovable project.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Customer data and loyalty balances

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, phone) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Guest order pages use narrow server functions. Anonymous table reads expose
-- every guest order because RLS cannot treat a UUID URL as a row secret.
DROP POLICY IF EXISTS orders_guest_read ON public.orders;
DROP POLICY IF EXISTS order_items_guest_read ON public.order_items;
DROP POLICY IF EXISTS orders_guest_insert ON public.orders;
DROP POLICY IF EXISTS order_items_guest_insert ON public.order_items;
DROP POLICY IF EXISTS orders_customer_insert ON public.orders;
DROP POLICY IF EXISTS order_items_insert ON public.order_items;
DROP POLICY IF EXISTS order_items_staff_insert ON public.order_items;
REVOKE SELECT ON public.orders FROM anon;
REVOKE SELECT ON public.order_items FROM anon;
REVOKE INSERT ON public.orders FROM anon;
REVOKE INSERT ON public.order_items FROM anon;

DROP POLICY IF EXISTS orders_staff_all ON public.orders;
DROP POLICY IF EXISTS orders_admin_all ON public.orders;
CREATE POLICY orders_admin_all ON public.orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY orders_staff_read ON public.orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff'));

CREATE POLICY order_items_admin_insert ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refunded_cents integer NOT NULL DEFAULT 0
    CHECK (refunded_cents >= 0),
  ADD COLUMN IF NOT EXISTS abandoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS loyalty_free_drinks_used integer NOT NULL DEFAULT 0
    CHECK (loyalty_free_drinks_used >= 0),
  ADD COLUMN IF NOT EXISTS idempotency_key uuid,
  ADD COLUMN IF NOT EXISTS till_shift_id uuid,
  ADD COLUMN IF NOT EXISTS tracking_token_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_uniq
  ON public.orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_sumup_transaction_id_uniq
  ON public.orders (sumup_transaction_id)
  WHERE sumup_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_tracking_token_hash_uniq
  ON public.orders (tracking_token_hash)
  WHERE tracking_token_hash IS NOT NULL;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('cash', 'card', 'split', 'voucher', 'account'));

-- ---------------------------------------------------------------------------
-- Immutable operational audit trail

CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  terminal text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_events_admin_read ON public.audit_events;
CREATE POLICY audit_events_admin_read ON public.audit_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS audit_events_entity_idx
  ON public.audit_events (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_actor_idx
  ON public.audit_events (actor_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Till shifts and cash ledger

CREATE TABLE IF NOT EXISTS public.till_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal text NOT NULL CHECK (terminal IN ('jury', 'judge', 'public')),
  staff_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  opening_float_cents integer NOT NULL CHECK (opening_float_cents >= 0),
  expected_cash_cents integer,
  counted_cash_cents integer,
  discrepancy_cents integer,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  close_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (closed_at IS NULL AND counted_cash_cents IS NULL AND discrepancy_cents IS NULL)
    OR closed_at IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS till_shifts_one_open_per_terminal
  ON public.till_shifts (terminal)
  WHERE closed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.till_cash_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.till_shifts(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (
    event_type IN ('sale', 'refund', 'paid_in', 'paid_out', 'drawer_open')
  ),
  amount_cents integer NOT NULL DEFAULT 0,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (event_type IN ('sale', 'paid_in') AND amount_cents > 0)
    OR (event_type IN ('refund', 'paid_out') AND amount_cents < 0)
    OR (event_type = 'drawer_open' AND amount_cents = 0)
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_till_shift_id_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_till_shift_id_fkey
      FOREIGN KEY (till_shift_id) REFERENCES public.till_shifts(id) ON DELETE SET NULL;
  END IF;
END $$;

GRANT SELECT ON public.till_shifts, public.till_cash_events TO authenticated;
GRANT ALL ON public.till_shifts, public.till_cash_events TO service_role;
ALTER TABLE public.till_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.till_cash_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS till_shifts_staff_read ON public.till_shifts;
CREATE POLICY till_shifts_staff_read ON public.till_shifts
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'staff') AND staff_id = auth.uid())
  );

DROP POLICY IF EXISTS till_cash_events_staff_read ON public.till_cash_events;
CREATE POLICY till_cash_events_staff_read ON public.till_cash_events
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.till_shifts s
      WHERE s.id = shift_id AND s.staff_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS till_cash_events_shift_idx
  ON public.till_cash_events (shift_id, created_at);

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
  IF _terminal NOT IN ('jury', 'judge', 'public') THEN
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

CREATE OR REPLACE FUNCTION public.close_till_shift(
  _shift_id uuid,
  _counted_cash_cents integer,
  _note text DEFAULT NULL
)
RETURNS public.till_shifts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_shift public.till_shifts%ROWTYPE;
  ledger_total integer;
  closed public.till_shifts%ROWTYPE;
BEGIN
  SELECT * INTO current_shift FROM public.till_shifts
  WHERE id = _shift_id FOR UPDATE;
  IF NOT FOUND OR current_shift.closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Open shift not found';
  END IF;
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin') OR current_shift.staff_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _counted_cash_cents < 0 OR _counted_cash_cents > 10000000 THEN
    RAISE EXCEPTION 'Invalid cash count';
  END IF;

  SELECT COALESCE(SUM(amount_cents), 0)::integer INTO ledger_total
  FROM public.till_cash_events WHERE shift_id = _shift_id;

  UPDATE public.till_shifts
  SET expected_cash_cents = opening_float_cents + ledger_total,
      counted_cash_cents = _counted_cash_cents,
      discrepancy_cents = _counted_cash_cents - (opening_float_cents + ledger_total),
      close_note = NULLIF(trim(_note), ''),
      closed_at = now()
  WHERE id = _shift_id
  RETURNING * INTO closed;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, terminal, detail)
  VALUES (
    auth.uid(), 'till.shift.close', 'till_shift', closed.id, closed.terminal,
    jsonb_build_object(
      'expected_cash_cents', closed.expected_cash_cents,
      'counted_cash_cents', closed.counted_cash_cents,
      'discrepancy_cents', closed.discrepancy_cents,
      'note', closed.close_note
    )
  );
  RETURN closed;
END $$;

CREATE OR REPLACE FUNCTION public.record_till_cash_event(
  _shift_id uuid,
  _event_type text,
  _amount_cents integer,
  _reason text
)
RETURNS public.till_cash_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_shift public.till_shifts%ROWTYPE;
  entry public.till_cash_events%ROWTYPE;
BEGIN
  SELECT * INTO current_shift FROM public.till_shifts
  WHERE id = _shift_id AND closed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Open shift not found'; END IF;
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin') OR current_shift.staff_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _event_type NOT IN ('paid_in', 'paid_out', 'drawer_open') THEN
    RAISE EXCEPTION 'Invalid cash event';
  END IF;
  IF _event_type = 'paid_out' AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Manager approval required for cash paid out';
  END IF;
  IF _event_type = 'drawer_open' THEN
    _amount_cents := 0;
  ELSIF _amount_cents <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  ELSIF _event_type = 'paid_out' THEN
    _amount_cents := -_amount_cents;
  END IF;
  IF _event_type <> 'drawer_open' AND length(trim(COALESCE(_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;

  INSERT INTO public.till_cash_events (
    shift_id, actor_id, event_type, amount_cents, reason
  ) VALUES (
    _shift_id, auth.uid(), _event_type, _amount_cents, NULLIF(trim(_reason), '')
  ) RETURNING * INTO entry;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, terminal, detail)
  VALUES (
    auth.uid(), 'till.cash.' || _event_type, 'till_shift', _shift_id,
    current_shift.terminal,
    jsonb_build_object('amount_cents', _amount_cents, 'reason', entry.reason)
  );
  RETURN entry;
END $$;

-- ---------------------------------------------------------------------------
-- Counter payments and refunds

CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  provider text NOT NULL DEFAULT 'sumup_reader',
  provider_reference text NOT NULL UNIQUE,
  client_transaction_id text UNIQUE,
  provider_transaction_id text UNIQUE,
  reader_id text,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  cash_component_cents integer NOT NULL DEFAULT 0 CHECK (cash_component_cents >= 0),
  currency text NOT NULL DEFAULT 'GBP',
  status text NOT NULL DEFAULT 'created' CHECK (
    status IN ('created', 'pending', 'paid', 'failed', 'cancelled', 'used')
  ),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER payment_attempts_updated
  BEFORE UPDATE ON public.payment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  method text NOT NULL CHECK (method IN ('cash', 'card', 'voucher', 'account')),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  provider text,
  provider_transaction_id text,
  payment_attempt_id uuid REFERENCES public.payment_attempts(id) ON DELETE RESTRICT,
  received_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS order_payments_provider_txn_uniq
  ON public.order_payments (provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.order_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL UNIQUE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  card_amount_cents integer NOT NULL DEFAULT 0 CHECK (card_amount_cents >= 0),
  cash_amount_cents integer NOT NULL DEFAULT 0 CHECK (cash_amount_cents >= 0),
  reason text NOT NULL,
  provider text,
  provider_transaction_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (card_amount_cents + cash_amount_cents <= amount_cents)
);

GRANT SELECT ON public.payment_attempts, public.order_payments, public.order_refunds TO authenticated;
GRANT ALL ON public.payment_attempts, public.order_payments, public.order_refunds TO service_role;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_attempts_staff_read ON public.payment_attempts
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'staff') AND created_by = auth.uid())
  );
CREATE POLICY order_payments_staff_read ON public.order_payments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY order_refunds_admin_read ON public.order_refunds
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Reserve refund value before calling the provider. The row lock prevents two
-- managers or retries from refunding the same paid amount concurrently.
CREATE OR REPLACE FUNCTION public.reserve_order_refund(
  _order_id uuid,
  _idempotency_key uuid,
  _amount_cents integer,
  _card_amount_cents integer,
  _cash_amount_cents integer,
  _reason text,
  _requested_by uuid,
  _provider text,
  _provider_transaction_id text
)
RETURNS public.order_refunds
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target public.orders%ROWTYPE;
  existing public.order_refunds%ROWTYPE;
  reserved_total integer;
  reserved_card integer;
  reserved_cash integer;
  paid_card integer;
  paid_cash integer;
  created public.order_refunds%ROWTYPE;
BEGIN
  SELECT * INTO existing FROM public.order_refunds
  WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN RETURN existing; END IF;

  SELECT * INTO target FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF target.payment_status NOT IN ('paid', 'refunded', 'on_account') THEN
    RAISE EXCEPTION 'Only a settled order can be refunded';
  END IF;
  IF _amount_cents <= 0 OR _card_amount_cents < 0 OR _cash_amount_cents < 0
    OR _card_amount_cents + _cash_amount_cents > _amount_cents THEN
    RAISE EXCEPTION 'Invalid refund allocation';
  END IF;

  SELECT COALESCE(SUM(amount_cents), 0)::integer INTO paid_card
  FROM public.order_payments WHERE order_id = _order_id AND method = 'card';
  SELECT COALESCE(SUM(amount_cents), 0)::integer INTO paid_cash
  FROM public.order_payments WHERE order_id = _order_id AND method = 'cash';
  IF paid_card = 0 AND paid_cash = 0 THEN
    IF target.payment_method = 'cash' THEN paid_cash := target.total_cents;
    ELSIF target.payment_method = 'card' THEN paid_card := target.total_cents;
    END IF;
  END IF;

  SELECT
    COALESCE(SUM(amount_cents), 0)::integer,
    COALESCE(SUM(card_amount_cents), 0)::integer,
    COALESCE(SUM(cash_amount_cents), 0)::integer
  INTO reserved_total, reserved_card, reserved_cash
  FROM public.order_refunds
  WHERE order_id = _order_id AND status IN ('pending', 'succeeded');

  IF reserved_total + _amount_cents > target.total_cents THEN
    RAISE EXCEPTION 'Refund exceeds the remaining paid amount';
  END IF;
  IF reserved_card + _card_amount_cents > paid_card
    OR reserved_cash + _cash_amount_cents > paid_cash THEN
    RAISE EXCEPTION 'Refund allocation exceeds the payment tender';
  END IF;

  INSERT INTO public.order_refunds (
    order_id, idempotency_key, amount_cents, card_amount_cents,
    cash_amount_cents, reason, requested_by, provider,
    provider_transaction_id
  ) VALUES (
    _order_id, _idempotency_key, _amount_cents, _card_amount_cents,
    _cash_amount_cents, _reason, _requested_by, _provider,
    _provider_transaction_id
  ) RETURNING * INTO created;
  RETURN created;
END $$;

-- Atomic order preparation. Reader payments remain pending; cash and approved
-- manual-card sales settle inside the same transaction as the order and items.
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
  _items jsonb
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  WHERE id = _shift_id AND terminal = _terminal AND closed_at IS NULL FOR UPDATE;
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
      'total_cents', payable,
      'payment_mode', _payment_mode,
      'shift_id', _shift_id
    )
  );

  RETURN QUERY SELECT created.id, created.order_number, created.total_cents,
    created.subtotal_cents, created.voucher_cents, canonical_voucher_code,
    created.juror_discount_cents, created.payment_status;
END $$;

CREATE OR REPLACE FUNCTION public.finalize_counter_card(
  _order_id uuid,
  _payment_attempt_id uuid
)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target public.orders%ROWTYPE;
  attempt public.payment_attempts%ROWTYPE;
  completed public.orders%ROWTYPE;
BEGIN
  SELECT * INTO target FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND OR target.source <> 'counter' THEN RAISE EXCEPTION 'Counter order not found'; END IF;
  IF target.payment_status = 'paid' THEN RETURN target; END IF;
  IF target.status <> 'pending_payment' OR target.payment_status <> 'pending' THEN
    RAISE EXCEPTION 'Order is not awaiting payment';
  END IF;

  SELECT * INTO attempt FROM public.payment_attempts
  WHERE id = _payment_attempt_id AND order_id = _order_id FOR UPDATE;
  IF NOT FOUND OR attempt.status <> 'paid' THEN RAISE EXCEPTION 'Verified payment not found'; END IF;
  IF attempt.created_by <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF attempt.amount_cents + attempt.cash_component_cents <> target.total_cents
    OR attempt.currency <> 'GBP' THEN
    RAISE EXCEPTION 'Payment amount does not match order';
  END IF;
  IF attempt.provider_transaction_id IS NULL THEN RAISE EXCEPTION 'Provider transaction is missing'; END IF;

  UPDATE public.orders SET
    payment_status = 'paid', status = 'preparing',
    payment_method = CASE WHEN attempt.cash_component_cents > 0 THEN 'split' ELSE 'card' END,
    sumup_transaction_id = attempt.provider_transaction_id
  WHERE id = target.id
  RETURNING * INTO completed;

  UPDATE public.payment_attempts SET status = 'used' WHERE id = attempt.id;
  INSERT INTO public.order_payments (
    order_id, method, amount_cents, provider, provider_transaction_id,
    payment_attempt_id, received_by
  ) VALUES (
    target.id, 'card', attempt.amount_cents, 'sumup_reader',
    attempt.provider_transaction_id, attempt.id, auth.uid()
  );
  IF attempt.cash_component_cents > 0 THEN
    INSERT INTO public.order_payments (
      order_id, method, amount_cents, received_by
    ) VALUES (target.id, 'cash', attempt.cash_component_cents, auth.uid());
    INSERT INTO public.till_cash_events (
      shift_id, actor_id, order_id, event_type, amount_cents, reason
    ) VALUES (
      target.till_shift_id, auth.uid(), target.id, 'sale',
      attempt.cash_component_cents, 'Split-tender cash component'
    );
  END IF;
  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, terminal, detail)
  VALUES (
    auth.uid(), 'order.counter.card_settled', 'order', target.id, target.pos_terminal,
    jsonb_build_object('payment_attempt_id', attempt.id, 'amount_cents', target.total_cents)
  );
  RETURN completed;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_counter_order(
  _order_id uuid,
  _reason text
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target public.orders%ROWTYPE;
BEGIN
  SELECT * INTO target FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF target.source <> 'counter' OR target.payment_status <> 'pending' THEN RETURN false; END IF;
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')
  ) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  DELETE FROM public.voucher_redemptions WHERE order_id = target.id;
  INSERT INTO public.voucher_events (holder_id, code, event, amount_cents, order_id, detail)
  SELECT target.voucher_holder_id, COALESCE(v.code, 'unknown'), 'release', target.voucher_cents,
    target.id, COALESCE(NULLIF(trim(_reason), ''), 'counter payment cancelled')
  FROM public.voucher_holders v WHERE v.id = target.voucher_holder_id;
  UPDATE public.orders
  SET payment_status = 'failed', status = 'cancelled', abandoned_at = now()
  WHERE id = target.id;
  UPDATE public.payment_attempts
  SET status = CASE WHEN status = 'paid' THEN status ELSE 'cancelled' END,
      failure_reason = COALESCE(NULLIF(trim(_reason), ''), 'counter payment cancelled')
  WHERE order_id = target.id AND status IN ('created', 'pending', 'failed');
  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, terminal, detail)
  VALUES (
    auth.uid(), 'order.counter.cancel', 'order', target.id, target.pos_terminal,
    jsonb_build_object('reason', COALESCE(NULLIF(trim(_reason), ''), 'cancelled'))
  );
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.complete_order_refund(_refund_id uuid)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  refund_row public.order_refunds%ROWTYPE;
  target public.orders%ROWTYPE;
  updated_order public.orders%ROWTYPE;
  new_refunded integer;
  reward_units integer;
BEGIN
  SELECT * INTO refund_row FROM public.order_refunds
  WHERE id = _refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found'; END IF;
  IF refund_row.status = 'succeeded' THEN
    SELECT * INTO updated_order FROM public.orders WHERE id = refund_row.order_id;
    RETURN updated_order;
  END IF;

  SELECT * INTO target FROM public.orders WHERE id = refund_row.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  new_refunded := target.refunded_cents + refund_row.amount_cents;
  IF new_refunded > target.total_cents THEN RAISE EXCEPTION 'Refund exceeds remaining paid amount'; END IF;

  UPDATE public.order_refunds
  SET status = 'succeeded', completed_at = now(), failure_reason = NULL
  WHERE id = refund_row.id;

  UPDATE public.orders SET
    refunded_cents = new_refunded,
    payment_status = CASE
      WHEN new_refunded = total_cents THEN 'refunded'::public.payment_status
      ELSE payment_status
    END,
    status = CASE
      WHEN new_refunded = total_cents THEN 'refunded'::public.order_status
      ELSE status
    END
  WHERE id = target.id
  RETURNING * INTO updated_order;

  IF refund_row.cash_amount_cents > 0
    AND target.till_shift_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.till_shifts s
      WHERE s.id = target.till_shift_id AND s.closed_at IS NULL
    ) THEN
    INSERT INTO public.till_cash_events (
      shift_id, actor_id, order_id, event_type, amount_cents, reason
    ) VALUES (
      target.till_shift_id, refund_row.requested_by, target.id, 'refund',
      -refund_row.cash_amount_cents, refund_row.reason
    );
  END IF;

  IF new_refunded = target.total_cents THEN
    IF target.voucher_holder_id IS NOT NULL AND target.voucher_cents > 0 THEN
      DELETE FROM public.voucher_redemptions WHERE order_id = target.id;
      INSERT INTO public.voucher_events (
        holder_id, code, event, amount_cents, order_id, detail
      )
      SELECT target.voucher_holder_id, v.code, 'release', target.voucher_cents,
        target.id, 'Full order refund'
      FROM public.voucher_holders v WHERE v.id = target.voucher_holder_id;
    END IF;

    IF target.loyalty_awarded AND target.customer_id IS NOT NULL THEN
      SELECT free_drinks_available * 10 + drink_stamps INTO reward_units
      FROM public.profiles WHERE id = target.customer_id FOR UPDATE;
      UPDATE public.profiles SET
        loyalty_points = GREATEST(loyalty_points - target.points_earned, 0),
        lifetime_points = GREATEST(lifetime_points - target.points_earned, 0),
        free_drinks_available = GREATEST(reward_units - target.loyalty_stamps_pending, 0) / 10,
        drink_stamps = GREATEST(reward_units - target.loyalty_stamps_pending, 0) % 10
      WHERE id = target.customer_id;
    END IF;
  END IF;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, terminal, detail)
  VALUES (
    refund_row.requested_by, 'order.refund.complete', 'order', target.id,
    target.pos_terminal,
    jsonb_build_object(
      'refund_id', refund_row.id,
      'amount_cents', refund_row.amount_cents,
      'card_amount_cents', refund_row.card_amount_cents,
      'cash_amount_cents', refund_row.cash_amount_cents,
      'cumulative_refunded_cents', new_refunded,
      'reason', refund_row.reason
    )
  );
  RETURN updated_order;
END $$;

-- ---------------------------------------------------------------------------
-- Role-aware order state transitions

CREATE OR REPLACE FUNCTION public.transition_order_status(
  _order_id uuid,
  _next public.order_status
)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_order public.orders%ROWTYPE;
  changed public.orders%ROWTYPE;
  is_admin boolean := public.has_role(auth.uid(), 'admin');
  is_staff boolean := public.has_role(auth.uid(), 'staff');
  is_driver boolean := public.has_role(auth.uid(), 'driver');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO current_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF is_driver AND NOT is_admin AND NOT is_staff THEN
    IF current_order.driver_id <> auth.uid() THEN RAISE EXCEPTION 'Forbidden'; END IF;
    IF NOT (
      (current_order.status = 'ready' AND _next = 'out_for_delivery')
      OR (current_order.status = 'out_for_delivery' AND _next = 'delivered')
    ) THEN RAISE EXCEPTION 'Drivers cannot make that status change'; END IF;
  ELSIF is_admin OR is_staff THEN
    IF NOT (
      (current_order.status = 'paid' AND _next IN ('preparing', 'cancelled'))
      OR (current_order.status = 'preparing' AND _next IN ('ready', 'cancelled'))
      OR (current_order.status = 'ready' AND _next IN ('completed', 'out_for_delivery'))
      OR (current_order.status = 'out_for_delivery' AND _next = 'delivered')
      OR (current_order.status = 'delivered' AND _next = 'completed')
      OR current_order.status = _next
    ) THEN RAISE EXCEPTION 'Invalid order status transition'; END IF;
  ELSE
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _next = 'cancelled' AND current_order.payment_status IN ('paid', 'on_account') THEN
    RAISE EXCEPTION 'Paid orders must be refunded, not cancelled';
  END IF;

  UPDATE public.orders SET
    status = _next,
    ready_at = CASE WHEN _next = 'ready' THEN now() ELSE ready_at END,
    picked_up_at = CASE WHEN _next = 'out_for_delivery' THEN now() ELSE picked_up_at END,
    delivered_at = CASE WHEN _next IN ('delivered', 'completed') THEN now() ELSE delivered_at END
  WHERE id = _order_id RETURNING * INTO changed;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, detail)
  VALUES (
    auth.uid(), 'order.status.transition', 'order', _order_id,
    jsonb_build_object('from', current_order.status, 'to', _next)
  );
  RETURN changed;
END $$;

CREATE OR REPLACE FUNCTION public.claim_delivery_order(_order_id uuid)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed public.orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'driver') OR public.has_role(auth.uid(), 'admin')
  ) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.orders SET
    driver_id = auth.uid(), status = 'out_for_delivery', picked_up_at = now()
  WHERE id = _order_id AND type = 'delivery' AND driver_id IS NULL
    AND status = 'ready'
  RETURNING * INTO claimed;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery is no longer available'; END IF;
  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, detail)
  VALUES (auth.uid(), 'order.delivery.claim', 'order', _order_id, '{}'::jsonb);
  RETURN claimed;
END $$;

-- Direct row updates are too broad for drivers. Drivers now use the two
-- security-definer commands above, each of which enforces the state machine.
DROP POLICY IF EXISTS orders_driver_update ON public.orders;

-- ---------------------------------------------------------------------------
-- Atomic loyalty award

CREATE OR REPLACE FUNCTION public.award_loyalty_for_order(_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target public.orders%ROWTYPE;
DECLARE profile_row public.profiles%ROWTYPE;
DECLARE stamps_total integer;
BEGIN
  SELECT * INTO target FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND OR target.payment_status NOT IN ('paid', 'on_account')
    OR target.loyalty_awarded THEN RETURN false; END IF;
  UPDATE public.orders SET loyalty_awarded = true WHERE id = target.id;
  IF target.customer_id IS NULL THEN RETURN false; END IF;
  SELECT * INTO profile_row FROM public.profiles WHERE id = target.customer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  stamps_total := profile_row.drink_stamps + target.loyalty_stamps_pending;
  UPDATE public.profiles SET
    loyalty_points = loyalty_points + target.points_earned,
    lifetime_points = lifetime_points + target.points_earned,
    drink_stamps = stamps_total % 10,
    free_drinks_available = free_drinks_available + floor(stamps_total / 10)::integer
  WHERE id = target.customer_id;
  INSERT INTO public.audit_events (action, entity_type, entity_id, detail)
  VALUES (
    'loyalty.order.award', 'order', target.id,
    jsonb_build_object('points', target.points_earned, 'stamps', target.loyalty_stamps_pending)
  );
  RETURN true;
END $$;

-- ---------------------------------------------------------------------------
-- House-account codes are stored as one-way hashes. Staff still receive the
-- generated code once when creating/regenerating an account.

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS access_code_hash text;
UPDATE public.accounts
SET access_code_hash = encode(digest(upper(trim(access_code)), 'sha256'), 'hex')
WHERE access_code_hash IS NULL AND access_code IS NOT NULL;
ALTER TABLE public.accounts ALTER COLUMN access_code DROP NOT NULL;
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_access_code_key;
UPDATE public.accounts SET access_code = NULL WHERE access_code_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_access_code_hash_uniq
  ON public.accounts (access_code_hash)
  WHERE access_code_hash IS NOT NULL;

-- Staff can read account statements, but only managers can mutate accounts or
-- post settlements. Hashes/plaintext codes are not readable from browser JWTs.
DROP POLICY IF EXISTS accounts_staff_all ON public.accounts;
CREATE POLICY accounts_admin_all ON public.accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY accounts_staff_read ON public.accounts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
REVOKE SELECT ON public.accounts FROM authenticated;
GRANT SELECT (
  id, name, contact_name, contact_email, contact_phone, credit_limit_cents,
  notes, active, created_at, updated_at
) ON public.accounts TO authenticated;

DROP POLICY IF EXISTS "Staff can record account payments" ON public.account_payments;
DROP POLICY IF EXISTS "Admins can update account payments" ON public.account_payments;
DROP POLICY IF EXISTS "Admins can delete account payments" ON public.account_payments;
CREATE POLICY account_payments_admin_insert ON public.account_payments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY account_payments_admin_update ON public.account_payments
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY account_payments_admin_delete ON public.account_payments
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.verify_account_code(_code text)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.name FROM public.accounts a
  WHERE a.active = true
    AND a.access_code_hash = encode(digest(upper(trim(_code)), 'sha256'), 'hex')
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.verify_account_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_account_code(text) TO service_role;

-- No operational command is directly callable by anonymous users.
REVOKE ALL ON FUNCTION public.open_till_shift(text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_till_shift(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_till_cash_event(uuid, text, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prepare_counter_order(uuid, uuid, text, text, text, text, text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_counter_card(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_counter_order(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_order_refund(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_order_refund(uuid, uuid, integer, integer, integer, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transition_order_status(uuid, public.order_status) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_delivery_order(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.award_loyalty_for_order(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.open_till_shift(text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_till_shift(uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_till_cash_event(uuid, text, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.prepare_counter_order(uuid, uuid, text, text, text, text, text, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_counter_card(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_counter_order(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_order_refund(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_order_refund(uuid, uuid, integer, integer, integer, text, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_order_status(uuid, public.order_status) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_delivery_order(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.award_loyalty_for_order(uuid) TO service_role;
