
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS schedule_mode text NOT NULL DEFAULT 'asap',
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS table_number text;
