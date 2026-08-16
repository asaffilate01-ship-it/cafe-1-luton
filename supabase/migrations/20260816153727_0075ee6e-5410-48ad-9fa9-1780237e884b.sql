-- 1. Landlord admins
CREATE TABLE public.landlord_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.landlord_admins TO authenticated;
GRANT ALL ON public.landlord_admins TO service_role;
ALTER TABLE public.landlord_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY landlord_admins_self_read ON public.landlord_admins
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.cafe1_is_landlord(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.landlord_admins WHERE user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.cafe1_assert_landlord()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.cafe1_is_landlord(auth.uid()) THEN
    RAISE EXCEPTION 'Landlord access required';
  END IF;
END;
$$;

-- 2. Plans
CREATE TABLE public.tenant_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  monthly_price_cents integer NOT NULL DEFAULT 0,
  included_orders integer NOT NULL DEFAULT 0,
  max_sites integer NOT NULL DEFAULT 1,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tenant_plans TO authenticated;
GRANT ALL ON public.tenant_plans TO service_role;
ALTER TABLE public.tenant_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_plans_landlord_read ON public.tenant_plans
  FOR SELECT TO authenticated USING (public.cafe1_is_landlord(auth.uid()));

-- 3. Tenants
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  legal_name text NOT NULL DEFAULT '',
  primary_domain text,
  deployment_url text,
  contact_name text,
  contact_email text,
  contact_phone text,
  status text NOT NULL DEFAULT 'trial',
  plan_code text REFERENCES public.tenant_plans(code),
  brand_primary text NOT NULL DEFAULT '#C81E1E',
  brand_accent text NOT NULL DEFAULT '#FFFFFF',
  logo_url text,
  is_self boolean NOT NULL DEFAULT false,
  trial_ends_on date,
  reporting_key text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_status_check CHECK (status IN ('trial','active','suspended','cancelled'))
);
CREATE UNIQUE INDEX tenants_one_self ON public.tenants (is_self) WHERE is_self;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 4. Invoices
CREATE TABLE public.tenant_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  paid_on date,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_invoices_status_check CHECK (status IN ('draft','sent','paid','void'))
);
CREATE INDEX tenant_invoices_tenant_idx ON public.tenant_invoices (tenant_id, period_start DESC);
GRANT ALL ON public.tenant_invoices TO service_role;
ALTER TABLE public.tenant_invoices ENABLE ROW LEVEL SECURITY;

-- 5. Metric snapshots reported by each tenant deployment
CREATE TABLE public.tenant_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  orders_count integer NOT NULL DEFAULT 0,
  gross_revenue_cents integer NOT NULL DEFAULT 0,
  active_users integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, snapshot_date)
);
CREATE INDEX tenant_metrics_date_idx ON public.tenant_metric_snapshots (snapshot_date DESC);
GRANT ALL ON public.tenant_metric_snapshots TO service_role;
ALTER TABLE public.tenant_metric_snapshots ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tenant_plans_updated_at BEFORE UPDATE ON public.tenant_plans
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tenant_invoices_updated_at BEFORE UPDATE ON public.tenant_invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 6. Bootstrap + RPCs
CREATE OR REPLACE FUNCTION public.cafe1_claim_landlord()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF EXISTS (SELECT 1 FROM public.landlord_admins) THEN
    RAISE EXCEPTION 'Landlord access has already been claimed';
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  INSERT INTO public.landlord_admins (user_id, email)
  SELECT auth.uid(), email FROM auth.users WHERE id = auth.uid();
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.cafe1_claim_landlord() FROM public;
GRANT EXECUTE ON FUNCTION public.cafe1_claim_landlord() TO authenticated;

