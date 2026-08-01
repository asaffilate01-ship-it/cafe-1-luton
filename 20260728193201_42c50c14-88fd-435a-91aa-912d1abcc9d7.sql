-- ============ 1. Voucher holders: full scheme metadata ============
ALTER TABLE public.voucher_holders
  ADD COLUMN IF NOT EXISTS batch text,
  ADD COLUMN IF NOT EXISTS valid_from date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS valid_until date,
  ADD COLUMN IF NOT EXISTS daily_amount_cents integer NOT NULL DEFAULT 571,
  ADD COLUMN IF NOT EXISTS opted_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS opt_in_source text,
  ADD COLUMN IF NOT EXISTS jury_room text,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

UPDATE public.voucher_holders SET valid_until = CURRENT_DATE + 21 WHERE valid_until IS NULL;

-- ============ 2. Menu flags ============
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS is_beverage boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS juror_menu boolean NOT NULL DEFAULT false;

UPDATE public.menu_items mi SET is_beverage = true
  FROM public.menu_categories c
 WHERE mi.category_id = c.id
   AND (c.name ILIKE '%drink%' OR c.name ILIKE '%coffee%' OR c.name ILIKE '%tea%'
        OR c.name ILIKE '%beverage%' OR c.name ILIKE '%smoothie%' OR c.name ILIKE '%shake%'
        OR c.name ILIKE '%mocktail%' OR c.name ILIKE '%juice%');

-- ============ 3. Orders: jury room + juror discount ============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS jury_room text,
  ADD COLUMN IF NOT EXISTS juror_discount_cents integer NOT NULL DEFAULT 0;

-- ============ 4. Audit trail ============
CREATE TABLE IF NOT EXISTS public.voucher_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_id uuid REFERENCES public.voucher_holders(id) ON DELETE CASCADE,
  code text NOT NULL,
  event text NOT NULL,
  amount_cents integer,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.voucher_events TO authenticated;
GRANT ALL ON public.voucher_events TO service_role;
ALTER TABLE public.voucher_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read voucher events" ON public.voucher_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

CREATE INDEX IF NOT EXISTS voucher_events_holder_idx ON public.voucher_events (holder_id, created_at DESC);

