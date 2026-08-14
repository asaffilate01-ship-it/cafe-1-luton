-- 1. Approved email domains
CREATE TABLE public.court_staff_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.court_staff_domains TO authenticated;
GRANT ALL ON public.court_staff_domains TO service_role;
ALTER TABLE public.court_staff_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read domains" ON public.court_staff_domains
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage domains" ON public.court_staff_domains
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.court_staff_domains (domain) VALUES
  ('justice.gov.uk'), ('hmcts.net'), ('judiciary.uk'), ('cps.gov.uk');

-- 2. Court staff members
CREATE TABLE public.court_staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended')),
  discount_percent numeric(5,2),
  approved_by uuid,
  approved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.court_staff_members TO authenticated;
GRANT ALL ON public.court_staff_members TO service_role;
ALTER TABLE public.court_staff_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own record" ON public.court_staff_members
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage members" ON public.court_staff_members
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER court_staff_members_updated_at BEFORE UPDATE ON public.court_staff_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. Court delivery locations
CREATE TABLE public.court_delivery_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  building text NOT NULL DEFAULT '',
  postcode text NOT NULL DEFAULT 'AL1 3JU',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.court_delivery_locations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.court_delivery_locations TO authenticated;
GRANT ALL ON public.court_delivery_locations TO service_role;
ALTER TABLE public.court_delivery_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active locations" ON public.court_delivery_locations
  FOR SELECT USING (active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage locations" ON public.court_delivery_locations
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER court_delivery_locations_updated_at BEFORE UPDATE ON public.court_delivery_locations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.court_delivery_locations (label, building, sort_order) VALUES
  ('CC Floor 1', 'St Albans Crown Court', 10),
  ('CC Floor 2', 'St Albans Crown Court', 20),
  ('MAG Room 1', 'St Albans Magistrates'' Court', 30);

-- 4. Push notification registrations
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5. Settings + order columns
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS court_staff_discount_percent numeric(5,2) NOT NULL DEFAULT 10;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS court_location text,
  ADD COLUMN IF NOT EXISTS staff_discount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS staff_member_id uuid REFERENCES public.court_staff_members(id) ON DELETE SET NULL;

-- 6. Helper: approved court staff lookup (bypasses RLS safely)
CREATE OR REPLACE FUNCTION public.court_staff_profile(_user_id uuid)
RETURNS TABLE (id uuid, full_name text, email text, phone text, status text, discount_percent numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.full_name, m.email, m.phone, m.status,
         COALESCE(m.discount_percent, (SELECT s.court_staff_discount_percent FROM public.business_settings s LIMIT 1), 10)
  FROM public.court_staff_members m
  WHERE m.user_id = _user_id
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.court_staff_profile(uuid) TO authenticated, service_role;