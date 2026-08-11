-- Cafe 1 Phase 33: management KPIs, expense ledger, supplier receipts and
-- SumUp settlement reconciliation. Cafe 1 is not VAT registered: every
-- amount in this ledger is the gross amount paid and no input VAT is reclaimed.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS unit_cost_cents integer NOT NULL DEFAULT 0
  CHECK (unit_cost_cents >= 0);

UPDATE public.order_items oi
SET unit_cost_cents = COALESCE(mi.cost_cents, 0)
FROM public.menu_items mi
WHERE oi.menu_item_id = mi.id AND oi.unit_cost_cents = 0;

CREATE OR REPLACE FUNCTION public.cafe1_snapshot_order_item_cost()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.menu_item_id IS NOT NULL AND COALESCE(NEW.unit_cost_cents, 0) = 0 THEN
    SELECT COALESCE(cost_cents, 0) INTO NEW.unit_cost_cents
    FROM public.menu_items WHERE id = NEW.menu_item_id;
    NEW.unit_cost_cents := COALESCE(NEW.unit_cost_cents, 0);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS order_items_snapshot_cost ON public.order_items;
CREATE TRIGGER order_items_snapshot_cost
  BEFORE INSERT OR UPDATE OF menu_item_id ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.cafe1_snapshot_order_item_cost();

-- Cost snapshots must not be exposed through customer order-item reads.
REVOKE SELECT ON public.order_items FROM authenticated;
GRANT SELECT (
  id, order_id, menu_item_id, name, qty, unit_price_cents, notes, created_at, category_label
) ON public.order_items TO authenticated;

CREATE TABLE IF NOT EXISTS public.business_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  expense_date date NOT NULL,
  category text NOT NULL CHECK (category IN (
    'rent_rates','utilities','wages','insurance','professional_fees','marketing',
    'repairs','cleaning','software','bank_fees','payment_fees','travel_delivery',
    'supplies','smallwares','other'
  )),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 2 AND 300),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  tax_included_cents integer NOT NULL DEFAULT 0
    CHECK (tax_included_cents >= 0 AND tax_included_cents <= amount_cents),
  payment_method text NOT NULL DEFAULT 'other' CHECK (payment_method IN (
    'cash','card','bank_transfer','direct_debit','sumup_card','other'
  )),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN (
    'manual','sumup_csv','sumup_payout_fee'
  )),
  provider_reference text,
  invoice_reference text,
  receipt_reference text,
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','voided')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS business_expenses_provider_ref_uniq
  ON public.business_expenses (site_id, source, provider_reference)
  WHERE provider_reference IS NOT NULL AND trim(provider_reference) <> '';
CREATE INDEX IF NOT EXISTS business_expenses_site_date_idx
  ON public.business_expenses (site_id, expense_date DESC) WHERE status = 'posted';

CREATE TABLE IF NOT EXISTS public.sumup_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  provider_id text NOT NULL,
  settlement_date date NOT NULL,
  settlement_type text NOT NULL CHECK (settlement_type IN (
    'PAYOUT','CHARGE_BACK_DEDUCTION','REFUND_DEDUCTION','DD_RETURN_DEDUCTION','BALANCE_DEDUCTION'
  )),
  status text NOT NULL CHECK (status IN ('SUCCESSFUL','FAILED')),
  amount_cents integer NOT NULL,
  fee_cents integer NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
  currency text NOT NULL DEFAULT 'GBP' CHECK (currency = 'GBP'),
  provider_reference text,
  transaction_code text,
  imported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, provider_id)
);

CREATE INDEX IF NOT EXISTS sumup_settlements_site_date_idx
  ON public.sumup_settlements (site_id, settlement_date DESC);

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS invoice_date date,
  ADD COLUMN IF NOT EXISTS delivery_cost_cents integer NOT NULL DEFAULT 0 CHECK (delivery_cost_cents >= 0),
  ADD COLUMN IF NOT EXISTS discount_cents integer NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  ADD COLUMN IF NOT EXISTS total_cost_cents integer NOT NULL DEFAULT 0 CHECK (total_cost_cents >= 0),
  ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IN (
    'cash','card','bank_transfer','direct_debit','sumup_card','other'
  )),
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','paid')),
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_supplier_invoice_uniq
  ON public.purchase_orders (site_id, supplier_id, invoice_number)
  WHERE supplier_id IS NOT NULL AND invoice_number IS NOT NULL AND trim(invoice_number) <> '';

