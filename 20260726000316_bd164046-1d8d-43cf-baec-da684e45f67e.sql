ALTER TABLE public.menu_modifiers
  ADD COLUMN IF NOT EXISTS group_name text,
  ADD COLUMN IF NOT EXISTS group_type text NOT NULL DEFAULT 'multi',
  ADD COLUMN IF NOT EXISTS required boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE public.menu_modifiers ADD CONSTRAINT menu_modifiers_group_type_chk CHECK (group_type IN ('single','multi'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Rename Mojitos -> Mocktails
UPDATE public.menu_categories SET name = 'Mocktails' WHERE name = 'Mojitos';
UPDATE public.menu_items SET name = 'Mocktail' WHERE name = 'Mojitos';
UPDATE public.menu_items SET name = 'Red Bull Mocktail' WHERE name = 'Red Bull Mojito';

-- Group existing modifiers sensibly
UPDATE public.menu_modifiers SET group_name = 'Choose your filling', group_type = 'multi'
  WHERE category_id = (SELECT id FROM public.menu_categories WHERE name = 'Jackets');
UPDATE public.menu_modifiers SET group_name = 'Make it a meal' WHERE name ILIKE 'make it a meal';
UPDATE public.menu_modifiers SET group_name = 'Extras' WHERE group_name IS NULL;

-- Flavour choice for Mocktails
INSERT INTO public.menu_modifiers (category_id, name, price_cents, sort_order, active, group_name, group_type, required)
SELECT c.id, f.name, 0, f.ord, true, 'Choose your flavour', 'single', true
FROM public.menu_categories c
CROSS JOIN (VALUES
  ('Classic Mint & Lime',1),('Strawberry',2),('Passion Fruit',3),('Mango',4),
  ('Blue Lagoon',5),('Watermelon',6),('Peach',7),('Raspberry',8)
) AS f(name, ord)
WHERE c.name = 'Mocktails'
AND NOT EXISTS (
  SELECT 1 FROM public.menu_modifiers m WHERE m.category_id = c.id AND m.group_name = 'Choose your flavour' AND m.name = f.name
);

-- Flavour choice for iced drinks (optional single pick)
INSERT INTO public.menu_modifiers (category_id, name, price_cents, sort_order, active, group_name, group_type, required)
SELECT c.id, f.name, 0, f.ord, true, 'Choose your syrup', 'single', false
FROM public.menu_categories c
CROSS JOIN (VALUES
  ('Vanilla',1),('Caramel',2),('Hazelnut',3),('Chocolate',4)
) AS f(name, ord)
WHERE c.name IN ('Iced Coffee','Iced Matcha Latte')
AND NOT EXISTS (
  SELECT 1 FROM public.menu_modifiers m WHERE m.category_id = c.id AND m.group_name = 'Choose your syrup' AND m.name = f.name
);