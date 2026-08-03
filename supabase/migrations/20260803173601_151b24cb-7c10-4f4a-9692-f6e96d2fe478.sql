-- Secure HMCTS juror voucher scheme v2
--
-- Controls introduced here:
--   * 64-bit anonymous voucher codes plus a separately issued six-digit PIN
--   * per-code failed-PIN lockout (in addition to application/IP throttling)
--   * manager + AAL2-only issuance, expiry changes and >10-hour uplifts
--   * ten court-working-day validity, including configured bank holidays
--   * optional daily court-presence proof for online voucher orders
--   * paid-order-only reimbursement rows
--   * read-only staff access to the voucher ledger; all writes are audited RPCs

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.voucher_holders
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS failed_pin_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_pin_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attendance_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS security_version integer NOT NULL DEFAULT 2;

ALTER TABLE public.voucher_events
  ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.voucher_redemptions
  ADD COLUMN IF NOT EXISTS reservation_token uuid;
CREATE UNIQUE INDEX IF NOT EXISTS voucher_redemptions_reservation_token_uniq
  ON public.voucher_redemptions (reservation_token)
  WHERE reservation_token IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'voucher_holders_failed_pin_attempts_check'
  ) THEN
    ALTER TABLE public.voucher_holders
      ADD CONSTRAINT voucher_holders_failed_pin_attempts_check
      CHECK (failed_pin_attempts BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'voucher_holders_daily_amount_check'
  ) THEN
    ALTER TABLE public.voucher_holders
      ADD CONSTRAINT voucher_holders_daily_amount_check
      CHECK (daily_amount_cents BETWEEN 0 AND 1217);
  END IF;
END $$;

-- A code issued before PIN protection cannot meet the identity control. Retire
-- it instead of silently allowing code-only redemption; a manager can issue a
-- replacement from the secure batch screen.
INSERT INTO public.voucher_events (holder_id, code, event, detail)
SELECT id, code, 'security_retired', 'Reissue required: legacy code had no PIN'
FROM public.voucher_holders
WHERE active = true AND pin_hash IS NULL;

UPDATE public.voucher_holders
SET active = false,
    deactivated_at = COALESCE(deactivated_at, now()),
    security_version = 1
WHERE active = true AND pin_hash IS NULL;

CREATE TABLE IF NOT EXISTS public.juror_daily_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_id uuid NOT NULL REFERENCES public.voucher_holders(id) ON DELETE RESTRICT,
  for_date date NOT NULL DEFAULT CURRENT_DATE,
  room text NOT NULL,
  challenge_id uuid REFERENCES public.juror_attendance_challenges(id) ON DELETE SET NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (holder_id, for_date)
);

CREATE TABLE IF NOT EXISTS public.juror_attendance_consumptions (
  challenge_id uuid NOT NULL REFERENCES public.juror_attendance_challenges(id) ON DELETE CASCADE,
  holder_id uuid NOT NULL REFERENCES public.voucher_holders(id) ON DELETE RESTRICT,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, holder_id)
);

ALTER TABLE public.juror_daily_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.juror_attendance_consumptions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.juror_daily_presence, public.juror_attendance_consumptions TO service_role;
REVOKE ALL ON public.juror_daily_presence, public.juror_attendance_consumptions FROM anon, authenticated;

-- Staff may inspect the anonymous ledger but cannot create, alter, delete,
-- extend or increase a voucher directly from a browser client.
DROP POLICY IF EXISTS voucher_holders_staff_all ON public.voucher_holders;
DROP POLICY IF EXISTS voucher_allocations_staff_all ON public.voucher_allocations;
DROP POLICY IF EXISTS voucher_redemptions_staff_all ON public.voucher_redemptions;

REVOKE ALL ON public.voucher_holders, public.voucher_allocations,
  public.voucher_redemptions FROM anon, authenticated;
GRANT SELECT ON public.voucher_holders, public.voucher_allocations,
  public.voucher_redemptions TO authenticated;

DROP POLICY IF EXISTS voucher_holders_staff_read ON public.voucher_holders;
DROP POLICY IF EXISTS voucher_allocations_staff_read ON public.voucher_allocations;
DROP POLICY IF EXISTS voucher_redemptions_staff_read ON public.voucher_redemptions;

