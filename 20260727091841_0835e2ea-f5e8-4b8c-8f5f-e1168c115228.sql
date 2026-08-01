DELETE FROM public.menu_modifiers
WHERE group_name = 'Choose your flavour'
  AND category_id = (SELECT id FROM public.menu_categories WHERE name = 'Mocktails');

INSERT INTO public.menu_modifiers (category_id, name, price_cents, sort_order, active, group_name, group_type, required)
SELECT c.id, f.name, 0, f.ord, true, 'Choose your flavour', 'single', true
FROM public.menu_categories c
CROSS JOIN (VALUES ('Strawberry Bliss',1),('Green Apple',2),('Minty Refresh',3),('Mango Sunset',4)) AS f(name, ord)
WHERE c.name = 'Mocktails';