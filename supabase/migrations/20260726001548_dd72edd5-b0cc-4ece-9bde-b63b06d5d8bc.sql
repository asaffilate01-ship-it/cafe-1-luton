
-- Business settings (singleton)
CREATE TABLE public.business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Cafe1',
  accepting_orders boolean NOT NULL DEFAULT true,
  allow_preorder_when_closed boolean NOT NULL DEFAULT true,
  prep_minutes int NOT NULL DEFAULT 20,
  delivery_minutes int NOT NULL DEFAULT 15,
  min_order_cents int NOT NULL DEFAULT 0,
  delivery_fee_cents int NOT NULL DEFAULT 299,
  free_delivery_threshold_cents int,
  closed_message text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.business_settings TO anon, authenticated;
GRANT ALL ON public.business_settings TO service_role;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY biz_read ON public.business_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY biz_write ON public.business_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

INSERT INTO public.business_settings (name) VALUES ('Cafe1');

-- Business hours (one row per day 0=Sun..6=Sat)
CREATE TABLE public.business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week int NOT NULL UNIQUE CHECK (day_of_week BETWEEN 0 AND 6),
  open_time time NOT NULL DEFAULT '07:00',
  close_time time NOT NULL DEFAULT '18:00',
  closed boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.business_hours TO anon, authenticated;
GRANT ALL ON public.business_hours TO service_role;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY hours_read ON public.business_hours FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY hours_write ON public.business_hours FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

INSERT INTO public.business_hours (day_of_week, open_time, close_time, closed) VALUES
  (0, '08:00', '17:00', false),
  (1, '07:00', '18:00', false),
  (2, '07:00', '18:00', false),
  (3, '07:00', '18:00', false),
  (4, '07:00', '18:00', false),
  (5, '07:00', '19:00', false),
  (6, '08:00', '18:00', false);

-- Promo banners (large hero carousel)
CREATE TABLE public.promo_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  badge text,
  image_url text,
  bg_color text,
  cta_label text,
  cta_url text,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promo_banners TO anon, authenticated;
GRANT ALL ON public.promo_banners TO service_role;
ALTER TABLE public.promo_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY banners_public_read ON public.promo_banners FOR SELECT TO anon, authenticated USING (
  active = true
  AND (starts_at IS NULL OR starts_at <= now())
  AND (ends_at IS NULL OR ends_at >= now())
);
CREATE POLICY banners_staff_all ON public.promo_banners FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

-- Promo codes (secret; only staff can read directly)
DO $$ BEGIN
  CREATE TYPE public.promo_discount_type AS ENUM ('percent','fixed_amount','free_delivery');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type public.promo_discount_type NOT NULL DEFAULT 'percent',
  discount_value int NOT NULL DEFAULT 10,
  min_subtotal_cents int NOT NULL DEFAULT 0,
  max_uses int,
  uses int NOT NULL DEFAULT 0,
  first_order_only boolean NOT NULL DEFAULT false,
  applies_to text NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all','delivery','collection','dine_in')),
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
-- Only staff/admin can see or edit codes directly. Validation for customers goes through a security-definer function.
CREATE POLICY promo_staff_all ON public.promo_codes FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

-- Add promo tracking + fees on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS promo_discount_cents int NOT NULL DEFAULT 0;

-- Public validation function (no direct read of promo_codes needed by clients)
CREATE OR REPLACE FUNCTION public.validate_promo_code(
  _code text, _subtotal_cents int, _order_type text
) RETURNS TABLE (
  code text,
  discount_type public.promo_discount_type,
  discount_value int,
  discount_cents int,
  message text,
  valid boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.promo_codes%ROWTYPE;
  d int := 0;
BEGIN
  SELECT * INTO c FROM public.promo_codes WHERE upper(promo_codes.code) = upper(_code) LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT _code, 'percent'::public.promo_discount_type, 0, 0, 'Code not found', false; RETURN;
  END IF;
  IF c.active IS NOT TRUE THEN
    RETURN QUERY SELECT c.code, c.discount_type, c.discount_value, 0, 'Code is inactive', false; RETURN;
  END IF;
  IF c.starts_at IS NOT NULL AND c.starts_at > now() THEN
    RETURN QUERY SELECT c.code, c.discount_type, c.discount_value, 0, 'Code not active yet', false; RETURN;
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN QUERY SELECT c.code, c.discount_type, c.discount_value, 0, 'Code has expired', false; RETURN;
  END IF;
  IF c.max_uses IS NOT NULL AND c.uses >= c.max_uses THEN
    RETURN QUERY SELECT c.code, c.discount_type, c.discount_value, 0, 'Code usage limit reached', false; RETURN;
  END IF;
  IF _subtotal_cents < c.min_subtotal_cents THEN
    RETURN QUERY SELECT c.code, c.discount_type, c.discount_value, 0,
      'Minimum spend of £' || round(c.min_subtotal_cents/100.0,2) || ' required', false; RETURN;
  END IF;
  IF c.applies_to <> 'all' AND c.applies_to <> _order_type THEN
    RETURN QUERY SELECT c.code, c.discount_type, c.discount_value, 0,
      'Code only valid for ' || c.applies_to || ' orders', false; RETURN;
  END IF;

  IF c.discount_type = 'percent' THEN
    d := (_subtotal_cents * c.discount_value) / 100;
  ELSIF c.discount_type = 'fixed_amount' THEN
    d := LEAST(c.discount_value, _subtotal_cents);
  ELSE
    d := 0; -- free_delivery handled by caller
  END IF;

  RETURN QUERY SELECT c.code, c.discount_type, c.discount_value, d, NULL::text, true;
END $$;

GRANT EXECUTE ON FUNCTION public.validate_promo_code(text,int,text) TO anon, authenticated;

-- Increment usage counter (server-side call from order creator)
CREATE OR REPLACE FUNCTION public.increment_promo_use(_code text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.promo_codes SET uses = uses + 1 WHERE upper(code) = upper(_code);
$$;
GRANT EXECUTE ON FUNCTION public.increment_promo_use(text) TO anon, authenticated;

-- Seed a couple of banners and a welcome promo
INSERT INTO public.promo_banners (title, subtitle, badge, cta_label, cta_url, sort_order, bg_color) VALUES
  ('20% off breakfast', 'Every weekday before 11am — no code needed.', '20% OFF', 'Order breakfast', '/menu', 1, 'oklch(0.55 0.22 27)'),
  ('Free delivery over £15', 'Local delivery, hot and fast.', 'FREE DELIVERY', 'Start an order', '/menu', 2, 'oklch(0.32 0.02 40)');

INSERT INTO public.promo_codes (code, description, discount_type, discount_value, min_subtotal_cents, active)
VALUES ('WELCOME10', '10% off your first order', 'percent', 10, 500, true);
