-- Hide internal cost data from public/menu clients via column-level privileges
REVOKE SELECT ON public.menu_items FROM anon, authenticated;
GRANT SELECT (id, category_id, name, description, price_cents, image_url, active, is_veg, sort_order, created_at, updated_at, group_label, loyalty_drink, needs_cooking, is_beverage, juror_menu, site_id, barcode, allergens, dietary_tags, prep_seconds, station_code, portion_note) ON public.menu_items TO anon, authenticated;

-- Restrict court staff discount domain list to admins/staff only
DROP POLICY IF EXISTS "Signed-in users can read domains" ON public.court_staff_domains;