-- ============ 5. Working-day helper ============
CREATE OR REPLACE FUNCTION public.is_court_working_day(_d date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT extract(isodow FROM _d) <= 5
     AND NOT EXISTS (SELECT 1 FROM public.bank_holidays b WHERE b.holiday_date = _d)
$$;
REVOKE EXECUTE ON FUNCTION public.is_court_working_day(date) FROM anon, authenticated;

-- ============ 6. Balance lookup (auto daily allowance) ============
DROP FUNCTION IF EXISTS public.get_voucher_balance_by_code(text);
CREATE OR REPLACE FUNCTION public.get_voucher_balance_by_code(_code text)
RETURNS TABLE(
  holder_id uuid, holder_name text, code text,
  allocated_cents integer, used_cents integer, remaining_cents integer,
  valid_from date, valid_until date, opted_in boolean,
  jury_room text, status text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  h public.voucher_holders%ROWTYPE;
  alloc integer := 0;
  used integer := 0;
  st text := 'ok';
BEGIN
  IF _code IS NULL OR trim(_code) = '' THEN RETURN; END IF;
  SELECT * INTO h FROM public.voucher_holders v
   WHERE upper(v.code) = upper(trim(_code)) LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  IF h.active IS NOT TRUE THEN st := 'inactive';
  ELSIF CURRENT_DATE < h.valid_from THEN st := 'not_started';
  ELSIF h.valid_until IS NOT NULL AND CURRENT_DATE > h.valid_until THEN st := 'expired';
  ELSIF NOT public.is_court_working_day(CURRENT_DATE) THEN st := 'non_sitting_day';
  END IF;

  IF st = 'ok' THEN
    SELECT a.amount_cents INTO alloc FROM public.voucher_allocations a
      WHERE a.holder_id = h.id AND a.for_date = CURRENT_DATE LIMIT 1;
    IF alloc IS NULL THEN alloc := h.daily_amount_cents; END IF;
  END IF;

  SELECT COALESCE(SUM(r.amount_cents),0)::int INTO used
    FROM public.voucher_redemptions r
   WHERE r.holder_id = h.id AND r.for_date = CURRENT_DATE;

  RETURN QUERY SELECT h.id, h.name, h.code,
    COALESCE(alloc,0), COALESCE(used,0), GREATEST(COALESCE(alloc,0) - COALESCE(used,0), 0),
    h.valid_from, h.valid_until, (h.opted_in_at IS NOT NULL), h.jury_room, st;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_voucher_balance_by_code(text) FROM anon, authenticated;

-- ============ 7. Opt-in ============
CREATE OR REPLACE FUNCTION public.opt_in_voucher(_code text, _source text)
RETURNS TABLE(ok boolean, message text, already boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h public.voucher_holders%ROWTYPE;
BEGIN
  SELECT * INTO h FROM public.voucher_holders v WHERE upper(v.code) = upper(trim(_code)) LIMIT 1;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'Code not recognised', false; RETURN; END IF;
  IF h.active IS NOT TRUE THEN RETURN QUERY SELECT false, 'This code is no longer active', false; RETURN; END IF;
  IF h.valid_until IS NOT NULL AND CURRENT_DATE > h.valid_until THEN
    RETURN QUERY SELECT false, 'This code has expired', false; RETURN; END IF;
  IF h.opted_in_at IS NOT NULL THEN
    RETURN QUERY SELECT true, 'Already opted in', true; RETURN; END IF;
  UPDATE public.voucher_holders
     SET opted_in_at = now(), opt_in_source = COALESCE(_source,'till'), updated_at = now()
   WHERE id = h.id;
  INSERT INTO public.voucher_events (holder_id, code, event, detail)
  VALUES (h.id, h.code, 'opt_in', COALESCE(_source,'till'));
  RETURN QUERY SELECT true, 'Opted into the juror voucher scheme', false;
END $$;
REVOKE EXECUTE ON FUNCTION public.opt_in_voucher(text, text) FROM anon, authenticated;

-- ============ 8. Redemption with auto allocation + audit ============
CREATE OR REPLACE FUNCTION public.redeem_voucher(_holder_id uuid, _order_id uuid, _amount_cents integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  h public.voucher_holders%ROWTYPE;
  alloc public.voucher_allocations%ROWTYPE;
  amount int;
  used int;
  remaining int;
  take int;
BEGIN
  SELECT * INTO h FROM public.voucher_holders WHERE id = _holder_id FOR UPDATE;
  IF NOT FOUND OR h.active IS NOT TRUE THEN RETURN 0; END IF;
  IF CURRENT_DATE < h.valid_from THEN RETURN 0; END IF;
  IF h.valid_until IS NOT NULL AND CURRENT_DATE > h.valid_until THEN RETURN 0; END IF;
  IF NOT public.is_court_working_day(CURRENT_DATE) THEN RETURN 0; END IF;

  SELECT * INTO alloc FROM public.voucher_allocations
   WHERE holder_id = _holder_id AND for_date = CURRENT_DATE FOR UPDATE;
  IF FOUND THEN
    amount := alloc.amount_cents;
  ELSE
    amount := h.daily_amount_cents;
    INSERT INTO public.voucher_allocations (holder_id, for_date, amount_cents, notes)
    VALUES (_holder_id, CURRENT_DATE, amount, 'auto daily allowance')
    RETURNING * INTO alloc;
  END IF;

  SELECT COALESCE(SUM(amount_cents),0)::int INTO used FROM public.voucher_redemptions
   WHERE holder_id = _holder_id AND for_date = CURRENT_DATE;
  remaining := GREATEST(amount - used, 0);
  take := LEAST(GREATEST(_amount_cents,0), remaining);
  IF take <= 0 THEN RETURN 0; END IF;

  INSERT INTO public.voucher_redemptions (holder_id, allocation_id, order_id, for_date, amount_cents)
  VALUES (_holder_id, alloc.id, _order_id, CURRENT_DATE, take);

  IF h.opted_in_at IS NULL THEN
    UPDATE public.voucher_holders SET opted_in_at = now(), opt_in_source = COALESCE(opt_in_source,'purchase'), updated_at = now()
     WHERE id = h.id;
    INSERT INTO public.voucher_events (holder_id, code, event, detail)
    VALUES (h.id, h.code, 'opt_in', 'first purchase');
  END IF;

  INSERT INTO public.voucher_events (holder_id, code, event, amount_cents, order_id)
  VALUES (h.id, h.code, 'redeem', take, _order_id);

  RETURN take;
END $$;
REVOKE EXECUTE ON FUNCTION public.redeem_voucher(uuid, uuid, integer) FROM anon, authenticated;