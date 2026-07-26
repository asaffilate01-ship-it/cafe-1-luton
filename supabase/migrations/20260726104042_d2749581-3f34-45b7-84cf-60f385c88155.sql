CREATE TABLE public.voucher_holders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voucher_holders TO authenticated;
GRANT ALL ON public.voucher_holders TO service_role;
ALTER TABLE public.voucher_holders ENABLE ROW LEVEL SECURITY;
CREATE POLICY voucher_holders_staff_all ON public.voucher_holders FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'));
CREATE UNIQUE INDEX voucher_holders_email_uniq ON public.voucher_holders (lower(trim(email))) WHERE email IS NOT NULL AND trim(email) <> '';
CREATE UNIQUE INDEX voucher_holders_phone_uniq ON public.voucher_holders (regexp_replace(phone,'[^0-9]','','g')) WHERE phone IS NOT NULL AND trim(phone) <> '';
CREATE TRIGGER voucher_holders_updated BEFORE UPDATE ON public.voucher_holders FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.voucher_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_id uuid NOT NULL REFERENCES public.voucher_holders(id) ON DELETE CASCADE,
  for_date date NOT NULL DEFAULT CURRENT_DATE,
  amount_cents integer NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (holder_id, for_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voucher_allocations TO authenticated;
GRANT ALL ON public.voucher_allocations TO service_role;
ALTER TABLE public.voucher_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY voucher_allocations_staff_all ON public.voucher_allocations FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'));
CREATE TRIGGER voucher_allocations_updated BEFORE UPDATE ON public.voucher_allocations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.voucher_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_id uuid NOT NULL REFERENCES public.voucher_holders(id) ON DELETE CASCADE,
  allocation_id uuid REFERENCES public.voucher_allocations(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  for_date date NOT NULL DEFAULT CURRENT_DATE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voucher_redemptions TO authenticated;
GRANT ALL ON public.voucher_redemptions TO service_role;
ALTER TABLE public.voucher_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY voucher_redemptions_staff_all ON public.voucher_redemptions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'));
CREATE INDEX voucher_redemptions_date_idx ON public.voucher_redemptions (for_date);

ALTER TABLE public.orders
  ADD COLUMN voucher_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN voucher_holder_id uuid REFERENCES public.voucher_holders(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.get_voucher_balance(_email text, _phone text)
RETURNS TABLE(holder_id uuid, holder_name text, allocated_cents integer, used_cents integer, remaining_cents integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT h.id,
         h.name,
         COALESCE(a.amount_cents,0),
         COALESCE((SELECT SUM(r.amount_cents)::int FROM public.voucher_redemptions r
                    WHERE r.holder_id = h.id AND r.for_date = CURRENT_DATE),0),
         GREATEST(COALESCE(a.amount_cents,0) - COALESCE((SELECT SUM(r.amount_cents)::int FROM public.voucher_redemptions r
                    WHERE r.holder_id = h.id AND r.for_date = CURRENT_DATE),0), 0)
    FROM public.voucher_holders h
    LEFT JOIN public.voucher_allocations a ON a.holder_id = h.id AND a.for_date = CURRENT_DATE
   WHERE h.active = true
     AND (
       (_email IS NOT NULL AND trim(_email) <> '' AND lower(trim(h.email)) = lower(trim(_email)))
       OR (_phone IS NOT NULL AND regexp_replace(_phone,'[^0-9]','','g') <> ''
           AND regexp_replace(h.phone,'[^0-9]','','g') = regexp_replace(_phone,'[^0-9]','','g'))
     )
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.redeem_voucher(_holder_id uuid, _order_id uuid, _amount_cents integer)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  alloc public.voucher_allocations%ROWTYPE;
  used int;
  remaining int;
  take int;
BEGIN
  SELECT * INTO alloc FROM public.voucher_allocations
   WHERE holder_id = _holder_id AND for_date = CURRENT_DATE FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;
  SELECT COALESCE(SUM(amount_cents),0)::int INTO used FROM public.voucher_redemptions
   WHERE holder_id = _holder_id AND for_date = CURRENT_DATE;
  remaining := GREATEST(alloc.amount_cents - used, 0);
  take := LEAST(GREATEST(_amount_cents,0), remaining);
  IF take <= 0 THEN RETURN 0; END IF;
  INSERT INTO public.voucher_redemptions (holder_id, allocation_id, order_id, for_date, amount_cents)
  VALUES (_holder_id, alloc.id, _order_id, CURRENT_DATE, take);
  RETURN take;
END $$;