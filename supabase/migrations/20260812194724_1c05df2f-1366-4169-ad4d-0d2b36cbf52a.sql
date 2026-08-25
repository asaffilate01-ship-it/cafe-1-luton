CREATE OR REPLACE VIEW public.menu_items_public
WITH (security_invoker = false) AS
SELECT id, category_id, name, description, price_cents, image_url, active,
       is_veg, sort_order, group_label, loyalty_drink, needs_cooking,
       is_beverage, juror_menu, site_id, allergens, dietary_tags,
       created_at, updated_at
FROM public.menu_items;

GRANT SELECT ON public.menu_items_public TO anon, authenticated;
GRANT SELECT ON public.menu_items_public TO service_role;

DROP POLICY IF EXISTS items_public_read ON public.menu_items;
CREATE POLICY items_staff_read ON public.menu_items
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));