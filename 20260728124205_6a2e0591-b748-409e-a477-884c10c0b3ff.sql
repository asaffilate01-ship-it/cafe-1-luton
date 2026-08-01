ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS delivery_open_time time NOT NULL DEFAULT '08:30',
  ADD COLUMN IF NOT EXISTS delivery_close_time time NOT NULL DEFAULT '16:30',
  ADD COLUMN IF NOT EXISTS delivery_origin_postcode text NOT NULL DEFAULT 'AL1 3JW',
  ADD COLUMN IF NOT EXISTS delivery_radius_m integer NOT NULL DEFAULT 805;