CREATE TABLE public.driver_locations (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  heading double precision,
  speed double precision,
  accuracy double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.driver_locations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_locations TO authenticated;
GRANT ALL ON public.driver_locations TO service_role;

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Anyone with the order id can follow the driver while the order is actively out for delivery
CREATE POLICY "Live location visible while out for delivery"
ON public.driver_locations FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.id = driver_locations.order_id
    AND o.status = 'out_for_delivery'
));

CREATE POLICY "Drivers can publish their own location"
ON public.driver_locations FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = driver_id
  AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.driver_id = auth.uid())
);

CREATE POLICY "Drivers can update their own location"
ON public.driver_locations FOR UPDATE TO authenticated
USING (auth.uid() = driver_id)
WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers and admins can delete location"
ON public.driver_locations FOR DELETE TO authenticated
USING (auth.uid() = driver_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view all driver locations"
ON public.driver_locations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff') OR auth.uid() = driver_id);

CREATE TRIGGER driver_locations_set_updated_at
BEFORE UPDATE ON public.driver_locations
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
ALTER TABLE public.driver_locations REPLICA IDENTITY FULL;