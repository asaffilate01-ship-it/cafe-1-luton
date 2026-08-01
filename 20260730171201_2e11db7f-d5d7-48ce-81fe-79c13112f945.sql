ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS sumup_order_ref text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_sumup_order_ref_key
  ON public.orders (sumup_order_ref) WHERE sumup_order_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_source_created_idx
  ON public.orders (source, created_at DESC);