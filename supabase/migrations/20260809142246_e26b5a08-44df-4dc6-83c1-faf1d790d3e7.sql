-- Phase 19: repair legacy Cafe 1 catalogue aliases and prevent active duplicates.
-- This migration is deliberately forward-only: historic order item references
-- remain intact because duplicate rows are deactivated, never deleted.

CREATE TEMP TABLE cafe1_phase19_site ON COMMIT DROP AS
SELECT id
FROM public.sites
WHERE code = 'STALBANS'
ORDER BY created_at, id
LIMIT 1;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM cafe1_phase19_site) THEN
    RAISE EXCEPTION 'Cafe 1 STALBANS site is required for catalogue repair';
  END IF;
END $$;

-- Merge legacy category labels into the canonical August 2026 catalogue.
CREATE TEMP TABLE cafe1_phase19_category_aliases (
  alias_name text PRIMARY KEY,
  canonical_name text NOT NULL
) ON COMMIT DROP;

INSERT INTO cafe1_phase19_category_aliases VALUES
  ('Cold Past Pot', 'Cold Pasta Pot'),
  ('Small Naan Rolls', 'Naan Rolls'),
  ('Chicken Nuggets', 'Nuggets'),
  ('Iced Matche Latte', 'Iced Matcha Latte'),
  ('Omlettes', 'Omelettes');

DO $$
DECLARE
  mapping record;
  legacy_category uuid;
  canonical_category uuid;
BEGIN
  FOR mapping IN SELECT * FROM cafe1_phase19_category_aliases LOOP
    SELECT category.id INTO legacy_category
    FROM public.menu_categories category
    JOIN cafe1_phase19_site site ON site.id = category.site_id
    WHERE lower(btrim(category.name)) = lower(mapping.alias_name)
    ORDER BY category.active DESC, category.sort_order, category.created_at, category.id
    LIMIT 1;

    SELECT category.id INTO canonical_category
    FROM public.menu_categories category
    JOIN cafe1_phase19_site site ON site.id = category.site_id
    WHERE lower(btrim(category.name)) = lower(mapping.canonical_name)
    ORDER BY category.active DESC, category.sort_order, category.created_at, category.id
    LIMIT 1;

    IF legacy_category IS NULL THEN
      CONTINUE;
    ELSIF canonical_category IS NULL THEN
      UPDATE public.menu_categories
      SET name = mapping.canonical_name
      WHERE id = legacy_category;
    ELSE
      -- The canonical seed already rebuilt its category-level options. Keeping
      -- legacy category options active would show the same choice twice.
      UPDATE public.menu_modifiers
      SET active = false
      WHERE category_id = legacy_category;

      UPDATE public.menu_items legacy_item
      SET active = false, updated_at = now()
      WHERE legacy_item.category_id = legacy_category
        AND EXISTS (
          SELECT 1
          FROM public.menu_items canonical_item
          WHERE canonical_item.category_id = canonical_category
            AND lower(btrim(canonical_item.name)) = lower(btrim(legacy_item.name))
        );

      UPDATE public.menu_items
      SET category_id = canonical_category, updated_at = now()
      WHERE category_id = legacy_category
        AND active = true;

      UPDATE public.menu_categories
      SET active = false
      WHERE id = legacy_category;
    END IF;
  END LOOP;
END $$;

-- Merge any exact duplicate active category rows left by historic imports.
DO $$
DECLARE
  duplicate record;
  losing_category uuid;
BEGIN
  FOR duplicate IN
    SELECT category.site_id,
           lower(btrim(category.name)) AS normalised_name,
           (array_agg(category.id ORDER BY category.sort_order, category.created_at, category.id))[1]
             AS keeper_id,
           (array_agg(category.id ORDER BY category.sort_order, category.created_at, category.id))[2:]
             AS loser_ids
    FROM public.menu_categories category
    WHERE category.active = true
    GROUP BY category.site_id, lower(btrim(category.name))
    HAVING count(*) > 1
  LOOP
    FOREACH losing_category IN ARRAY duplicate.loser_ids LOOP
      UPDATE public.menu_modifiers SET active = false WHERE category_id = losing_category;

      UPDATE public.menu_items losing_item
      SET active = false, updated_at = now()
      WHERE losing_item.category_id = losing_category
        AND EXISTS (
          SELECT 1 FROM public.menu_items keeper_item
          WHERE keeper_item.category_id = duplicate.keeper_id
            AND keeper_item.active = true
            AND lower(btrim(keeper_item.name)) = lower(btrim(losing_item.name))
        );

      UPDATE public.menu_items
      SET category_id = duplicate.keeper_id, updated_at = now()
      WHERE category_id = losing_category AND active = true;

      UPDATE public.menu_categories SET active = false WHERE id = losing_category;
    END LOOP;
  END LOOP;
