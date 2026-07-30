ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS loyalty_stamps_pending integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_awarded boolean NOT NULL DEFAULT false;