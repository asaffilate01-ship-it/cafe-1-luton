-- Cafe 1 Operations & Controls v2
-- Inventory, recipe costing, stock controls, staff time, multi-site isolation,
-- customer experience, juror attendance proof and operational monitoring.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Sites and legal-entity separation

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

-- ---------------------------------------------------------------------------
-- Inventory, purchasing, recipes and stocktaking

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

-- ---------------------------------------------------------------------------
-- Operational controls and staff accountability

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

-- ---------------------------------------------------------------------------
-- Kitchen stations, customer experience, juror presence and monitoring

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

-- ---------------------------------------------------------------------------
-- RLS: direct browser writes are narrow; privileged changes use audited RPCs.

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

CREATE POLICY sites_public_read ON public.sites FOR SELECT USING (active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY kds_stations_staff_read ON public.kds_stations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

CREATE POLICY operations_staff_read_inventory ON public.inventory_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY operations_staff_read_recipes ON public.recipe_components FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY operations_staff_read_suppliers ON public.suppliers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY operations_staff_read_purchase_orders ON public.purchase_orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY operations_staff_read_purchase_items ON public.purchase_order_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY operations_staff_read_movements ON public.stock_movements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY operations_staff_read_stocktakes ON public.stocktakes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY operations_staff_read_stocktake_lines ON public.stocktake_lines FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY operations_staff_read_checklists ON public.operational_checklists FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY operations_staff_read_completions ON public.checklist_completions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY operations_staff_read_summaries ON public.daily_control_summaries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));

CREATE POLICY staff_time_self_or_admin ON public.staff_time_entries FOR SELECT TO authenticated
  USING (staff_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY system_alerts_admin_read ON public.system_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY trusted_devices_admin_read ON public.trusted_devices FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY favourites_owner_all ON public.customer_favourites FOR ALL TO authenticated
  USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY feedback_owner_read ON public.customer_feedback FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY feedback_owner_insert ON public.customer_feedback FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Audited command functions

CREATE OR REPLACE FUNCTION public.cafe1_assert_operator(_admin_only boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF _admin_only AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Manager approval required';
  END IF;
  IF NOT _admin_only AND NOT (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')
  ) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.cafe1_inventory_dashboard(_site_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.cafe1_assert_operator(false) IS NULL THEN '{}'::jsonb ELSE
    jsonb_build_object(
      'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'sku', i.sku, 'barcode', i.barcode, 'name', i.name,
        'unit', i.unit, 'quantity_on_hand', i.quantity_on_hand,
        'reorder_level', i.reorder_level, 'par_level', i.par_level,
        'cost_per_unit_cents', i.cost_per_unit_cents, 'allergens', i.allergens,
        'active', i.active,
        'low_stock', i.active AND i.quantity_on_hand <= i.reorder_level,
        'stock_value_cents', round(i.quantity_on_hand * i.cost_per_unit_cents),
        'recipe_uses', (SELECT count(*) FROM public.recipe_components r WHERE r.inventory_item_id=i.id)
      ) ORDER BY i.name) FROM public.inventory_items i WHERE i.site_id=_site_id), '[]'::jsonb),
      'menu_items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'name', m.name, 'price_cents', m.price_cents,
        'cost_cents', m.cost_cents, 'portion_note', m.portion_note,
        'barcode', m.barcode, 'allergens', m.allergens,
        'recipe', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', r.id, 'inventory_item_id', r.inventory_item_id,
          'quantity', r.quantity, 'wastage_percent', r.wastage_percent
        )) FROM public.recipe_components r WHERE r.menu_item_id=m.id), '[]'::jsonb)
      ) ORDER BY m.name) FROM public.menu_items m WHERE m.site_id=_site_id AND m.active=true), '[]'::jsonb),
      'recent_movements', COALESCE((SELECT jsonb_agg(x) FROM (
        SELECT sm.id, sm.inventory_item_id, i.name AS item_name, sm.movement_type,
          sm.quantity_delta, sm.reason, sm.created_at
        FROM public.stock_movements sm JOIN public.inventory_items i ON i.id=sm.inventory_item_id
        WHERE sm.site_id=_site_id ORDER BY sm.created_at DESC LIMIT 50
      ) x), '[]'::jsonb),
      'open_stocktakes', COALESCE((SELECT jsonb_agg(s) FROM (
        SELECT st.id,st.title,st.status,st.opened_at,
          COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'inventory_item_id',sl.inventory_item_id,'item_name',ii.name,'unit',ii.unit,
            'expected_quantity',sl.expected_quantity,'counted_quantity',sl.counted_quantity
          ) ORDER BY ii.name) FROM public.stocktake_lines sl
          JOIN public.inventory_items ii ON ii.id=sl.inventory_item_id
          WHERE sl.stocktake_id=st.id), '[]'::jsonb) AS lines
        FROM public.stocktakes st
        WHERE st.site_id=_site_id AND st.status='open' ORDER BY st.opened_at DESC
      ) s), '[]'::jsonb)
    ) END
