-- Cafe 1 Operations & Controls v2
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_-]{2,20}$'),
  name text NOT NULL,
  legal_name text NOT NULL,
  trading_name text NOT NULL,
  postcode text,
  timezone text NOT NULL DEFAULT 'Europe/London',
  active boolean NOT NULL DEFAULT true,
  ordering_modes text[] NOT NULL DEFAULT ARRAY['dine_in','collection']::text[],
  marketplace_delivery_enabled boolean NOT NULL DEFAULT false,
  own_delivery_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.sites (
  id, code, name, legal_name, trading_name, postcode,
  ordering_modes, marketplace_delivery_enabled, own_delivery_enabled
) VALUES (
  'cafe1000-0000-4000-8000-000000000001',
  'STALBANS',
  'St Albans Crown Court',
  'Cafe 1 CC Ltd',
  'Cafe 1',
  'AL1 3JW',
  ARRAY['dine_in','collection','jury_room_delivery']::text[],
  false,
  true
) ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['menu_categories','menu_items','orders','business_settings','till_shifts']
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS site_id uuid DEFAULT %L::uuid',
      t, 'cafe1000-0000-4000-8000-000000000001'
    );
    EXECUTE format(
      'UPDATE public.%I SET site_id = %L::uuid WHERE site_id IS NULL',
      t, 'cafe1000-0000-4000-8000-000000000001'
    );
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN site_id SET NOT NULL', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = t || '_site_id_fkey'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE RESTRICT',
        t, t || '_site_id_fkey'
      );
    END IF;
  END LOOP;
END $$;

DROP INDEX IF EXISTS public.till_shifts_one_open_per_terminal;
CREATE UNIQUE INDEX IF NOT EXISTS till_shifts_one_open_per_site_terminal
  ON public.till_shifts (site_id, terminal) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS orders_site_created_idx
  ON public.orders (site_id, created_at DESC);

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS allergens text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS dietary_tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS cost_cents integer NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  ADD COLUMN IF NOT EXISTS prep_seconds integer NOT NULL DEFAULT 0 CHECK (prep_seconds >= 0),
  ADD COLUMN IF NOT EXISTS station_code text,
  ADD COLUMN IF NOT EXISTS portion_note text;

CREATE UNIQUE INDEX IF NOT EXISTS menu_items_site_barcode_uniq
  ON public.menu_items (site_id, barcode)
  WHERE barcode IS NOT NULL AND trim(barcode) <> '';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS operator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inventory_posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS void_reason text;

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  sku text NOT NULL,
  barcode text,
  name text NOT NULL,
  unit text NOT NULL CHECK (unit IN ('each','g','kg','ml','l','portion','pack')),
  quantity_on_hand numeric(14,3) NOT NULL DEFAULT 0,
  reorder_level numeric(14,3) NOT NULL DEFAULT 0,
  par_level numeric(14,3) NOT NULL DEFAULT 0,
  cost_per_unit_cents numeric(14,4) NOT NULL DEFAULT 0,
  allergens text[] NOT NULL DEFAULT '{}'::text[],
  supplier_code text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, sku)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_site_barcode_uniq
  ON public.inventory_items (site_id, barcode)
  WHERE barcode IS NOT NULL AND trim(barcode) <> '';

CREATE TABLE IF NOT EXISTS public.recipe_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  wastage_percent numeric(6,3) NOT NULL DEFAULT 0 CHECK (wastage_percent BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (menu_item_id, inventory_item_id)
);

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  account_reference text,
  lead_days integer NOT NULL DEFAULT 0 CHECK (lead_days BETWEEN 0 AND 365),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, name)
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ordered','part_received','received','cancelled')),
  supplier_reference text,
  expected_on date,
  note text,
  ordered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  received_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ordered_at timestamptz,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  ordered_quantity numeric(14,3) NOT NULL CHECK (ordered_quantity > 0),
  received_quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  unit_cost_cents numeric(14,4) NOT NULL DEFAULT 0 CHECK (unit_cost_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (purchase_order_id, inventory_item_id)
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type IN (
    'opening','purchase','sale','waste','stocktake','transfer_in','transfer_out','correction','staff_meal'
  )),
  quantity_delta numeric(14,3) NOT NULL CHECK (quantity_delta <> 0),
  unit_cost_cents numeric(14,4) NOT NULL DEFAULT 0 CHECK (unit_cost_cents >= 0),
  reason text NOT NULL,
  reference_type text,
  reference_id uuid,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_movements_item_created_idx
  ON public.stock_movements (inventory_item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.stocktakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','completed','cancelled')),
  title text NOT NULL,
  note text,
  opened_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.stocktake_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stocktake_id uuid NOT NULL REFERENCES public.stocktakes(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  expected_quantity numeric(14,3) NOT NULL,
  counted_quantity numeric(14,3),
  variance_quantity numeric(14,3),
  variance_value_cents integer,
  note text,
  UNIQUE (stocktake_id, inventory_item_id)
);

CREATE TABLE IF NOT EXISTS public.operational_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  cadence text NOT NULL CHECK (cadence IN ('opening','closing','daily','weekly_friday','monthly_last_day')),
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.checklist_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.operational_checklists(id) ON DELETE RESTRICT,
  business_date date NOT NULL DEFAULT CURRENT_DATE,
  completed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  note text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checklist_id, business_date)
);

