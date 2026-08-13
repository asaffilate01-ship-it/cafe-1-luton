CREATE TABLE public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home',
  company_name text,
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  postcode text NOT NULL,
  delivery_notes text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers manage their own addresses"
ON public.customer_addresses FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE INDEX customer_addresses_user_idx ON public.customer_addresses(user_id);

CREATE TRIGGER customer_addresses_set_updated_at
BEFORE UPDATE ON public.customer_addresses
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tip_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_redeemed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_discount_cents integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.spend_loyalty_points(_user_id uuid, _points integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
BEGIN
  IF _points IS NULL OR _points <= 0 THEN
    RETURN false;
  END IF;
  UPDATE public.profiles
     SET loyalty_points = loyalty_points - _points
   WHERE id = _user_id
     AND loyalty_points >= _points
  RETURNING true INTO _ok;
  RETURN COALESCE(_ok, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_loyalty_points(_user_id uuid, _points integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _points IS NULL OR _points <= 0 THEN
    RETURN false;
  END IF;
  UPDATE public.profiles
     SET loyalty_points = loyalty_points + _points
   WHERE id = _user_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.spend_loyalty_points(uuid, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_loyalty_points(uuid, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_loyalty_points(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_loyalty_points(uuid, integer) TO service_role;