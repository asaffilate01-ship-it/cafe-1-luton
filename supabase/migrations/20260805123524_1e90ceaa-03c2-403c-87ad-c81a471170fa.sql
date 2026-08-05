CREATE TABLE public.integration_status (
  key text PRIMARY KEY,
  healthy boolean NOT NULL DEFAULT true,
  detail text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.integration_status TO authenticated;
GRANT ALL ON public.integration_status TO service_role;
ALTER TABLE public.integration_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view integration status"
  ON public.integration_status FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));