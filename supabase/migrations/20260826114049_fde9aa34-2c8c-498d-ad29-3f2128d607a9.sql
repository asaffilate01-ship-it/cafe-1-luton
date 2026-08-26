ALTER TABLE public.business_hours
  ADD COLUMN IF NOT EXISTS site_id uuid NOT NULL
  DEFAULT 'cafe1000-0000-4000-8000-000000000001'::uuid
  REFERENCES public.sites(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS business_hours_site_day_key
  ON public.business_hours (site_id, day_of_week);

CREATE INDEX IF NOT EXISTS business_hours_site_idx
  ON public.business_hours (site_id);