ALTER TABLE public.business_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sumup_settlements ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.business_expenses, public.sumup_settlements TO service_role;
GRANT SELECT ON public.business_expenses, public.sumup_settlements TO authenticated;

DROP POLICY IF EXISTS business_expenses_admin_read ON public.business_expenses;
CREATE POLICY business_expenses_admin_read ON public.business_expenses FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS sumup_settlements_admin_read ON public.sumup_settlements;
CREATE POLICY sumup_settlements_admin_read ON public.sumup_settlements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS business_expenses_updated ON public.business_expenses;
CREATE TRIGGER business_expenses_updated
  BEFORE UPDATE ON public.business_expenses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.cafe1_assert_finance_manager()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid;
BEGIN
  actor := public.cafe1_assert_operator(true);
  IF COALESCE(auth.jwt()->>'aal','') <> 'aal2' THEN
    RAISE EXCEPTION 'Manager authenticator MFA (AAL2) is required for financial data';
  END IF;
  RETURN actor;
END $$;
REVOKE ALL ON FUNCTION public.cafe1_assert_finance_manager() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cafe1_finance_dashboard(
  _site_id uuid, _from_date date, _to_date date
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public.cafe1_assert_finance_manager();
  IF _from_date IS NULL OR _to_date IS NULL OR _from_date > _to_date
    OR _to_date - _from_date > 366 THEN
    RAISE EXCEPTION 'Choose a valid reporting period of no more than 367 days';
  END IF;

  WITH scoped_orders AS (
    SELECT o.*,
      GREATEST(o.total_cents - COALESCE(o.refunded_cents, 0), 0)
      + CASE
          WHEN o.payment_status = 'refunded' AND o.refunded_cents >= o.total_cents THEN 0
          ELSE o.voucher_cents
        END AS earned_cents
    FROM public.orders o
    WHERE o.site_id = _site_id
      AND (o.created_at AT TIME ZONE 'Europe/London')::date BETWEEN _from_date AND _to_date
      AND o.status <> 'cancelled'
      AND o.payment_status IN ('paid','on_account','refunded')
  ),
  sales AS (
    SELECT
      COALESCE(sum(earned_cents), 0)::integer AS income,
      COALESCE(sum(GREATEST(total_cents - refunded_cents, 0)), 0)::integer AS customer_income,
      COALESCE(sum(CASE WHEN payment_status = 'refunded' AND refunded_cents >= total_cents THEN 0 ELSE voucher_cents END), 0)::integer AS voucher_income,
      COALESCE(sum(refunded_cents), 0)::integer AS refunds,
      COALESCE(sum(discount_cents + promo_discount_cents + juror_discount_cents), 0)::integer AS discounts,
      COALESCE(sum(delivery_fee_cents), 0)::integer AS delivery_fees,
      count(*)::integer AS orders,
      COALESCE(sum(CASE WHEN payment_method = 'cash' THEN earned_cents ELSE 0 END), 0)::integer AS cash,
      COALESCE(sum(CASE WHEN payment_method = 'card' THEN earned_cents ELSE 0 END), 0)::integer AS card,
      COALESCE(sum(CASE WHEN payment_method = 'split' THEN earned_cents ELSE 0 END), 0)::integer AS split,
      COALESCE(sum(CASE WHEN payment_method = 'account' THEN earned_cents ELSE 0 END), 0)::integer AS account
    FROM scoped_orders
  ),
  costs AS (
    SELECT
      COALESCE(sum(oi.qty * oi.unit_cost_cents), 0)::integer AS cogs,
      count(*) FILTER (WHERE oi.unit_cost_cents = 0)::integer AS zero_cost_lines,
      count(*)::integer AS sold_lines
    FROM public.order_items oi JOIN scoped_orders o ON o.id = oi.order_id
  ),
  expenses AS (
    SELECT COALESCE(sum(amount_cents), 0)::integer AS total,
      COALESCE(sum(amount_cents) FILTER (WHERE category = 'payment_fees'), 0)::integer AS payment_fees
    FROM public.business_expenses
    WHERE site_id = _site_id AND status = 'posted' AND expense_date BETWEEN _from_date AND _to_date
  ),
  purchases AS (
    SELECT COALESCE(sum(total_cost_cents), 0)::integer AS total
    FROM public.purchase_orders
    WHERE site_id = _site_id AND status = 'received'
      AND COALESCE(invoice_date, (received_at AT TIME ZONE 'Europe/London')::date)
        BETWEEN _from_date AND _to_date
  ),
  stock AS (
    SELECT COALESCE(round(sum(quantity_on_hand * cost_per_unit_cents)), 0)::integer AS value,
      count(*) FILTER (WHERE active AND quantity_on_hand <= reorder_level)::integer AS low_count
    FROM public.inventory_items WHERE site_id = _site_id
  ),
  losses AS (
    SELECT
      COALESCE(abs(round(sum(quantity_delta * unit_cost_cents) FILTER (WHERE movement_type = 'waste'))), 0)::integer AS waste,
      COALESCE(abs(round(sum(quantity_delta * unit_cost_cents) FILTER (WHERE movement_type = 'staff_meal'))), 0)::integer AS staff_meals,
      COALESCE(abs(round(sum(quantity_delta * unit_cost_cents) FILTER (WHERE movement_type = 'stocktake'))), 0)::integer AS stock_variance
    FROM public.stock_movements
    WHERE site_id = _site_id
      AND (created_at AT TIME ZONE 'Europe/London')::date BETWEEN _from_date AND _to_date
  ),
  settlements AS (
    SELECT
      COALESCE(sum(amount_cents) FILTER (WHERE settlement_type = 'PAYOUT' AND status = 'SUCCESSFUL'), 0)::integer AS paid_out,
      COALESCE(sum(abs(amount_cents)) FILTER (WHERE settlement_type <> 'PAYOUT' AND status = 'SUCCESSFUL'), 0)::integer AS deductions,
      COALESCE(sum(fee_cents) FILTER (WHERE status = 'SUCCESSFUL'), 0)::integer AS fees
    FROM public.sumup_settlements
    WHERE site_id = _site_id AND settlement_date BETWEEN _from_date AND _to_date
  )
  SELECT jsonb_build_object(
    'from_date', _from_date, 'to_date', _to_date,
    'site', (SELECT jsonb_build_object('id',id,'name',name,'legal_name',legal_name,'trading_name',trading_name)
      FROM public.sites WHERE id = _site_id),
    'sales_income_cents', sales.income,
    'customer_income_cents', sales.customer_income,
    'voucher_income_cents', sales.voucher_income,
    'refunds_cents', sales.refunds,
    'discounts_cents', sales.discounts,
    'delivery_fees_cents', sales.delivery_fees,
    'order_count', sales.orders,
    'average_order_cents', CASE WHEN sales.orders = 0 THEN 0 ELSE round(sales.income::numeric / sales.orders)::integer END,
    'cogs_cents', costs.cogs,
    'gross_profit_cents', sales.income - costs.cogs,
    'operating_expenses_cents', expenses.total,
    'payment_fees_cents', expenses.payment_fees,
    'operating_profit_cents', sales.income - costs.cogs - expenses.total,
    'gross_margin_percent', CASE WHEN sales.income = 0 THEN 0 ELSE round((sales.income-costs.cogs)*10000.0/sales.income)/100 END,
    'food_cost_percent', CASE WHEN sales.income = 0 THEN 0 ELSE round(costs.cogs*10000.0/sales.income)/100 END,
    'operating_margin_percent', CASE WHEN sales.income = 0 THEN 0 ELSE round((sales.income-costs.cogs-expenses.total)*10000.0/sales.income)/100 END,
    'refund_rate_percent', CASE WHEN sales.income + sales.refunds = 0 THEN 0 ELSE round(sales.refunds*10000.0/(sales.income+sales.refunds))/100 END,
    'purchase_outflow_cents', purchases.total,
    'stock_value_cents', stock.value,
    'low_stock_count', stock.low_count,
    'waste_cents', losses.waste,
    'staff_meal_cents', losses.staff_meals,
    'stock_variance_cents', losses.stock_variance,
    'zero_cost_lines', costs.zero_cost_lines,
    'sold_lines', costs.sold_lines,
    'payment_mix', jsonb_build_object('cash',sales.cash,'card',sales.card,'split',sales.split,'account',sales.account,'voucher',sales.voucher_income),
    'sumup', jsonb_build_object('paid_out_cents',settlements.paid_out,'deductions_cents',settlements.deductions,'fees_cents',settlements.fees),
    'expense_categories', COALESCE((SELECT jsonb_agg(x ORDER BY x.amount_cents DESC) FROM (
      SELECT category, sum(amount_cents)::integer AS amount_cents, count(*)::integer AS count
      FROM public.business_expenses
      WHERE site_id=_site_id AND status='posted' AND expense_date BETWEEN _from_date AND _to_date
      GROUP BY category
    ) x), '[]'::jsonb),
    'daily', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'date', d.day, 'income_cents', COALESCE(x.income,0), 'orders', COALESCE(x.orders,0),
      'expenses_cents', COALESCE(e.expenses,0)
    ) ORDER BY d.day) FROM generate_series(_from_date,_to_date,'1 day'::interval) d(day)
      LEFT JOIN (
        SELECT (created_at AT TIME ZONE 'Europe/London')::date AS day,
          sum(earned_cents)::integer AS income, count(*)::integer AS orders
        FROM scoped_orders GROUP BY 1
      ) x ON x.day=d.day
      LEFT JOIN (
        SELECT expense_date AS day, sum(amount_cents)::integer AS expenses
        FROM public.business_expenses
        WHERE site_id=_site_id AND status='posted' AND expense_date BETWEEN _from_date AND _to_date
        GROUP BY 1
      ) e ON e.day=d.day
    ), '[]'::jsonb),
    'recent_expenses', COALESCE((SELECT jsonb_agg(x) FROM (
      SELECT be.id,be.expense_date,be.category,be.description,be.amount_cents,be.tax_included_cents,
        be.payment_method,be.source,be.invoice_reference,be.receipt_reference,be.created_at,
        s.name AS supplier_name
      FROM public.business_expenses be LEFT JOIN public.suppliers s ON s.id=be.supplier_id
      WHERE be.site_id=_site_id AND be.status='posted'
      ORDER BY be.expense_date DESC,be.created_at DESC LIMIT 100
    ) x), '[]'::jsonb),
    'recent_purchases', COALESCE((SELECT jsonb_agg(x) FROM (
      SELECT po.id,po.invoice_date,po.invoice_number,po.total_cost_cents,po.payment_status,
        po.payment_method,po.received_at,s.name AS supplier_name,
        (SELECT count(*)::integer FROM public.purchase_order_items pi WHERE pi.purchase_order_id=po.id) AS line_count
      FROM public.purchase_orders po LEFT JOIN public.suppliers s ON s.id=po.supplier_id
      WHERE po.site_id=_site_id AND po.status='received'
      ORDER BY po.received_at DESC LIMIT 100
    ) x), '[]'::jsonb),
    'suppliers', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',id,'name',name,'contact_name',contact_name,'email',email,'phone',phone,
      'account_reference',account_reference,'active',active
    ) ORDER BY name) FROM public.suppliers WHERE site_id=_site_id AND active), '[]'::jsonb)
  ) INTO result
  FROM sales CROSS JOIN costs CROSS JOIN expenses CROSS JOIN purchases CROSS JOIN stock
    CROSS JOIN losses CROSS JOIN settlements;

  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.cafe1_save_expense(_site_id uuid, _payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid; row public.business_expenses%ROWTYPE;
BEGIN
  actor := public.cafe1_assert_finance_manager();
  INSERT INTO public.business_expenses (
    site_id,expense_date,category,supplier_id,description,amount_cents,tax_included_cents,
    payment_method,source,invoice_reference,receipt_reference,notes,created_by
  ) VALUES (
    _site_id,(_payload->>'expense_date')::date,_payload->>'category',
    NULLIF(_payload->>'supplier_id','')::uuid,trim(_payload->>'description'),
    (_payload->>'amount_cents')::integer,COALESCE((_payload->>'tax_included_cents')::integer,0),
    COALESCE(NULLIF(_payload->>'payment_method',''),'other'),'manual',
    NULLIF(trim(_payload->>'invoice_reference'),''),NULLIF(trim(_payload->>'receipt_reference'),''),
    NULLIF(trim(_payload->>'notes'),''),actor
  ) RETURNING * INTO row;
  INSERT INTO public.audit_events (actor_id,action,entity_type,entity_id,detail)
  VALUES (actor,'finance.expense.post','business_expense',row.id,
    jsonb_build_object('amount_cents',row.amount_cents,'category',row.category,'expense_date',row.expense_date));
  RETURN to_jsonb(row);
END $$;

CREATE OR REPLACE FUNCTION public.cafe1_void_expense(_expense_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid; row public.business_expenses%ROWTYPE;
BEGIN
  actor := public.cafe1_assert_finance_manager();
  IF length(trim(COALESCE(_reason,''))) < 4 THEN RAISE EXCEPTION 'A void reason is required'; END IF;
  UPDATE public.business_expenses SET status='voided',voided_by=actor,voided_at=now(),
    void_reason=trim(_reason)
  WHERE id=_expense_id AND status='posted' RETURNING * INTO row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Posted expense not found'; END IF;
  INSERT INTO public.audit_events (actor_id,action,entity_type,entity_id,detail)
  VALUES (actor,'finance.expense.void','business_expense',row.id,
    jsonb_build_object('amount_cents',row.amount_cents,'reason',row.void_reason));
  RETURN to_jsonb(row);
END $$;

CREATE OR REPLACE FUNCTION public.cafe1_save_supplier(_site_id uuid, _payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid; row public.suppliers%ROWTYPE;
BEGIN
  actor := public.cafe1_assert_finance_manager();
  IF length(trim(COALESCE(_payload->>'name',''))) < 2 THEN RAISE EXCEPTION 'Supplier name is required'; END IF;
  INSERT INTO public.suppliers (site_id,name,contact_name,email,phone,account_reference,lead_days,active)
  VALUES (_site_id,trim(_payload->>'name'),NULLIF(trim(_payload->>'contact_name'),''),
    NULLIF(lower(trim(_payload->>'email')),''),NULLIF(trim(_payload->>'phone'),''),
    NULLIF(trim(_payload->>'account_reference'),''),COALESCE((_payload->>'lead_days')::integer,0),true)
  ON CONFLICT (site_id,name) DO UPDATE SET contact_name=EXCLUDED.contact_name,email=EXCLUDED.email,
    phone=EXCLUDED.phone,account_reference=EXCLUDED.account_reference,lead_days=EXCLUDED.lead_days,
    active=true,updated_at=now()
  RETURNING * INTO row;
  INSERT INTO public.audit_events (actor_id,action,entity_type,entity_id,detail)
  VALUES (actor,'finance.supplier.save','supplier',row.id,jsonb_build_object('name',row.name));
  RETURN to_jsonb(row);
END $$;

CREATE OR REPLACE FUNCTION public.cafe1_receive_purchase(_site_id uuid, _payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid; po public.purchase_orders%ROWTYPE; line jsonb; item public.inventory_items%ROWTYPE;
  qty numeric(14,3); unit_cost numeric(14,4); subtotal numeric := 0; new_qty numeric;
  new_cost numeric(14,4); landed_unit_cost numeric(14,4); landed_factor numeric;
  delivery integer; discount integer; computed_total integer;
BEGIN
  actor := public.cafe1_assert_finance_manager();
  IF jsonb_typeof(_payload->'lines') <> 'array' OR jsonb_array_length(_payload->'lines') < 1 THEN
    RAISE EXCEPTION 'At least one purchase line is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id=(_payload->>'supplier_id')::uuid AND site_id=_site_id AND active) THEN
    RAISE EXCEPTION 'Supplier is unavailable for this site';
  END IF;
  delivery := COALESCE((_payload->>'delivery_cost_cents')::integer,0);
  discount := COALESCE((_payload->>'discount_cents')::integer,0);
  IF delivery < 0 OR discount < 0 THEN RAISE EXCEPTION 'Purchase adjustments cannot be negative'; END IF;

  FOR line IN SELECT value FROM jsonb_array_elements(_payload->'lines') LOOP
    qty := (line->>'quantity')::numeric;
    unit_cost := (line->>'unit_cost_cents')::numeric;
    IF qty <= 0 OR unit_cost < 0 THEN RAISE EXCEPTION 'Invalid purchase quantity or cost'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.inventory_items WHERE id=(line->>'inventory_item_id')::uuid AND site_id=_site_id AND active) THEN
      RAISE EXCEPTION 'Stock item is unavailable for this site';
    END IF;
    subtotal := subtotal + qty * unit_cost;
  END LOOP;
  computed_total := GREATEST(round(subtotal)::integer + delivery - discount,0);
  -- Café1 is not VAT registered, so stock is valued at the gross landed cost paid.
  -- Allocate delivery and purchase-level discounts proportionally across the lines
  -- so future COGS and gross-margin KPIs include the complete acquisition cost.
  landed_factor := CASE WHEN subtotal > 0 THEN computed_total::numeric / subtotal ELSE 0 END;

  INSERT INTO public.purchase_orders (
    site_id,supplier_id,status,supplier_reference,invoice_number,invoice_date,note,
    delivery_cost_cents,discount_cents,total_cost_cents,payment_method,payment_status,
    paid_at,ordered_by,received_by,ordered_at,received_at
  ) VALUES (
    _site_id,(_payload->>'supplier_id')::uuid,'received',NULLIF(trim(_payload->>'supplier_reference'),''),
    NULLIF(trim(_payload->>'invoice_number'),''),(_payload->>'invoice_date')::date,
    NULLIF(trim(_payload->>'note'),''),delivery,discount,computed_total,
    COALESCE(NULLIF(_payload->>'payment_method',''),'other'),
    COALESCE(NULLIF(_payload->>'payment_status',''),'unpaid'),
    CASE WHEN _payload->>'payment_status'='paid' THEN now() ELSE NULL END,
    actor,actor,now(),now()
  ) RETURNING * INTO po;

  FOR line IN SELECT value FROM jsonb_array_elements(_payload->'lines') LOOP
    qty := (line->>'quantity')::numeric;
    unit_cost := (line->>'unit_cost_cents')::numeric;
    landed_unit_cost := round(unit_cost * landed_factor,4);
    SELECT * INTO item FROM public.inventory_items
    WHERE id=(line->>'inventory_item_id')::uuid AND site_id=_site_id FOR UPDATE;
    new_qty := item.quantity_on_hand + qty;
    new_cost := CASE
      WHEN GREATEST(item.quantity_on_hand,0) + qty = 0 THEN landed_unit_cost
      ELSE round((GREATEST(item.quantity_on_hand,0)*item.cost_per_unit_cents + qty*landed_unit_cost)
        / (GREATEST(item.quantity_on_hand,0)+qty),4)
    END;
    INSERT INTO public.purchase_order_items (
      purchase_order_id,inventory_item_id,ordered_quantity,received_quantity,unit_cost_cents
    ) VALUES (po.id,item.id,qty,qty,unit_cost);
    INSERT INTO public.stock_movements (
      site_id,inventory_item_id,movement_type,quantity_delta,unit_cost_cents,reason,
      reference_type,reference_id,actor_id
    ) VALUES (_site_id,item.id,'purchase',qty,landed_unit_cost,
      'Supplier delivery ' || COALESCE(po.invoice_number,po.id::text),'purchase_order',po.id,actor);
    UPDATE public.inventory_items SET quantity_on_hand=new_qty,cost_per_unit_cents=new_cost,updated_at=now()
    WHERE id=item.id;
  END LOOP;

  INSERT INTO public.audit_events (actor_id,action,entity_type,entity_id,detail)
  VALUES (actor,'finance.purchase.receive','purchase_order',po.id,
    jsonb_build_object('total_cost_cents',computed_total,'invoice_number',po.invoice_number,
      'supplier_id',po.supplier_id,'line_count',jsonb_array_length(_payload->'lines'),
      'landed_cost_factor',landed_factor));
  RETURN to_jsonb(po) || jsonb_build_object('line_count',jsonb_array_length(_payload->'lines'));
END $$;

CREATE OR REPLACE FUNCTION public.cafe1_import_sumup_expenses(_site_id uuid, _rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid; row jsonb; imported integer := 0; skipped integer := 0; affected integer;
BEGIN
  actor := public.cafe1_assert_finance_manager();
  IF jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) > 1000 THEN
    RAISE EXCEPTION 'Import must contain no more than 1000 rows';
  END IF;
  FOR row IN SELECT value FROM jsonb_array_elements(_rows) LOOP
    INSERT INTO public.business_expenses (
      site_id,expense_date,category,description,amount_cents,tax_included_cents,payment_method,
      source,provider_reference,invoice_reference,notes,created_by
    ) VALUES (
      _site_id,(row->>'expense_date')::date,
      CASE WHEN row->>'category' IN ('rent_rates','utilities','wages','insurance','professional_fees','marketing','repairs','cleaning','software','bank_fees','payment_fees','travel_delivery','supplies','smallwares','other')
        THEN row->>'category' ELSE 'other' END,
      trim(row->>'description'),(row->>'amount_cents')::integer,
      COALESCE((row->>'tax_included_cents')::integer,0),
      CASE WHEN row->>'payment_method' IN ('cash','card','bank_transfer','direct_debit','sumup_card','other')
        THEN row->>'payment_method' ELSE 'other' END,
      'sumup_csv',trim(row->>'provider_reference'),NULLIF(trim(row->>'invoice_reference'),''),
      NULLIF(trim(row->>'notes'),''),actor
    ) ON CONFLICT (site_id,source,provider_reference) WHERE provider_reference IS NOT NULL AND trim(provider_reference) <> ''
      DO NOTHING;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected = 1 THEN imported := imported + 1; ELSE skipped := skipped + 1; END IF;
  END LOOP;
  INSERT INTO public.audit_events (actor_id,action,entity_type,detail)
  VALUES (actor,'finance.sumup_expenses.import','business_expense',
    jsonb_build_object('imported',imported,'skipped',skipped));
  RETURN jsonb_build_object('imported',imported,'skipped',skipped);
END $$;

CREATE OR REPLACE FUNCTION public.cafe1_import_sumup_settlements(_site_id uuid, _rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid; row jsonb; imported integer := 0; fees integer := 0; affected integer; fee integer;
BEGIN
  actor := public.cafe1_assert_finance_manager();
  IF jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) > 10000 THEN
    RAISE EXCEPTION 'Settlement import is too large';
  END IF;
  FOR row IN SELECT value FROM jsonb_array_elements(_rows) LOOP
    INSERT INTO public.sumup_settlements (
      site_id,provider_id,settlement_date,settlement_type,status,amount_cents,fee_cents,
      currency,provider_reference,transaction_code,imported_by
    ) VALUES (
      _site_id,trim(row->>'provider_id'),(row->>'settlement_date')::date,row->>'settlement_type',
      row->>'status',(row->>'amount_cents')::integer,COALESCE((row->>'fee_cents')::integer,0),
      row->>'currency',NULLIF(trim(row->>'provider_reference'),''),
      NULLIF(trim(row->>'transaction_code'),''),actor
    ) ON CONFLICT (site_id,provider_id) DO UPDATE SET
      settlement_date=EXCLUDED.settlement_date,settlement_type=EXCLUDED.settlement_type,
      status=EXCLUDED.status,amount_cents=EXCLUDED.amount_cents,fee_cents=EXCLUDED.fee_cents,
      provider_reference=EXCLUDED.provider_reference,transaction_code=EXCLUDED.transaction_code,
      imported_by=actor,imported_at=now();
    imported := imported + 1;
    fee := COALESCE((row->>'fee_cents')::integer,0);
    IF row->>'status'='SUCCESSFUL' AND fee > 0 THEN
      INSERT INTO public.business_expenses (
        site_id,expense_date,category,description,amount_cents,payment_method,source,
        provider_reference,invoice_reference,created_by
      ) VALUES (
        _site_id,(row->>'settlement_date')::date,'payment_fees','SumUp processing fee',fee,
        'bank_transfer','sumup_payout_fee','payout-fee:' || trim(row->>'provider_id'),
        NULLIF(trim(row->>'provider_reference'),''),actor
      ) ON CONFLICT (site_id,source,provider_reference) WHERE provider_reference IS NOT NULL AND trim(provider_reference) <> ''
        DO UPDATE SET expense_date=EXCLUDED.expense_date,amount_cents=EXCLUDED.amount_cents,
          invoice_reference=EXCLUDED.invoice_reference,status='posted',updated_at=now();
      fees := fees + fee;
    END IF;
  END LOOP;
  INSERT INTO public.audit_events (actor_id,action,entity_type,detail)
  VALUES (actor,'finance.sumup_settlements.sync','sumup_settlement',
    jsonb_build_object('records',imported,'fee_cents',fees));
  RETURN jsonb_build_object('records',imported,'fee_cents',fees);
END $$;

REVOKE ALL ON FUNCTION public.cafe1_finance_dashboard(uuid,date,date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cafe1_save_expense(uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cafe1_void_expense(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cafe1_save_supplier(uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cafe1_receive_purchase(uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cafe1_import_sumup_expenses(uuid,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cafe1_import_sumup_settlements(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cafe1_finance_dashboard(uuid,date,date),
  public.cafe1_save_expense(uuid,jsonb), public.cafe1_void_expense(uuid,text),
  public.cafe1_save_supplier(uuid,jsonb), public.cafe1_receive_purchase(uuid,jsonb),
  public.cafe1_import_sumup_expenses(uuid,jsonb),
  public.cafe1_import_sumup_settlements(uuid,jsonb) TO authenticated, service_role;