CREATE OR REPLACE FUNCTION public.cafe1_landlord_dashboard()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public.cafe1_assert_landlord();
  SELECT jsonb_build_object(
    'plans', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.monthly_price_cents)
      FROM public.tenant_plans p), '[]'::jsonb),
    'tenants', COALESCE((SELECT jsonb_agg(
        (to_jsonb(t) - 'reporting_key') || jsonb_build_object(
          'orders_30d', COALESCE((SELECT sum(m.orders_count) FROM public.tenant_metric_snapshots m
             WHERE m.tenant_id = t.id AND m.snapshot_date > CURRENT_DATE - 30), 0),
          'revenue_30d_cents', COALESCE((SELECT sum(m.gross_revenue_cents) FROM public.tenant_metric_snapshots m
             WHERE m.tenant_id = t.id AND m.snapshot_date > CURRENT_DATE - 30), 0),
          'last_report_on', (SELECT max(m.snapshot_date) FROM public.tenant_metric_snapshots m
             WHERE m.tenant_id = t.id),
          'outstanding_cents', COALESCE((SELECT sum(i.amount_cents) FROM public.tenant_invoices i
             WHERE i.tenant_id = t.id AND i.status IN ('draft','sent')), 0)
        ) ORDER BY t.created_at)
      FROM public.tenants t), '[]'::jsonb),
    'invoices', COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.period_start DESC)
      FROM public.tenant_invoices i), '[]'::jsonb),
    'totals', (SELECT jsonb_build_object(
        'tenants', (SELECT count(*) FROM public.tenants),
        'active', (SELECT count(*) FROM public.tenants WHERE status = 'active'),
        'suspended', (SELECT count(*) FROM public.tenants WHERE status = 'suspended'),
        'mrr_cents', COALESCE((SELECT sum(p.monthly_price_cents) FROM public.tenants t
           JOIN public.tenant_plans p ON p.code = t.plan_code WHERE t.status = 'active'), 0),
        'outstanding_cents', COALESCE((SELECT sum(amount_cents) FROM public.tenant_invoices
           WHERE status IN ('draft','sent')), 0),
        'orders_30d', COALESCE((SELECT sum(orders_count) FROM public.tenant_metric_snapshots
           WHERE snapshot_date > CURRENT_DATE - 30), 0),
        'revenue_30d_cents', COALESCE((SELECT sum(gross_revenue_cents) FROM public.tenant_metric_snapshots
           WHERE snapshot_date > CURRENT_DATE - 30), 0)
      ))
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.cafe1_landlord_dashboard() FROM public;
GRANT EXECUTE ON FUNCTION public.cafe1_landlord_dashboard() TO authenticated;

