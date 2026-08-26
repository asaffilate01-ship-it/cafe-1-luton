DO $$
DECLARE
  src uuid := 'cafe1000-0000-4000-8000-000000000001';
  tgt uuid := 'bc24b444-ffc2-4912-9b0a-143513df4f20';
BEGIN
  -- clear any existing target menu
  DELETE FROM public.menu_modifiers m
   WHERE (m.item_id IN (SELECT id FROM public.menu_items WHERE site_id = tgt))
      OR (m.category_id IN (SELECT id FROM public.menu_categories WHERE site_id = tgt));
  DELETE FROM public.menu_items WHERE site_id = tgt;
  DELETE FROM public.menu_categories WHERE site_id = tgt;

  CREATE TEMP TABLE cat_map (old_id uuid, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE item_map (old_id uuid, new_id uuid) ON COMMIT DROP;

  WITH ins AS (
    INSERT INTO public.menu_categories (id, name, description, sort_order, active, site_id)
    SELECT gen_random_uuid(), c.name, c.description, c.sort_order, c.active, tgt
    FROM public.menu_categories c
    WHERE c.site_id = src
    RETURNING id, name
  )
  INSERT INTO cat_map (old_id, new_id)
  SELECT c.id, ins.id FROM public.menu_categories c JOIN ins ON ins.name = c.name
  WHERE c.site_id = src;

  WITH ins AS (
    INSERT INTO public.menu_items (
      id, category_id, name, description, price_cents, image_url, active, is_veg, sort_order,
      group_label, loyalty_drink, needs_cooking, is_beverage, juror_menu, site_id, barcode,
      allergens, dietary_tags, cost_cents, prep_seconds, station_code, portion_note)
    SELECT gen_random_uuid(), cm.new_id, i.name, i.description, i.price_cents, i.image_url, i.active,
           i.is_veg, i.sort_order, i.group_label, i.loyalty_drink, i.needs_cooking, i.is_beverage,
           i.juror_menu, tgt, NULL, i.allergens, i.dietary_tags, i.cost_cents, i.prep_seconds,
           i.station_code, i.portion_note
    FROM public.menu_items i
    JOIN cat_map cm ON cm.old_id = i.category_id
    WHERE i.site_id = src
    RETURNING id, category_id, name
  )
  INSERT INTO item_map (old_id, new_id)
  SELECT i.id, ins.id
  FROM public.menu_items i
  JOIN cat_map cm ON cm.old_id = i.category_id
  JOIN ins ON ins.name = i.name AND ins.category_id = cm.new_id
  WHERE i.site_id = src;

  INSERT INTO public.menu_modifiers (
    id, category_id, item_id, name, description, price_cents, sort_order, active,
    group_name, group_type, required, min_selections, max_selections, is_exclusive, is_veg)
  SELECT gen_random_uuid(), cm.new_id, im.new_id, m.name, m.description, m.price_cents, m.sort_order,
         m.active, m.group_name, m.group_type, m.required, m.min_selections, m.max_selections,
         m.is_exclusive, m.is_veg
  FROM public.menu_modifiers m
  LEFT JOIN cat_map cm ON cm.old_id = m.category_id
  LEFT JOIN item_map im ON im.old_id = m.item_id
  WHERE (m.category_id IS NOT NULL AND cm.new_id IS NOT NULL)
     OR (m.item_id IS NOT NULL AND im.new_id IS NOT NULL);
END $$;