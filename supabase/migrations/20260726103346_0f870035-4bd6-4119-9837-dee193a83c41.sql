CREATE TABLE public.customer_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  percent integer NOT NULL DEFAULT 10,
  label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_discounts_percent_range CHECK (percent > 0 AND percent <= 100)
);

CREATE UNIQUE INDEX customer_discounts_email_key ON public.customer_discounts (lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_discounts TO authenticated;
GRANT ALL ON public.customer_discounts TO service_role;

ALTER TABLE public.customer_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_discounts_staff_all ON public.customer_discounts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE TRIGGER customer_discounts_set_updated_at
  BEFORE UPDATE ON public.customer_discounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Lets the ordering flow (including guests) check only whether a given email
-- has a discount, without exposing the customer list.
CREATE OR REPLACE FUNCTION public.get_customer_discount(_email text)
RETURNS TABLE(percent integer, label text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.percent, d.label
  FROM public.customer_discounts d
  WHERE d.active = true
    AND lower(d.email) = lower(trim(_email))
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_discount(text) TO anon, authenticated, service_role;