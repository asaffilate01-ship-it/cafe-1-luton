ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sumup_sale_key text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_sumup_sale_key_uniq
  ON public.orders (sumup_sale_key)
  WHERE sumup_sale_key IS NOT NULL;

COMMENT ON COLUMN public.orders.sumup_sale_key IS
  'Normalised SumUp client_transaction_id for one POS sale; trailing payment-part sequence removed.';