-- Cafe 1 go-live release
-- Forward-only repair for postcode consistency, manager MFA and public menu data.

-- AL1 3JU is the confirmed operational/public postcode for Cafe 1.
UPDATE public.business_settings
SET delivery_origin_postcode = 'AL1 3JU', updated_at = now()
WHERE delivery_origin_postcode IS DISTINCT FROM 'AL1 3JU';

UPDATE public.sites
SET postcode = 'AL1 3JU', updated_at = now()
WHERE code = 'STALBANS' AND postcode IS DISTINCT FROM 'AL1 3JU';

-- Correct already-seeded public copy without requiring content to be re-created.
UPDATE public.blog_posts
SET
  excerpt = replace(excerpt, 'AL1 3JW', 'AL1 3JU'),
  body_md = replace(body_md, 'AL1 3JW', 'AL1 3JU'),
  updated_at = now()
WHERE excerpt LIKE '%AL1 3JW%' OR body_md LIKE '%AL1 3JW%';

-- Manager-only database actions must require an AAL2 access token. This closes
-- the direct PostgREST RPC path around the application-level MFA guard.
CREATE OR REPLACE FUNCTION public.cafe1_assert_operator(_admin_only boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _admin_only AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Manager approval required';
  END IF;

  IF _admin_only AND COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'Manager multi-factor authentication is required';
  END IF;

  IF NOT _admin_only AND NOT (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN auth.uid();
END $$;

REVOKE ALL ON FUNCTION public.cafe1_assert_operator(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cafe1_assert_operator(boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.cafe1_assert_operator(boolean) IS
  'Cafe 1 operator guard. Admin-only calls require an authenticated AAL2 JWT.';

-- Public/customer menu reads must not expose cost, barcode, preparation target,
-- station routing or internal portion notes. Staff surfaces fetch those fields
-- through an authenticated server function using the service role.
REVOKE SELECT ON public.menu_items FROM anon, authenticated;
GRANT SELECT (
  id,
  category_id,
  site_id,
  name,
  description,
  price_cents,
  image_url,
  active,
  is_veg,
  loyalty_drink,
  needs_cooking,
  juror_menu,
  is_beverage,
  group_label,
  allergens,
  dietary_tags,
  sort_order,
  created_at,
  updated_at
) ON public.menu_items TO anon, authenticated;