END $$;

-- Known item aliases seen on the live catalogue. If the canonical seed exists,
-- the old row is retained for order history but removed from sale.
CREATE TEMP TABLE cafe1_phase19_item_aliases (
  category_name text NOT NULL,
  alias_name text NOT NULL,
  canonical_name text NOT NULL,
  PRIMARY KEY (category_name, alias_name)
) ON COMMIT DROP;

INSERT INTO cafe1_phase19_item_aliases VALUES
  ('Desi Breakfast', 'Paratha and chickpeas', 'Paratha and Chana (chickpeas)'),
  ('Desi Breakfast', 'Paratha Omelette and chickpeas', 'Paratha, Desi Omelette and Chana (chickpeas)'),
  ('Desi Breakfast', 'Paratha, Omelette and chickpeas', 'Paratha, Desi Omelette and Chana (chickpeas)'),
  ('Desi Breakfast', 'Paratha, Desi Omelette and chickpeas', 'Paratha, Desi Omelette and Chana (chickpeas)'),
  ('Omelettes', 'Plain Omlette', 'Plain Omelette'),
  ('Omelettes', 'Cheese & onion Omlette', 'Cheese and onion'),
  ('Omelettes', 'Cheese & Tomato Omlette', 'Cheese and tomato'),
  ('Omelettes', 'Chicken & Cheese Omlette', 'Chicken & cheese'),
  ('Omelettes', 'Desi Omlette', 'Desi Omelette'),
  ('Iced Matcha Latte', 'Iced Matche Latte', 'Iced Matcha Latte'),
  ('Sauces / Dips', 'Garlic mayoM', 'Garlic mayo');

DO $$
DECLARE
  mapping record;
  category_uuid uuid;
  legacy_item uuid;
  canonical_item uuid;
BEGIN
  FOR mapping IN SELECT * FROM cafe1_phase19_item_aliases LOOP
    SELECT category.id INTO category_uuid
    FROM public.menu_categories category
    JOIN cafe1_phase19_site site ON site.id = category.site_id
    WHERE category.active = true
      AND lower(btrim(category.name)) = lower(mapping.category_name)
    ORDER BY category.sort_order, category.created_at, category.id
    LIMIT 1;

    SELECT item.id INTO legacy_item
    FROM public.menu_items item
    WHERE item.category_id = category_uuid
      AND lower(btrim(item.name)) = lower(mapping.alias_name)
    ORDER BY item.active DESC, item.sort_order, item.created_at, item.id
    LIMIT 1;

    SELECT item.id INTO canonical_item
    FROM public.menu_items item
    WHERE item.category_id = category_uuid
      AND lower(btrim(item.name)) = lower(mapping.canonical_name)
    ORDER BY item.active DESC, item.sort_order, item.created_at, item.id
    LIMIT 1;

    IF legacy_item IS NULL THEN
      CONTINUE;
    ELSIF canonical_item IS NULL OR canonical_item = legacy_item THEN
      UPDATE public.menu_items
      SET name = mapping.canonical_name, updated_at = now()
      WHERE id = legacy_item;
    ELSE
      UPDATE public.menu_items
      SET active = false, updated_at = now()
      WHERE id = legacy_item;
    END IF;
  END LOOP;
END $$;

-- Deterministically keep one active row for exact duplicates such as the
-- repeated Chicken Fillet Burger and Chicken Shawarma Burger seen live.
WITH ranked_items AS (
  SELECT item.id,
         row_number() OVER (
           PARTITION BY item.site_id, item.category_id, lower(btrim(item.name))
           ORDER BY item.sort_order, item.created_at, item.id
         ) AS duplicate_rank
  FROM public.menu_items item
  WHERE item.active = true
)
UPDATE public.menu_items item
SET active = false, updated_at = now()
FROM ranked_items ranked
WHERE item.id = ranked.id AND ranked.duplicate_rank > 1;

-- Stop the administration UI or future imports from recreating active rows.
CREATE UNIQUE INDEX IF NOT EXISTS menu_categories_active_site_name_uniq
  ON public.menu_categories (site_id, lower(btrim(name)))
  WHERE active = true;

CREATE UNIQUE INDEX IF NOT EXISTS menu_items_active_site_category_name_uniq
  ON public.menu_items (site_id, category_id, lower(btrim(name)))
  WHERE active = true;