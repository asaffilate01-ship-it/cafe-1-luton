DROP VIEW IF EXISTS public.menu_items_public;

DROP POLICY IF EXISTS items_staff_read ON public.menu_items;
CREATE POLICY items_public_read ON public.menu_items
  FOR SELECT TO anon, authenticated
  USING (true);

REVOKE SELECT ON public.menu_items FROM anon, authenticated;
GRANT SELECT (
  id, category_id, name, description, price_cents, image_url, active,
  is_veg, sort_order, group_label, loyalty_drink, needs_cooking,
  is_beverage, juror_menu, site_id, allergens, dietary_tags,
  created_at, updated_at
) ON public.menu_items TO anon, authenticated;
GRANT ALL ON public.menu_items TO service_role;