$$;

CREATE OR REPLACE FUNCTION public.cafe1_save_inventory_item(_site_id uuid, _payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid; row public.inventory_items%ROWTYPE; item_id uuid;
BEGIN
  actor := public.cafe1_assert_operator(false);
  item_id := NULLIF(_payload->>'id','')::uuid;
  IF length(trim(COALESCE(_payload->>'name',''))) < 2 THEN RAISE EXCEPTION 'Name is required'; END IF;
  IF length(trim(COALESCE(_payload->>'sku',''))) < 1 THEN RAISE EXCEPTION 'SKU is required'; END IF;
  IF COALESCE(_payload->>'unit','') NOT IN ('each','g','kg','ml','l','portion','pack') THEN
    RAISE EXCEPTION 'Invalid stock unit';
  END IF;
  IF item_id IS NULL THEN
    INSERT INTO public.inventory_items (
      site_id,sku,barcode,name,unit,quantity_on_hand,reorder_level,par_level,
      cost_per_unit_cents,allergens,active
    ) VALUES (
      _site_id, upper(trim(_payload->>'sku')), NULLIF(trim(_payload->>'barcode'),''),
      trim(_payload->>'name'), _payload->>'unit', COALESCE((_payload->>'quantity_on_hand')::numeric,0),
      COALESCE((_payload->>'reorder_level')::numeric,0), COALESCE((_payload->>'par_level')::numeric,0),
      COALESCE((_payload->>'cost_per_unit_cents')::numeric,0),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(_payload->'allergens','[]'::jsonb))), '{}'::text[]),
      COALESCE((_payload->>'active')::boolean,true)
    ) RETURNING * INTO row;
    IF row.quantity_on_hand <> 0 THEN
      INSERT INTO public.stock_movements (site_id,inventory_item_id,movement_type,quantity_delta,unit_cost_cents,reason,actor_id)
      VALUES (_site_id,row.id,'opening',row.quantity_on_hand,row.cost_per_unit_cents,'Opening balance',actor);
    END IF;
  ELSE
    UPDATE public.inventory_items SET
      sku=upper(trim(_payload->>'sku')), barcode=NULLIF(trim(_payload->>'barcode'),''),
      name=trim(_payload->>'name'), unit=_payload->>'unit',
      reorder_level=COALESCE((_payload->>'reorder_level')::numeric,0),
      par_level=COALESCE((_payload->>'par_level')::numeric,0),
      cost_per_unit_cents=COALESCE((_payload->>'cost_per_unit_cents')::numeric,0),
      allergens=COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(_payload->'allergens','[]'::jsonb))), '{}'::text[]),
      active=COALESCE((_payload->>'active')::boolean,true), updated_at=now()
    WHERE id=item_id AND site_id=_site_id RETURNING * INTO row;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stock item not found'; END IF;
  END IF;
  INSERT INTO public.audit_events (actor_id,action,entity_type,entity_id,detail)
  VALUES (actor,'inventory.item.save','inventory_item',row.id,jsonb_build_object('sku',row.sku,'name',row.name));
  RETURN to_jsonb(row);
END $$;