CREATE TABLE IF NOT EXISTS public.staff_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  clocked_in_at timestamptz NOT NULL DEFAULT now(),
  clocked_out_at timestamptz,
  break_minutes integer NOT NULL DEFAULT 0 CHECK (break_minutes BETWEEN 0 AND 720),
  note text,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS staff_one_open_time_entry
  ON public.staff_time_entries (staff_id) WHERE clocked_out_at IS NULL;

CREATE TABLE IF NOT EXISTS public.daily_control_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  business_date date NOT NULL,
  gross_sales_cents integer NOT NULL DEFAULT 0,
  net_sales_cents integer NOT NULL DEFAULT 0,
  cash_sales_cents integer NOT NULL DEFAULT 0,
  card_sales_cents integer NOT NULL DEFAULT 0,
  account_sales_cents integer NOT NULL DEFAULT 0,
  voucher_cents integer NOT NULL DEFAULT 0,
  discounts_cents integer NOT NULL DEFAULT 0,
  refunds_cents integer NOT NULL DEFAULT 0,
  waste_value_cents integer NOT NULL DEFAULT 0,
  till_variance_cents integer NOT NULL DEFAULT 0,
  order_count integer NOT NULL DEFAULT 0,
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  signed_off_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  signed_off_at timestamptz,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, business_date)
);

INSERT INTO public.operational_checklists (site_id, cadence, title, description, sort_order)
SELECT s.id, x.cadence, x.title, x.description, x.sort_order
FROM public.sites s
CROSS JOIN (VALUES
  ('opening','Count opening cash','Record and verify the opening float before sales begin.',10),
  ('opening','Equipment and allergen check','Confirm till, KDS, printers and allergen information are ready.',20),
  ('closing','Count closing cash','Complete the till close and investigate any variance.',10),
  ('closing','Log waste and expenses','Record all waste, purchases, expenses and staff meals.',20),
  ('weekly_friday','Friday weekly accounts','Review sales, refunds, cash, card, expenses, purchases and variances.',10),
  ('monthly_last_day','Month-end stocktake','Count all stock and sign off the variance report.',10)
) AS x(cadence,title,description,sort_order)
WHERE s.id = 'cafe1000-0000-4000-8000-000000000001'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.kds_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  colour text NOT NULL DEFAULT '#c8102e',
  target_seconds integer NOT NULL DEFAULT 600 CHECK (target_seconds BETWEEN 30 AND 7200),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (site_id, code)
);

INSERT INTO public.kds_stations (site_id, code, name, colour, target_seconds, sort_order)
VALUES
  ('cafe1000-0000-4000-8000-000000000001','HOT','Hot food','#dc2626',900,10),
  ('cafe1000-0000-4000-8000-000000000001','SANDWICH','Sandwiches','#d97706',480,20),
  ('cafe1000-0000-4000-8000-000000000001','DRINKS','Drinks','#0284c7',240,30),
  ('cafe1000-0000-4000-8000-000000000001','PASS','Collection pass','#059669',180,40)
ON CONFLICT (site_id, code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.customer_favourites (
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, menu_item_id)
);

CREATE TABLE IF NOT EXISTS public.customer_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (length(comment) <= 1000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);

CREATE TABLE IF NOT EXISTS public.juror_attendance_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_voucher_holder_id uuid REFERENCES public.voucher_holders(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS public.system_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  category text NOT NULL,
  title text NOT NULL,
  detail text,
  fingerprint text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS system_alerts_open_fingerprint_uniq
  ON public.system_alerts (fingerprint) WHERE fingerprint IS NOT NULL AND resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS public.trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  device_name text NOT NULL,
  device_type text NOT NULL CHECK (device_type IN ('till','kds','admin','driver','customer_display')),
  token_hash text NOT NULL UNIQUE,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  enrolled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sites','inventory_items','recipe_components','suppliers','purchase_orders',
    'purchase_order_items','stock_movements','stocktakes','stocktake_lines',
    'operational_checklists','checklist_completions','staff_time_entries',
    'daily_control_summaries','kds_stations','customer_favourites','customer_feedback',
    'juror_attendance_challenges','system_alerts','trusted_devices'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

GRANT SELECT ON public.sites, public.kds_stations TO anon, authenticated;
GRANT SELECT ON public.inventory_items, public.recipe_components, public.suppliers,
  public.purchase_orders, public.purchase_order_items, public.stock_movements,
  public.stocktakes, public.stocktake_lines, public.operational_checklists,
  public.checklist_completions, public.daily_control_summaries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_favourites TO authenticated;
GRANT SELECT, INSERT ON public.customer_feedback TO authenticated;
GRANT SELECT ON public.staff_time_entries, public.system_alerts, public.trusted_devices TO authenticated;