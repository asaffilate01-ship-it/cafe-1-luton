CREATE TABLE public.account_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  method text NOT NULL DEFAULT 'bank_transfer',
  reference text,
  note text,
  recorded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX account_payments_account_idx ON public.account_payments(account_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_payments TO authenticated;
GRANT ALL ON public.account_payments TO service_role;

ALTER TABLE public.account_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view account payments"
  ON public.account_payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff can record account payments"
  ON public.account_payments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins can update account payments"
  ON public.account_payments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete account payments"
  ON public.account_payments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER account_payments_updated_at
  BEFORE UPDATE ON public.account_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();