CREATE OR REPLACE FUNCTION public.cafe1_save_tenant(_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row_out public.tenants;
BEGIN
  PERFORM public.cafe1_assert_landlord();
  IF (_payload->>'id') IS NULL THEN
    INSERT INTO public.tenants (slug, name, legal_name, primary_domain, deployment_url,
      contact_name, contact_email, contact_phone, status, plan_code,
      brand_primary, brand_accent, logo_url, trial_ends_on, notes)
    VALUES (
      lower(_payload->>'slug'), _payload->>'name', COALESCE(_payload->>'legal_name',''),
      NULLIF(_payload->>'primary_domain',''), NULLIF(_payload->>'deployment_url',''),
      NULLIF(_payload->>'contact_name',''), NULLIF(_payload->>'contact_email',''),
      NULLIF(_payload->>'contact_phone',''), COALESCE(_payload->>'status','trial'),
      NULLIF(_payload->>'plan_code',''),
      COALESCE(NULLIF(_payload->>'brand_primary',''),'#C81E1E'),
      COALESCE(NULLIF(_payload->>'brand_accent',''),'#FFFFFF'),
      NULLIF(_payload->>'logo_url',''), NULLIF(_payload->>'trial_ends_on','')::date,
      NULLIF(_payload->>'notes','')
    ) RETURNING * INTO row_out;
  ELSE
    UPDATE public.tenants SET
      slug = lower(COALESCE(_payload->>'slug', slug)),
      name = COALESCE(_payload->>'name', name),
      legal_name = COALESCE(_payload->>'legal_name', legal_name),
      primary_domain = NULLIF(COALESCE(_payload->>'primary_domain', primary_domain),''),
      deployment_url = NULLIF(COALESCE(_payload->>'deployment_url', deployment_url),''),
      contact_name = NULLIF(COALESCE(_payload->>'contact_name', contact_name),''),
      contact_email = NULLIF(COALESCE(_payload->>'contact_email', contact_email),''),
      contact_phone = NULLIF(COALESCE(_payload->>'contact_phone', contact_phone),''),
      status = COALESCE(_payload->>'status', status),
      plan_code = NULLIF(COALESCE(_payload->>'plan_code', plan_code),''),
      brand_primary = COALESCE(_payload->>'brand_primary', brand_primary),
      brand_accent = COALESCE(_payload->>'brand_accent', brand_accent),
      logo_url = NULLIF(COALESCE(_payload->>'logo_url', logo_url),''),
      trial_ends_on = COALESCE(NULLIF(_payload->>'trial_ends_on','')::date, trial_ends_on),
      notes = COALESCE(_payload->>'notes', notes)
    WHERE id = (_payload->>'id')::uuid
    RETURNING * INTO row_out;
  END IF;
  RETURN to_jsonb(row_out) - 'reporting_key';
END;
$$;
REVOKE ALL ON FUNCTION public.cafe1_save_tenant(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.cafe1_save_tenant(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.cafe1_set_tenant_status(_tenant_id uuid, _status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row_out public.tenants;
BEGIN
  PERFORM public.cafe1_assert_landlord();
  IF _status NOT IN ('trial','active','suspended','cancelled') THEN
    RAISE EXCEPTION 'Unknown tenant status';
  END IF;
  UPDATE public.tenants SET status = _status WHERE id = _tenant_id RETURNING * INTO row_out;
  IF row_out.id IS NULL THEN RAISE EXCEPTION 'Tenant not found'; END IF;
  RETURN to_jsonb(row_out) - 'reporting_key';
END;
$$;
REVOKE ALL ON FUNCTION public.cafe1_set_tenant_status(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.cafe1_set_tenant_status(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cafe1_reveal_tenant_key(_tenant_id uuid, _rotate boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE key_out text;
BEGIN
  PERFORM public.cafe1_assert_landlord();
  IF _rotate THEN
    UPDATE public.tenants SET reporting_key = encode(gen_random_bytes(24),'hex')
    WHERE id = _tenant_id RETURNING reporting_key INTO key_out;
  ELSE
    SELECT reporting_key INTO key_out FROM public.tenants WHERE id = _tenant_id;
  END IF;
  IF key_out IS NULL THEN RAISE EXCEPTION 'Tenant not found'; END IF;
  RETURN key_out;
END;
$$;
REVOKE ALL ON FUNCTION public.cafe1_reveal_tenant_key(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.cafe1_reveal_tenant_key(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.cafe1_save_tenant_plan(_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row_out public.tenant_plans;
BEGIN
  PERFORM public.cafe1_assert_landlord();
  INSERT INTO public.tenant_plans (code, name, monthly_price_cents, included_orders, max_sites, features, active)
  VALUES (lower(_payload->>'code'), _payload->>'name',
    COALESCE((_payload->>'monthly_price_cents')::int, 0),
    COALESCE((_payload->>'included_orders')::int, 0),
    COALESCE((_payload->>'max_sites')::int, 1),
    COALESCE(_payload->'features', '[]'::jsonb),
    COALESCE((_payload->>'active')::boolean, true))
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    monthly_price_cents = EXCLUDED.monthly_price_cents,
    included_orders = EXCLUDED.included_orders,
    max_sites = EXCLUDED.max_sites,
    features = EXCLUDED.features,
    active = EXCLUDED.active
  RETURNING * INTO row_out;
  RETURN to_jsonb(row_out);
END;
$$;
REVOKE ALL ON FUNCTION public.cafe1_save_tenant_plan(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.cafe1_save_tenant_plan(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.cafe1_save_tenant_invoice(_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row_out public.tenant_invoices;
BEGIN
  PERFORM public.cafe1_assert_landlord();
  IF (_payload->>'id') IS NULL THEN
    INSERT INTO public.tenant_invoices (tenant_id, period_start, period_end, amount_cents, status, reference)
    VALUES ((_payload->>'tenant_id')::uuid, (_payload->>'period_start')::date,
      (_payload->>'period_end')::date, COALESCE((_payload->>'amount_cents')::int, 0),
      COALESCE(_payload->>'status','draft'), NULLIF(_payload->>'reference',''))
    RETURNING * INTO row_out;
  ELSE
    UPDATE public.tenant_invoices SET
      amount_cents = COALESCE((_payload->>'amount_cents')::int, amount_cents),
      status = COALESCE(_payload->>'status', status),
      reference = NULLIF(COALESCE(_payload->>'reference', reference),''),
      paid_on = CASE WHEN COALESCE(_payload->>'status', status) = 'paid'
                     THEN COALESCE(paid_on, CURRENT_DATE) ELSE NULL END
    WHERE id = (_payload->>'id')::uuid
    RETURNING * INTO row_out;
  END IF;
  RETURN to_jsonb(row_out);
END;
$$;
REVOKE ALL ON FUNCTION public.cafe1_save_tenant_invoice(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.cafe1_save_tenant_invoice(jsonb) TO authenticated;

-- Seed the default plan ladder and register this deployment as tenant #1.
INSERT INTO public.tenant_plans (code, name, monthly_price_cents, included_orders, max_sites, features)
VALUES
  ('starter', 'Starter', 9900, 500, 1,
   '["Customer ordering site","Kitchen display","Card payments"]'::jsonb),
  ('growth', 'Growth', 19900, 2000, 2,
   '["Everything in Starter","Driver app & live tracking","House accounts","Marketplace order ingest"]'::jsonb),
  ('enterprise', 'Enterprise', 39900, 10000, 10,
   '["Everything in Growth","Multi-site reporting","Custom integrations","Priority support"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.tenants (slug, name, legal_name, primary_domain, deployment_url, status, plan_code, is_self, contact_email)
VALUES ('cafe1stalbans', 'Cafe 1 St Albans', 'Cafe 1 St Albans', 'cafe1stalbans.co.uk',
        'https://cafe1stalbans.co.uk', 'active', 'enterprise', true, 'hello@cafe1stalbans.co.uk')
ON CONFLICT (slug) DO NOTHING;