CREATE OR REPLACE FUNCTION public.cafe1_record_stock_movement(_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid; inv public.inventory_items%ROWTYPE; delta numeric; kind text; reason text; movement_id uuid;
BEGIN
  actor := public.cafe1_assert_operator(false);
  kind := _payload->>'movement_type';
  delta := COALESCE((_payload->>'quantity_delta')::numeric,0);
  reason := trim(COALESCE(_payload->>'reason',''));
  IF kind NOT IN ('purchase','waste','transfer_in','transfer_out','correction','staff_meal') THEN RAISE EXCEPTION 'Invalid movement'; END IF;
  IF delta = 0 THEN RAISE EXCEPTION 'Quantity cannot be zero'; END IF;
  IF kind IN ('waste','transfer_out','staff_meal') THEN delta := -abs(delta); END IF;
  IF kind IN ('purchase','transfer_in') THEN delta := abs(delta); END IF;
  IF length(reason) < 3 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT * INTO inv FROM public.inventory_items WHERE id=(_payload->>'inventory_item_id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stock item not found'; END IF;
  IF inv.quantity_on_hand + delta < 0 AND NOT public.has_role(actor,'admin') THEN
    RAISE EXCEPTION 'Manager approval required to take stock below zero';
  END IF;
  UPDATE public.inventory_items SET quantity_on_hand=quantity_on_hand+delta,updated_at=now() WHERE id=inv.id;
  INSERT INTO public.stock_movements (
    site_id,inventory_item_id,movement_type,quantity_delta,unit_cost_cents,reason,reference_type,reference_id,actor_id
  ) VALUES (
    inv.site_id,inv.id,kind,delta,inv.cost_per_unit_cents,reason,
    NULLIF(_payload->>'reference_type',''),NULLIF(_payload->>'reference_id','')::uuid,actor
  ) RETURNING id INTO movement_id;
  INSERT INTO public.audit_events (actor_id,action,entity_type,entity_id,detail)
  VALUES (actor,'inventory.movement.record','stock_movement',movement_id,jsonb_build_object('item_id',inv.id,'type',kind,'quantity_delta',delta,'reason',reason));
  RETURN jsonb_build_object('id',movement_id,'quantity_delta',delta,'quantity_on_hand',inv.quantity_on_hand+delta);
END $$;

CREATE OR REPLACE FUNCTION public.cafe1_save_recipe_component(_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid; row public.recipe_components%ROWTYPE; computed integer;
BEGIN
  actor := public.cafe1_assert_operator(false);
  INSERT INTO public.recipe_components (menu_item_id,inventory_item_id,quantity,wastage_percent)
  VALUES (
    (_payload->>'menu_item_id')::uuid,(_payload->>'inventory_item_id')::uuid,
    (_payload->>'quantity')::numeric,COALESCE((_payload->>'wastage_percent')::numeric,0)
  ) ON CONFLICT (menu_item_id,inventory_item_id) DO UPDATE SET
    quantity=EXCLUDED.quantity,wastage_percent=EXCLUDED.wastage_percent,updated_at=now()
  RETURNING * INTO row;
  SELECT COALESCE(round(sum(r.quantity*(1+r.wastage_percent/100)*i.cost_per_unit_cents)),0)::integer
  INTO computed FROM public.recipe_components r JOIN public.inventory_items i ON i.id=r.inventory_item_id
  WHERE r.menu_item_id=row.menu_item_id;
  UPDATE public.menu_items SET cost_cents=computed WHERE id=row.menu_item_id;
  INSERT INTO public.audit_events (actor_id,action,entity_type,entity_id,detail)
  VALUES (actor,'recipe.component.save','menu_item',row.menu_item_id,to_jsonb(row));
  RETURN to_jsonb(row) || jsonb_build_object('menu_cost_cents',computed);
END $$;

CREATE OR REPLACE FUNCTION public.cafe1_delete_recipe_component(_component_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid; menu_id uuid; computed integer;
BEGIN
  actor := public.cafe1_assert_operator(false);
  DELETE FROM public.recipe_components WHERE id=_component_id RETURNING menu_item_id INTO menu_id;
  IF menu_id IS NULL THEN RETURN false; END IF;
  SELECT COALESCE(round(sum(r.quantity*(1+r.wastage_percent/100)*i.cost_per_unit_cents)),0)::integer
  INTO computed FROM public.recipe_components r JOIN public.inventory_items i ON i.id=r.inventory_item_id
  WHERE r.menu_item_id=menu_id;
  UPDATE public.menu_items SET cost_cents=computed WHERE id=menu_id;
  INSERT INTO public.audit_events (actor_id,action,entity_type,entity_id)
  VALUES (actor,'recipe.component.delete','menu_item',menu_id);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.cafe1_start_stocktake(_site_id uuid, _title text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid; sid uuid;
BEGIN
  actor := public.cafe1_assert_operator(true);
  INSERT INTO public.stocktakes (site_id,title,opened_by) VALUES (_site_id,trim(_title),actor) RETURNING id INTO sid;
  INSERT INTO public.stocktake_lines (stocktake_id,inventory_item_id,expected_quantity)
  SELECT sid,id,quantity_on_hand FROM public.inventory_items WHERE site_id=_site_id AND active=true;
  INSERT INTO public.audit_events (actor_id,action,entity_type,entity_id)
  VALUES (actor,'stocktake.start','stocktake',sid);
  RETURN sid;
END $$;

CREATE OR REPLACE FUNCTION public.cafe1_complete_stocktake(_stocktake_id uuid, _counts jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid; st public.stocktakes%ROWTYPE; entry jsonb; line public.stocktake_lines%ROWTYPE; variance numeric; total integer:=0;
BEGIN
  actor := public.cafe1_assert_operator(true);
  SELECT * INTO st FROM public.stocktakes WHERE id=_stocktake_id AND status='open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Open stocktake not found'; END IF;
  FOR entry IN SELECT * FROM jsonb_array_elements(_counts) LOOP
    SELECT * INTO line FROM public.stocktake_lines
    WHERE stocktake_id=st.id AND inventory_item_id=(entry->>'inventory_item_id')::uuid FOR UPDATE;
    IF FOUND THEN
      variance := (entry->>'counted_quantity')::numeric-line.expected_quantity;
      UPDATE public.stocktake_lines SET counted_quantity=(entry->>'counted_quantity')::numeric,
        variance_quantity=variance,
        variance_value_cents=round(variance*(SELECT cost_per_unit_cents FROM public.inventory_items WHERE id=line.inventory_item_id))::integer,
        note=NULLIF(entry->>'note','') WHERE id=line.id;
      UPDATE public.inventory_items SET quantity_on_hand=(entry->>'counted_quantity')::numeric,updated_at=now()
      WHERE id=line.inventory_item_id;
      IF variance <> 0 THEN
        INSERT INTO public.stock_movements (site_id,inventory_item_id,movement_type,quantity_delta,unit_cost_cents,reason,reference_type,reference_id,actor_id)
        SELECT st.site_id,i.id,'stocktake',variance,i.cost_per_unit_cents,'Stocktake variance','stocktake',st.id,actor
        FROM public.inventory_items i WHERE i.id=line.inventory_item_id;
      END IF;
      total := total+abs(round(variance*(SELECT cost_per_unit_cents FROM public.inventory_items WHERE id=line.inventory_item_id))::integer);
    END IF;
  END LOOP;
  UPDATE public.stocktakes SET status='completed',completed_by=actor,completed_at=now() WHERE id=st.id;
  INSERT INTO public.audit_events (actor_id,action,entity_type,entity_id,detail)
  VALUES (actor,'stocktake.complete','stocktake',st.id,jsonb_build_object('absolute_variance_value_cents',total));
  RETURN jsonb_build_object('stocktake_id',st.id,'absolute_variance_value_cents',total);
END $$;

CREATE OR REPLACE FUNCTION public.cafe1_operations_dashboard(_site_id uuid, _business_date date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.cafe1_assert_operator(false) IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
    'site', (SELECT to_jsonb(s) FROM public.sites s WHERE s.id=_site_id),
    'checklists', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',c.id,'cadence',c.cadence,'title',c.title,'description',c.description,'sort_order',c.sort_order,
      'completed',x.id IS NOT NULL,'completed_at',x.completed_at,'note',x.note
    ) ORDER BY c.cadence,c.sort_order) FROM public.operational_checklists c
      LEFT JOIN public.checklist_completions x ON x.checklist_id=c.id AND x.business_date=_business_date
      WHERE c.site_id=_site_id AND c.active=true), '[]'::jsonb),
    'summary', (SELECT to_jsonb(d) FROM public.daily_control_summaries d WHERE d.site_id=_site_id AND d.business_date=_business_date),
    'open_shifts', COALESCE((SELECT jsonb_agg(s) FROM (
      SELECT id,terminal,opening_float_cents,staff_id,opened_at FROM public.till_shifts
      WHERE site_id=_site_id AND closed_at IS NULL ORDER BY opened_at
    ) s), '[]'::jsonb),
    'low_stock_count', (SELECT count(*) FROM public.inventory_items i WHERE i.site_id=_site_id AND i.active AND i.quantity_on_hand<=i.reorder_level),
    'unresolved_alerts', (SELECT count(*) FROM public.system_alerts a WHERE a.site_id=_site_id AND a.resolved_at IS NULL),
    'today', jsonb_build_object(
      'orders', (SELECT count(*) FROM public.orders o WHERE o.site_id=_site_id AND (o.created_at AT TIME ZONE 'Europe/London')::date=_business_date AND o.status NOT IN ('cancelled')),
      'net_sales_cents', (SELECT COALESCE(sum(GREATEST(o.total_cents-o.refunded_cents,0)),0)::integer FROM public.orders o WHERE o.site_id=_site_id AND (o.created_at AT TIME ZONE 'Europe/London')::date=_business_date AND o.payment_status IN ('paid','on_account','refunded')),
      'refunds_cents', (SELECT COALESCE(sum(o.refunded_cents),0)::integer FROM public.orders o WHERE o.site_id=_site_id AND (o.created_at AT TIME ZONE 'Europe/London')::date=_business_date),
      'cash_variance_cents', (SELECT COALESCE(sum(s.discrepancy_cents),0)::integer FROM public.till_shifts s WHERE s.site_id=_site_id AND (s.closed_at AT TIME ZONE 'Europe/London')::date=_business_date)
    )
  ) END
$$;

CREATE OR REPLACE FUNCTION public.cafe1_complete_checklist(_checklist_id uuid, _business_date date, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid; row public.checklist_completions%ROWTYPE;
BEGIN
  actor := public.cafe1_assert_operator(false);
  INSERT INTO public.checklist_completions (checklist_id,business_date,completed_by,note)
  VALUES (_checklist_id,_business_date,actor,NULLIF(trim(_note),''))
  ON CONFLICT (checklist_id,business_date) DO UPDATE SET
    completed_by=actor,note=EXCLUDED.note,completed_at=now()
  RETURNING * INTO row;
  INSERT INTO public.audit_events (actor_id,action,entity_type,entity_id,detail)
  VALUES (actor,'operations.checklist.complete','checklist',_checklist_id,jsonb_build_object('business_date',_business_date,'note',row.note));
  RETURN to_jsonb(row);
END $$;

CREATE OR REPLACE FUNCTION public.cafe1_generate_daily_summary(_site_id uuid, _business_date date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid; row public.daily_control_summaries%ROWTYPE;
BEGIN
  actor := public.cafe1_assert_operator(true);
  INSERT INTO public.daily_control_summaries (
    site_id,business_date,gross_sales_cents,net_sales_cents,cash_sales_cents,card_sales_cents,
    account_sales_cents,voucher_cents,discounts_cents,refunds_cents,waste_value_cents,
    till_variance_cents,order_count,generated_by,generated_at
  ) SELECT _site_id,_business_date,
    COALESCE(sum(o.total_cents),0)::integer,
    COALESCE(sum(GREATEST(o.total_cents-o.refunded_cents,0)),0)::integer,
    COALESCE(sum(CASE WHEN o.payment_method='cash' THEN GREATEST(o.total_cents-o.refunded_cents,0) ELSE 0 END),0)::integer,
    COALESCE(sum(CASE WHEN o.payment_method IN ('card','split') THEN GREATEST(o.total_cents-o.refunded_cents,0) ELSE 0 END),0)::integer,
    COALESCE(sum(CASE WHEN o.payment_method='account' THEN GREATEST(o.total_cents-o.refunded_cents,0) ELSE 0 END),0)::integer,
    COALESCE(sum(o.voucher_cents),0)::integer,
    COALESCE(sum(o.discount_cents+o.promo_discount_cents+o.juror_discount_cents),0)::integer,
    COALESCE(sum(o.refunded_cents),0)::integer,
    COALESCE((SELECT abs(round(sum(sm.quantity_delta*sm.unit_cost_cents)))::integer FROM public.stock_movements sm WHERE sm.site_id=_site_id AND sm.movement_type IN ('waste','staff_meal') AND (sm.created_at AT TIME ZONE 'Europe/London')::date=_business_date),0),
    COALESCE((SELECT sum(ts.discrepancy_cents)::integer FROM public.till_shifts ts WHERE ts.site_id=_site_id AND (ts.closed_at AT TIME ZONE 'Europe/London')::date=_business_date),0),
    count(o.id)::integer,actor,now()
  FROM public.orders o
  WHERE o.site_id=_site_id AND (o.created_at AT TIME ZONE 'Europe/London')::date=_business_date
    AND o.payment_status IN ('paid','on_account','refunded')
  ON CONFLICT (site_id,business_date) DO UPDATE SET
    gross_sales_cents=EXCLUDED.gross_sales_cents,net_sales_cents=EXCLUDED.net_sales_cents,
    cash_sales_cents=EXCLUDED.cash_sales_cents,card_sales_cents=EXCLUDED.card_sales_cents,
    account_sales_cents=EXCLUDED.account_sales_cents,voucher_cents=EXCLUDED.voucher_cents,
    discounts_cents=EXCLUDED.discounts_cents,refunds_cents=EXCLUDED.refunds_cents,
    waste_value_cents=EXCLUDED.waste_value_cents,till_variance_cents=EXCLUDED.till_variance_cents,
    order_count=EXCLUDED.order_count,generated_by=actor,generated_at=now()
  RETURNING * INTO row;
  INSERT INTO public.audit_events (actor_id,action,entity_type,entity_id,detail)
  VALUES (actor,'operations.daily_summary.generate','daily_control_summary',row.id,jsonb_build_object('business_date',_business_date));
  RETURN to_jsonb(row);
END $$;

CREATE OR REPLACE FUNCTION public.cafe1_clock_staff(_site_id uuid, _action text, _break_minutes integer DEFAULT 0, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid; row public.staff_time_entries%ROWTYPE;
BEGIN
  actor := public.cafe1_assert_operator(false);
  IF _action='in' THEN
    INSERT INTO public.staff_time_entries (site_id,staff_id,note) VALUES (_site_id,actor,NULLIF(trim(_note),'')) RETURNING * INTO row;
  ELSIF _action='out' THEN
    UPDATE public.staff_time_entries SET clocked_out_at=now(),break_minutes=GREATEST(0,LEAST(_break_minutes,720)),note=COALESCE(NULLIF(trim(_note),''),note)
    WHERE staff_id=actor AND clocked_out_at IS NULL RETURNING * INTO row;
    IF NOT FOUND THEN RAISE EXCEPTION 'No open time entry'; END IF;
  ELSE RAISE EXCEPTION 'Invalid clock action'; END IF;
  INSERT INTO public.audit_events (actor_id,action,entity_type,entity_id,detail)
  VALUES (actor,'staff.clock.'||_action,'staff_time_entry',row.id,jsonb_build_object('site_id',_site_id));
  RETURN to_jsonb(row);
END $$;

CREATE OR REPLACE FUNCTION public.cafe1_staff_dashboard(_site_id uuid, _from date, _to date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.cafe1_assert_operator(false) IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
    'current', (SELECT to_jsonb(t) FROM public.staff_time_entries t WHERE t.staff_id=auth.uid() AND t.clocked_out_at IS NULL LIMIT 1),
    'entries', COALESCE((SELECT jsonb_agg(e ORDER BY e.clocked_in_at DESC) FROM (
      SELECT t.id,t.staff_id,t.clocked_in_at,t.clocked_out_at,t.break_minutes,t.note,
        CASE WHEN t.clocked_out_at IS NULL THEN NULL ELSE round(extract(epoch FROM (t.clocked_out_at-t.clocked_in_at))/60)-t.break_minutes END AS paid_minutes
      FROM public.staff_time_entries t WHERE t.site_id=_site_id
        AND (t.clocked_in_at AT TIME ZONE 'Europe/London')::date BETWEEN _from AND _to
        AND (t.staff_id=auth.uid() OR public.has_role(auth.uid(),'admin'))
    ) e), '[]'::jsonb)
  ) END
$$;

CREATE OR REPLACE FUNCTION public.cafe1_toggle_favourite(_menu_item_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF EXISTS (SELECT 1 FROM public.customer_favourites WHERE customer_id=auth.uid() AND menu_item_id=_menu_item_id) THEN
    DELETE FROM public.customer_favourites WHERE customer_id=auth.uid() AND menu_item_id=_menu_item_id;
    RETURN false;
  END IF;
  INSERT INTO public.customer_favourites (customer_id,menu_item_id) VALUES (auth.uid(),_menu_item_id);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.cafe1_customer_favourites()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN ARRAY[]::uuid[]
    ELSE COALESCE(
      (SELECT array_agg(menu_item_id ORDER BY created_at)
       FROM public.customer_favourites WHERE customer_id=auth.uid()),
      ARRAY[]::uuid[]
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.cafe1_submit_feedback(_order_id uuid, _rating integer, _comment text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fid uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.orders WHERE id=_order_id AND customer_id=auth.uid()) THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF _rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Rating must be 1 to 5'; END IF;
  INSERT INTO public.customer_feedback (customer_id,order_id,rating,comment)
  VALUES (auth.uid(),_order_id,_rating,NULLIF(trim(_comment),''))
  ON CONFLICT (order_id) DO UPDATE SET rating=EXCLUDED.rating,comment=EXCLUDED.comment,created_at=now()
  RETURNING id INTO fid;
  RETURN fid;
END $$;

CREATE OR REPLACE FUNCTION public.cafe1_security_dashboard(_site_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.cafe1_assert_operator(true) IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
    'alerts', COALESCE((SELECT jsonb_agg(a ORDER BY a.created_at DESC) FROM (
      SELECT id,severity,category,title,detail,created_at,resolved_at FROM public.system_alerts
      WHERE site_id=_site_id OR site_id IS NULL LIMIT 100
    ) a), '[]'::jsonb),
    'audit', COALESCE((SELECT jsonb_agg(a ORDER BY a.created_at DESC) FROM (
      SELECT id,actor_id,action,entity_type,entity_id,terminal,detail,created_at
      FROM public.audit_events ORDER BY created_at DESC LIMIT 100
    ) a), '[]'::jsonb),
    'devices', COALESCE((SELECT jsonb_agg(d ORDER BY d.created_at DESC) FROM (
      SELECT id,device_name,device_type,last_seen_at,revoked_at,created_at FROM public.trusted_devices
      WHERE site_id=_site_id OR site_id IS NULL
    ) d), '[]'::jsonb),
    'failed_code_attempts_24h', (SELECT count(*) FROM public.code_attempts WHERE ok=false AND created_at>now()-interval '24 hours')
  ) END
$$;

CREATE OR REPLACE FUNCTION public.cafe1_resolve_alert(_alert_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid;
BEGIN
  actor := public.cafe1_assert_operator(true);
  UPDATE public.system_alerts SET resolved_at=now(),resolved_by=actor WHERE id=_alert_id AND resolved_at IS NULL;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.cafe1_list_sites()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.cafe1_assert_operator(false) IS NULL THEN '[]'::jsonb ELSE
    COALESCE(jsonb_agg(jsonb_build_object(
      'id',s.id,'code',s.code,'name',s.name,'legal_name',s.legal_name,
      'trading_name',s.trading_name,'postcode',s.postcode,'timezone',s.timezone,
      'active',s.active,'ordering_modes',s.ordering_modes,
      'marketplace_delivery_enabled',s.marketplace_delivery_enabled,
      'own_delivery_enabled',s.own_delivery_enabled
    ) ORDER BY s.name), '[]'::jsonb) END
  FROM public.sites s
$$;

CREATE OR REPLACE FUNCTION public.cafe1_save_site(_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid; row public.sites%ROWTYPE; sid uuid;
BEGIN
  actor := public.cafe1_assert_operator(true);
  sid := NULLIF(_payload->>'id','')::uuid;
  IF length(trim(COALESCE(_payload->>'name',''))) < 2 THEN RAISE EXCEPTION 'Site name is required'; END IF;
  IF length(trim(COALESCE(_payload->>'legal_name',''))) < 2 THEN RAISE EXCEPTION 'Legal entity is required'; END IF;
  IF sid IS NULL THEN
    INSERT INTO public.sites (
      code,name,legal_name,trading_name,postcode,timezone,active,ordering_modes,
      marketplace_delivery_enabled,own_delivery_enabled
    ) VALUES (
      upper(trim(_payload->>'code')),trim(_payload->>'name'),trim(_payload->>'legal_name'),
      trim(COALESCE(_payload->>'trading_name',_payload->>'name')),NULLIF(upper(trim(_payload->>'postcode')),''),
      COALESCE(NULLIF(_payload->>'timezone',''),'Europe/London'),COALESCE((_payload->>'active')::boolean,true),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(_payload->'ordering_modes','[]'::jsonb))),ARRAY['dine_in','collection']::text[]),
      COALESCE((_payload->>'marketplace_delivery_enabled')::boolean,false),
      COALESCE((_payload->>'own_delivery_enabled')::boolean,false)
    ) RETURNING * INTO row;
  ELSE
    UPDATE public.sites SET
      code=upper(trim(_payload->>'code')),name=trim(_payload->>'name'),legal_name=trim(_payload->>'legal_name'),
      trading_name=trim(COALESCE(_payload->>'trading_name',_payload->>'name')),
      postcode=NULLIF(upper(trim(_payload->>'postcode')),''),
      timezone=COALESCE(NULLIF(_payload->>'timezone',''),'Europe/London'),
      active=COALESCE((_payload->>'active')::boolean,true),
      ordering_modes=COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(_payload->'ordering_modes','[]'::jsonb))),ARRAY['dine_in','collection']::text[]),
      marketplace_delivery_enabled=COALESCE((_payload->>'marketplace_delivery_enabled')::boolean,false),
      own_delivery_enabled=COALESCE((_payload->>'own_delivery_enabled')::boolean,false),updated_at=now()
    WHERE id=sid RETURNING * INTO row;
    IF NOT FOUND THEN RAISE EXCEPTION 'Site not found'; END IF;
  END IF;
  INSERT INTO public.audit_events (actor_id,action,entity_type,entity_id,detail)
  VALUES (actor,'site.save','site',row.id,jsonb_build_object('code',row.code,'legal_name',row.legal_name));
  RETURN to_jsonb(row);
END $$;

CREATE OR REPLACE FUNCTION public.cafe1_create_juror_challenge(_room text, _token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid; row public.juror_attendance_challenges%ROWTYPE;
BEGIN
  actor := public.cafe1_assert_operator(false);
  IF length(trim(_room)) < 2 THEN RAISE EXCEPTION 'Jury room is required'; END IF;
  DELETE FROM public.juror_attendance_challenges WHERE expires_at<now()-interval '1 day';
  INSERT INTO public.juror_attendance_challenges (room,token_hash,expires_at,created_by)
  VALUES (trim(_room),_token_hash,now()+interval '90 seconds',actor) RETURNING * INTO row;
  INSERT INTO public.audit_events (actor_id,action,entity_type,entity_id,detail)
  VALUES (actor,'juror.attendance.challenge.create','juror_challenge',row.id,jsonb_build_object('room',row.room,'expires_at',row.expires_at));
  RETURN jsonb_build_object('id',row.id,'room',row.room,'expires_at',row.expires_at);
END $$;

CREATE OR REPLACE FUNCTION public.cafe1_consume_juror_challenge(_token_hash text, _voucher_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE challenge public.juror_attendance_challenges%ROWTYPE; holder public.voucher_holders%ROWTYPE;
BEGIN
  SELECT * INTO challenge FROM public.juror_attendance_challenges
  WHERE token_hash=_token_hash AND consumed_at IS NULL AND expires_at>now() FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'message','This attendance QR has expired or was already used.'); END IF;
  SELECT * INTO holder FROM public.voucher_holders v
  WHERE upper(v.code)=upper(trim(_voucher_code)) AND v.active=true FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'message','Voucher code not recognised.'); END IF;
  IF holder.valid_until IS NOT NULL AND CURRENT_DATE>holder.valid_until THEN
    RETURN jsonb_build_object('ok',false,'message','This voucher code has expired.');
  END IF;
  UPDATE public.juror_attendance_challenges SET consumed_at=now(),consumed_voucher_holder_id=holder.id
  WHERE id=challenge.id;
  INSERT INTO public.voucher_events (holder_id,code,event,detail)
  VALUES (holder.id,holder.code,'attendance_verified','Room: '||challenge.room);
  RETURN jsonb_build_object('ok',true,'room',challenge.room,'verified_until',now()+interval '30 minutes');
END $$;

-- Post theoretical recipe usage once per paid/on-account order.
CREATE OR REPLACE FUNCTION public.cafe1_post_order_inventory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recipe record;
BEGIN
  IF NEW.inventory_posted_at IS NULL AND NEW.payment_status IN ('paid','on_account')
    AND NEW.status NOT IN ('cancelled','refunded') THEN
    FOR recipe IN
      SELECT i.inventory_item_id,
        sum(oi.qty*i.quantity*(1+i.wastage_percent/100))::numeric(14,3) AS used
      FROM public.order_items oi JOIN public.recipe_components i ON i.menu_item_id=oi.menu_item_id
      WHERE oi.order_id=NEW.id GROUP BY i.inventory_item_id
    LOOP
      UPDATE public.inventory_items SET quantity_on_hand=quantity_on_hand-recipe.used,updated_at=now()
      WHERE id=recipe.inventory_item_id;
      INSERT INTO public.stock_movements (site_id,inventory_item_id,movement_type,quantity_delta,unit_cost_cents,reason,reference_type,reference_id,actor_id)
      SELECT NEW.site_id,inv.id,'sale',-recipe.used,inv.cost_per_unit_cents,
        'Theoretical recipe usage for order #'||NEW.order_number,'order',NEW.id,NEW.operator_id
      FROM public.inventory_items inv WHERE inv.id=recipe.inventory_item_id;
    END LOOP;
    NEW.inventory_posted_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_post_inventory ON public.orders;
CREATE TRIGGER orders_post_inventory BEFORE UPDATE OF payment_status,status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.cafe1_post_order_inventory();

-- Preserve staff accountability for counter sales without assigning website
-- orders to whichever privileged service happens to process them.
CREATE OR REPLACE FUNCTION public.cafe1_set_counter_operator()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.source='counter' AND NEW.operator_id IS NULL THEN NEW.operator_id:=auth.uid(); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_set_counter_operator ON public.orders;
CREATE TRIGGER orders_set_counter_operator BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.cafe1_set_counter_operator();

-- Low-stock and cash-variance alerts are generated without exposing secrets.
CREATE OR REPLACE FUNCTION public.cafe1_refresh_operational_alerts(_site_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid; n integer:=0; inv record; sh record;
BEGIN
  actor := public.cafe1_assert_operator(true);
  FOR inv IN SELECT * FROM public.inventory_items WHERE site_id=_site_id AND active AND quantity_on_hand<=reorder_level LOOP
    INSERT INTO public.system_alerts (site_id,severity,category,title,detail,fingerprint)
    VALUES (_site_id,'warning','inventory','Low stock: '||inv.name,
      inv.quantity_on_hand||' '||inv.unit||' remaining; reorder at '||inv.reorder_level,
      'low-stock:'||inv.id) ON CONFLICT DO NOTHING;
    n:=n+1;
  END LOOP;
  FOR sh IN SELECT * FROM public.till_shifts WHERE site_id=_site_id AND closed_at>now()-interval '7 days' AND abs(COALESCE(discrepancy_cents,0))>=500 LOOP
    INSERT INTO public.system_alerts (site_id,severity,category,title,detail,fingerprint)
    VALUES (_site_id,'critical','cash','Till variance requires review',
      'Shift '||sh.id||' variance: '||sh.discrepancy_cents||' pence','till-variance:'||sh.id)
    ON CONFLICT DO NOTHING;
    n:=n+1;
  END LOOP;
  RETURN n;
END $$;

-- Function permissions
REVOKE ALL ON FUNCTION public.cafe1_assert_operator(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cafe1_assert_operator(boolean) TO authenticated, service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS fn FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'cafe1_%' AND p.proname <> 'cafe1_assert_operator'
  LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION '||r.fn||' FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION '||r.fn||' TO authenticated, service_role';
  END LOOP;
END $$;

-- Public favourites/feedback functions still require a valid authenticated JWT.
REVOKE ALL ON FUNCTION public.cafe1_consume_juror_challenge(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cafe1_consume_juror_challenge(text,text) TO service_role;

-- Touch timestamps where the shared trigger already exists.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sites','inventory_items','recipe_components','suppliers','purchase_orders','purchase_order_items'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t||'_updated', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at()', t||'_updated', t);
  END LOOP;
END $$;
