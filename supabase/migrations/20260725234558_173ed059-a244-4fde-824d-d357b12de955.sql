
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS group_label text;

CREATE TABLE IF NOT EXISTS public.menu_modifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT modifier_scope CHECK (category_id IS NOT NULL OR item_id IS NOT NULL)
);

GRANT SELECT ON public.menu_modifiers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.menu_modifiers TO authenticated;
GRANT ALL ON public.menu_modifiers TO service_role;

ALTER TABLE public.menu_modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY mods_public_read ON public.menu_modifiers
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY mods_staff_write ON public.menu_modifiers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));
