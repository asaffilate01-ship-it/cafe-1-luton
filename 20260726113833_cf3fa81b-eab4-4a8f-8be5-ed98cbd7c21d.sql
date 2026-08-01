ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pos_terminal text;

CREATE TABLE IF NOT EXISTS public.pos_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_ref text NOT NULL UNIQUE,
  name text NOT NULL,
  side text NOT NULL CHECK (side IN ('jury','public')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_devices TO authenticated;
GRANT ALL ON public.pos_devices TO service_role;

ALTER TABLE public.pos_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage pos devices" ON public.pos_devices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

CREATE TRIGGER pos_devices_set_updated_at BEFORE UPDATE ON public.pos_devices
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();