-- One SumUp POS sale can contain several payment transactions (for example
-- cash + card). Store the logical sale id separately so all payment parts map
-- to one order and one KDS ticket.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sumup_sale_key text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_sumup_sale_key_uniq
  ON public.orders (sumup_sale_key)
  WHERE sumup_sale_key IS NOT NULL;

COMMENT ON COLUMN public.orders.sumup_sale_key IS
  'Normalised SumUp client_transaction_id for one POS sale; trailing payment-part sequence removed.';
