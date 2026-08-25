ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS loyalty_drink boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS drink_stamps integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_drinks_available integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_drinks_redeemed integer NOT NULL DEFAULT 0;

UPDATE public.menu_items i
   SET loyalty_drink = true
  FROM public.menu_categories c
 WHERE c.id = i.category_id
   AND c.name IN ('Hot Drinks');