CREATE POLICY voucher_holders_staff_read ON public.voucher_holders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY voucher_allocations_staff_read ON public.voucher_allocations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY voucher_redemptions_staff_read ON public.voucher_redemptions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE OR REPLACE FUNCTION public.cafe1_add_court_working_days(_from date, _days integer)
RETURNS date
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d date := _from;
  remaining integer := _days;
BEGIN
  IF _from IS NULL OR _days < 1 OR _days > 260 THEN
    RAISE EXCEPTION 'Invalid working-day range';
  END IF;
  LOOP
    IF public.is_court_working_day(d) THEN
      remaining := remaining - 1;
      IF remaining = 0 THEN RETURN d; END IF;
    END IF;
    d := d + 1;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.cafe1_add_court_working_days(date, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cafe1_add_court_working_days(date, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.cafe1_issue_juror_batch(
  _batch text,
  _count integer DEFAULT 100,
  _valid_from date DEFAULT CURRENT_DATE,
  _service_days integer DEFAULT 10
)
RETURNS TABLE(code text, pin text, valid_from date, valid_until date)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid;
  generated_code text;
  generated_pin text;
  raw text;
  random_pin_bytes bytea;
  pin_number bigint;
  end_date date;
  holder_id uuid;
  i integer;
BEGIN
  actor := public.cafe1_assert_operator(true);
  IF _count < 1 OR _count > 200 THEN RAISE EXCEPTION 'Issue between 1 and 200 codes'; END IF;
  IF _service_days < 1 OR _service_days > 60 THEN RAISE EXCEPTION 'Service days must be 1 to 60'; END IF;
  IF length(trim(COALESCE(_batch, ''))) < 2 OR length(_batch) > 120 THEN
    RAISE EXCEPTION 'A batch label is required';
  END IF;
  IF _valid_from < CURRENT_DATE - 7 OR _valid_from > CURRENT_DATE + 120 THEN
    RAISE EXCEPTION 'Invalid service start date';
  END IF;

  end_date := public.cafe1_add_court_working_days(_valid_from, _service_days);

  FOR i IN 1.._count LOOP
    LOOP
      raw := upper(encode(gen_random_bytes(8), 'hex'));
      generated_code := 'CV-' || substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 8);
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.voucher_holders h WHERE upper(h.code) = generated_code
      );
    END LOOP;

    random_pin_bytes := gen_random_bytes(4);
    pin_number := (
      get_byte(random_pin_bytes, 0)::bigint * 16777216
      + get_byte(random_pin_bytes, 1)::bigint * 65536
      + get_byte(random_pin_bytes, 2)::bigint * 256
      + get_byte(random_pin_bytes, 3)::bigint
    ) % 1000000;
    generated_pin := lpad(pin_number::text, 6, '0');

    INSERT INTO public.voucher_holders (
      code, batch, active, daily_amount_cents, valid_from, valid_until,
      pin_hash, failed_pin_attempts, issued_by, attendance_required, security_version
    ) VALUES (
      generated_code, trim(_batch), true, 571, _valid_from, end_date,
      crypt(generated_pin, gen_salt('bf', 11)), 0, actor, true, 2
    ) RETURNING id INTO holder_id;

    INSERT INTO public.voucher_events (holder_id, code, event, detail, actor_id)
    VALUES (
      holder_id, generated_code, 'issued',
      format('Batch %s; %s court working days; valid %s to %s',
        trim(_batch), _service_days, _valid_from, end_date), actor
    );

    code := generated_code;
    pin := generated_pin;
    valid_from := _valid_from;
    valid_until := end_date;
    RETURN NEXT;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.cafe1_issue_juror_batch(text, integer, date, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cafe1_issue_juror_batch(text, integer, date, integer)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.verify_juror_voucher_credentials(_code text, _pin text)
RETURNS TABLE(
  holder_id uuid, holder_name text, code text,
  allocated_cents integer, used_cents integer, remaining_cents integer,
  valid_from date, valid_until date, opted_in boolean,
  jury_room text, attendance_required boolean, attendance_verified boolean,
  status text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  h public.voucher_holders%ROWTYPE;
  alloc integer := 0;
  used integer := 0;
  st text := 'ok';
  present_today boolean := false;
  failures integer;
BEGIN
  IF _code IS NULL OR trim(_code) = '' OR _pin IS NULL OR _pin !~ '^[0-9]{6}$' THEN RETURN; END IF;

  SELECT * INTO h
  FROM public.voucher_holders v
  WHERE upper(v.code) = upper(trim(_code))
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF h.pin_locked_until IS NOT NULL AND h.pin_locked_until > now() THEN
    st := 'locked';
  ELSIF h.pin_hash IS NULL OR crypt(_pin, h.pin_hash) <> h.pin_hash THEN
    failures := h.failed_pin_attempts + 1;
    UPDATE public.voucher_holders
    SET failed_pin_attempts = failures,
        pin_locked_until = CASE WHEN failures >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
        updated_at = now()
    WHERE id = h.id;
    IF failures = 5 THEN
      INSERT INTO public.voucher_events (holder_id, code, event, detail)
      VALUES (h.id, h.code, 'pin_locked', 'Five failed PIN attempts; locked for 15 minutes');
    END IF;
    RETURN;
  ELSE
    UPDATE public.voucher_holders
    SET failed_pin_attempts = 0,
        pin_locked_until = NULL,
        last_pin_verified_at = now(),
        updated_at = now()
    WHERE id = h.id;
  END IF;

  IF st = 'ok' THEN
    IF h.active IS NOT TRUE THEN st := 'inactive';
    ELSIF CURRENT_DATE < h.valid_from THEN st := 'not_started';
    ELSIF h.valid_until IS NOT NULL AND CURRENT_DATE > h.valid_until THEN st := 'expired';
    ELSIF NOT public.is_court_working_day(CURRENT_DATE) THEN st := 'non_sitting_day';
    END IF;
  END IF;

  IF st = 'ok' THEN
    SELECT a.amount_cents INTO alloc
    FROM public.voucher_allocations a
    WHERE a.holder_id = h.id AND a.for_date = CURRENT_DATE;
    IF alloc IS NULL THEN alloc := h.daily_amount_cents; END IF;
  END IF;

  SELECT COALESCE(SUM(r.amount_cents), 0)::integer INTO used
  FROM public.voucher_redemptions r
  WHERE r.holder_id = h.id AND r.for_date = CURRENT_DATE;

  SELECT EXISTS (
    SELECT 1 FROM public.juror_daily_presence p
    WHERE p.holder_id = h.id AND p.for_date = CURRENT_DATE
  ) INTO present_today;

  RETURN QUERY SELECT
    h.id, h.name, h.code, COALESCE(alloc, 0), COALESCE(used, 0),
    GREATEST(COALESCE(alloc, 0) - COALESCE(used, 0), 0),
    h.valid_from, h.valid_until, h.opted_in_at IS NOT NULL,
    h.jury_room, h.attendance_required, present_today, st;
END $$;

REVOKE ALL ON FUNCTION public.verify_juror_voucher_credentials(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_juror_voucher_credentials(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.opt_in_voucher_secure(_code text, _pin text, _source text)
RETURNS TABLE(ok boolean, message text, already boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  verified record;
BEGIN
  SELECT * INTO verified FROM public.verify_juror_voucher_credentials(_code, _pin) LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Code or PIN not recognised', false;
    RETURN;
  END IF;
  IF verified.status <> 'ok' THEN
    RETURN QUERY SELECT false, 'This voucher is not available today', false;
    RETURN;
  END IF;
  IF verified.opted_in THEN
    RETURN QUERY SELECT true, 'Already opted in', true;
    RETURN;
  END IF;
  UPDATE public.voucher_holders
  SET opted_in_at = now(), opt_in_source = left(COALESCE(NULLIF(trim(_source), ''), 'online'), 30),
      updated_at = now()
  WHERE id = verified.holder_id;
  INSERT INTO public.voucher_events (holder_id, code, event, detail)
  VALUES (verified.holder_id, verified.code, 'opt_in', left(COALESCE(_source, 'online'), 30));
  RETURN QUERY SELECT true, 'Opted into the juror voucher scheme', false;
END $$;

REVOKE ALL ON FUNCTION public.opt_in_voucher_secure(text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.opt_in_voucher_secure(text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_juror_voucher(
  _code text,
  _pin text,
  _amount_cents integer,
  _reservation_token uuid,
  _channel text DEFAULT 'online'
)
RETURNS TABLE(
  holder_id uuid,
  holder_name text,
  voucher_code text,
  reserved_cents integer,
  reservation_token uuid
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  verified record;
  alloc public.voucher_allocations%ROWTYPE;
  used integer;
  take integer;
  redemption public.voucher_redemptions%ROWTYPE;
BEGIN
  IF _reservation_token IS NULL OR _amount_cents < 1 OR _amount_cents > 1000000 THEN
    RAISE EXCEPTION 'Invalid voucher reservation';
  END IF;
  IF _channel NOT IN ('online', 'counter') THEN RAISE EXCEPTION 'Invalid voucher channel'; END IF;

  SELECT r.* INTO redemption
  FROM public.voucher_redemptions r
  WHERE r.reservation_token = _reservation_token;
  IF FOUND THEN
    RETURN QUERY SELECT h.id, h.name, h.code, redemption.amount_cents, redemption.reservation_token
    FROM public.voucher_holders h WHERE h.id = redemption.holder_id;
    RETURN;
  END IF;

  SELECT * INTO verified
  FROM public.verify_juror_voucher_credentials(_code, _pin)
  LIMIT 1;
  IF NOT FOUND OR verified.status <> 'ok' THEN
    RAISE EXCEPTION 'Voucher code or PIN is invalid, locked or unavailable today';
  END IF;
  IF _channel = 'online' AND verified.attendance_required AND NOT verified.attendance_verified THEN
    RAISE EXCEPTION 'Confirm attendance with today''s jury-room QR before ordering online';
  END IF;

  SELECT * INTO alloc FROM public.voucher_allocations
  WHERE holder_id = verified.holder_id AND for_date = CURRENT_DATE
  FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.voucher_allocations (holder_id, for_date, amount_cents, notes)
    VALUES (verified.holder_id, CURRENT_DATE, verified.allocated_cents, 'auto daily allowance')
    RETURNING * INTO alloc;
  END IF;

  SELECT COALESCE(SUM(r.amount_cents), 0)::integer INTO used
  FROM public.voucher_redemptions r
  WHERE r.holder_id = verified.holder_id AND r.for_date = CURRENT_DATE;
  take := LEAST(GREATEST(_amount_cents, 0), GREATEST(alloc.amount_cents - used, 0));
  IF take <= 0 THEN RAISE EXCEPTION 'No voucher allowance remains today'; END IF;

  INSERT INTO public.voucher_redemptions (
    holder_id, allocation_id, order_id, for_date, amount_cents, reservation_token
  ) VALUES (
    verified.holder_id, alloc.id, NULL, CURRENT_DATE, take, _reservation_token
  ) RETURNING * INTO redemption;

  INSERT INTO public.voucher_events (holder_id, code, event, amount_cents, detail)
  VALUES (verified.holder_id, verified.code, 'reserve', take, _channel || ' checkout');

  RETURN QUERY SELECT
    verified.holder_id, verified.holder_name, verified.code, take, _reservation_token;
END $$;

CREATE OR REPLACE FUNCTION public.attach_juror_voucher_reservation(
  _reservation_token uuid,
  _order_id uuid
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE redemption public.voucher_redemptions%ROWTYPE;
BEGIN
  UPDATE public.voucher_redemptions
  SET order_id = _order_id
  WHERE reservation_token = _reservation_token AND order_id IS NULL
  RETURNING * INTO redemption;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.voucher_events (holder_id, code, event, amount_cents, order_id, detail)
  SELECT redemption.holder_id, h.code, 'redeem', redemption.amount_cents, _order_id,
    'Reservation attached to paid/pending order'
  FROM public.voucher_holders h WHERE h.id = redemption.holder_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.release_juror_voucher_reservation(
  _reservation_token uuid,
  _reason text
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE redemption public.voucher_redemptions%ROWTYPE;
BEGIN
  DELETE FROM public.voucher_redemptions
  WHERE reservation_token = _reservation_token AND order_id IS NULL
  RETURNING * INTO redemption;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.voucher_events (holder_id, code, event, amount_cents, detail)
  SELECT redemption.holder_id, h.code, 'release', redemption.amount_cents,
    left(COALESCE(NULLIF(trim(_reason), ''), 'checkout failed'), 300)
  FROM public.voucher_holders h WHERE h.id = redemption.holder_id;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.reserve_juror_voucher(text, text, integer, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attach_juror_voucher_reservation(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_juror_voucher_reservation(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_juror_voucher(text, text, integer, uuid, text),
  public.attach_juror_voucher_reservation(uuid, uuid),
  public.release_juror_voucher_reservation(uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.prepare_counter_order_secure(
  _idempotency_key uuid,
  _shift_id uuid,
  _customer_name text,
  _order_type text,
  _table_number text,
  _terminal text,
  _voucher_code text,
  _voucher_pin text,
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
DECLARE verified record;
BEGIN
  IF NULLIF(trim(_voucher_code), '') IS NOT NULL THEN
    SELECT * INTO verified
    FROM public.verify_juror_voucher_credentials(_voucher_code, _voucher_pin)
    LIMIT 1;
    IF NOT FOUND OR verified.status <> 'ok' THEN
      RAISE EXCEPTION 'Voucher code or PIN is invalid, locked or unavailable today';
    END IF;
  END IF;

  RETURN QUERY SELECT * FROM public.prepare_counter_order(
    _idempotency_key, _shift_id, _customer_name, _order_type, _table_number,
    _terminal, _voucher_code, _payment_mode, _manual_card_reference, _items
  );
END $$;

REVOKE ALL ON FUNCTION public.prepare_counter_order(
  uuid, uuid, text, text, text, text, text, text, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_counter_order(
  uuid, uuid, text, text, text, text, text, text, text, jsonb
) TO service_role;
REVOKE ALL ON FUNCTION public.prepare_counter_order_secure(
  uuid, uuid, text, text, text, text, text, text, text, text, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_counter_order_secure(
  uuid, uuid, text, text, text, text, text, text, text, text, jsonb
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cafe1_manage_juror_voucher(
  _holder_id uuid,
  _action text,
  _working_days integer DEFAULT 0,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid;
  h public.voucher_holders%ROWTYPE;
  next_until date;
BEGIN
  actor := public.cafe1_assert_operator(true);
  IF length(trim(COALESCE(_reason, ''))) < 4 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT * INTO h FROM public.voucher_holders WHERE id = _holder_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voucher not found'; END IF;

  IF _action = 'deactivate' THEN
    UPDATE public.voucher_holders SET active = false, deactivated_at = now(), updated_at = now()
    WHERE id = h.id RETURNING * INTO h;
  ELSIF _action = 'reactivate' THEN
    IF _working_days < 1 OR _working_days > 60 THEN
      RAISE EXCEPTION 'Reactivation requires 1 to 60 working days';
    END IF;
    next_until := public.cafe1_add_court_working_days(
      GREATEST(CURRENT_DATE, COALESCE(h.valid_until + 1, CURRENT_DATE)), _working_days
    );
    UPDATE public.voucher_holders
    SET active = true, deactivated_at = NULL, valid_until = next_until, updated_at = now()
    WHERE id = h.id RETURNING * INTO h;
  ELSIF _action = 'extend' THEN
    IF _working_days < 1 OR _working_days > 60 THEN RAISE EXCEPTION 'Extend by 1 to 60 working days'; END IF;
    next_until := public.cafe1_add_court_working_days(
      GREATEST(CURRENT_DATE, COALESCE(h.valid_until + 1, CURRENT_DATE)), _working_days
    );
    UPDATE public.voucher_holders SET valid_until = next_until, updated_at = now()
    WHERE id = h.id RETURNING * INTO h;
  ELSE
    RAISE EXCEPTION 'Unsupported voucher action';
  END IF;

  INSERT INTO public.voucher_events (holder_id, code, event, detail, actor_id)
  VALUES (
    h.id, h.code, _action,
    trim(_reason) || CASE WHEN next_until IS NOT NULL THEN '; valid until ' || next_until ELSE '' END,
    actor
  );
  RETURN jsonb_build_object('id', h.id, 'code', h.code, 'active', h.active, 'valid_until', h.valid_until);
END $$;

REVOKE ALL ON FUNCTION public.cafe1_manage_juror_voucher(uuid, text, integer, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cafe1_manage_juror_voucher(uuid, text, integer, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cafe1_set_juror_daily_allowance(
  _holder_id uuid,
  _for_date date,
  _amount_cents integer,
  _reason text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid;
  h public.voucher_holders%ROWTYPE;
  allocation public.voucher_allocations%ROWTYPE;
BEGIN
  actor := public.cafe1_assert_operator(true);
  IF _amount_cents NOT IN (571, 1217) THEN
    RAISE EXCEPTION 'Allowance must be £5.71 or the approved over-10-hours rate of £12.17';
  END IF;
  IF length(trim(COALESCE(_reason, ''))) < 4 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  IF _for_date < CURRENT_DATE - 7 OR _for_date > CURRENT_DATE + 7 THEN
    RAISE EXCEPTION 'Allowance date is outside the permitted correction window';
  END IF;
  IF NOT public.is_court_working_day(_for_date) THEN RAISE EXCEPTION 'Not a court working day'; END IF;
  SELECT * INTO h FROM public.voucher_holders WHERE id = _holder_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voucher not found'; END IF;

  INSERT INTO public.voucher_allocations (holder_id, for_date, amount_cents, notes)
  VALUES (h.id, _for_date, _amount_cents, trim(_reason))
  ON CONFLICT (holder_id, for_date) DO UPDATE
  SET amount_cents = EXCLUDED.amount_cents, notes = EXCLUDED.notes, updated_at = now()
  RETURNING * INTO allocation;

  INSERT INTO public.voucher_events (holder_id, code, event, amount_cents, detail, actor_id)
  VALUES (h.id, h.code, 'daily_allowance_set', _amount_cents,
    _for_date || ': ' || trim(_reason), actor);

  RETURN jsonb_build_object(
    'holder_id', h.id, 'for_date', allocation.for_date,
    'amount_cents', allocation.amount_cents
  );
END $$;

REVOKE ALL ON FUNCTION public.cafe1_set_juror_daily_allowance(uuid, date, integer, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cafe1_set_juror_daily_allowance(uuid, date, integer, text)
  TO authenticated, service_role;

-- One rotating room challenge may be consumed once by each voucher during its
-- short lifetime. This supports a room of jurors without making the QR reusable
-- by the same voucher or valid after the 90-second window.
CREATE OR REPLACE FUNCTION public.cafe1_consume_juror_challenge_v2(
  _token_hash text,
  _voucher_code text,
  _voucher_pin text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  challenge public.juror_attendance_challenges%ROWTYPE;
  verified record;
BEGIN
  SELECT * INTO challenge FROM public.juror_attendance_challenges
  WHERE token_hash = _token_hash AND expires_at > now()
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'This attendance QR has expired.');
  END IF;

  SELECT * INTO verified
  FROM public.verify_juror_voucher_credentials(_voucher_code, _voucher_pin)
  LIMIT 1;
  IF NOT FOUND OR verified.status <> 'ok' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Voucher code or PIN not accepted.');
  END IF;

  INSERT INTO public.juror_attendance_consumptions (challenge_id, holder_id)
  VALUES (challenge.id, verified.holder_id)
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'This voucher already used this attendance QR.');
  END IF;

  INSERT INTO public.juror_daily_presence (holder_id, for_date, room, challenge_id)
  VALUES (verified.holder_id, CURRENT_DATE, challenge.room, challenge.id)
  ON CONFLICT (holder_id, for_date) DO UPDATE
  SET room = EXCLUDED.room, challenge_id = EXCLUDED.challenge_id, verified_at = now();

  INSERT INTO public.voucher_events (holder_id, code, event, detail)
  VALUES (verified.holder_id, verified.code, 'attendance_verified', 'Room: ' || challenge.room);

  RETURN jsonb_build_object(
    'ok', true,
    'room', challenge.room,
    'verified_until', (CURRENT_DATE + 1)::timestamptz
  );
END $$;

REVOKE ALL ON FUNCTION public.cafe1_consume_juror_challenge(text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.cafe1_consume_juror_challenge_v2(text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cafe1_consume_juror_challenge_v2(text, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_juror_claim_rows(_from date, _to date)
RETURNS TABLE(
  redemption_id uuid,
  holder_id uuid,
  for_date date,
  amount_cents integer,
  redeemed_at timestamptz,
  order_id uuid,
  order_number integer,
  voucher_code text,
  batch text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    r.id, r.holder_id, r.for_date, r.amount_cents, r.created_at,
    r.order_id, o.order_number, h.code, h.batch
  FROM public.voucher_redemptions r
  JOIN public.orders o ON o.id = r.order_id
  JOIN public.voucher_holders h ON h.id = r.holder_id
  WHERE r.for_date BETWEEN _from AND _to
    AND o.payment_status IN ('paid', 'on_account')
    AND o.status NOT IN ('cancelled', 'refunded')
  ORDER BY r.created_at;
$$;

REVOKE ALL ON FUNCTION public.get_juror_claim_rows(date, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_juror_claim_rows(date, date) TO service_role;