
-- New payment status value for tab orders
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'on_account';

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text,
  contact_email text,
  contact_phone text,
  access_code text NOT NULL UNIQUE,
  credit_limit_cents integer,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounts_staff_all ON public.accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Link orders to a tab account
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_account_id_idx ON public.orders(account_id);

-- Public code-verification RPC: returns matching account id+name, or nothing.
-- SECURITY DEFINER so anon/guest checkout can call it without exposing the whole table.
CREATE OR REPLACE FUNCTION public.verify_account_code(_code text)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.name FROM public.accounts a
   WHERE a.active = true AND upper(a.access_code) = upper(_code)
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.verify_account_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_account_code(text) TO anon, authenticated;
