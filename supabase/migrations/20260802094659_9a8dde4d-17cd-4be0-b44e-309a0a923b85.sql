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

CREATE OR REPLACE FUNCTION public.cafe1_set_counter_operator()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.source='counter' AND NEW.operator_id IS NULL THEN NEW.operator_id:=auth.uid(); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_set_counter_operator ON public.orders;
CREATE TRIGGER orders_set_counter_operator BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.cafe1_set_counter_operator();

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
    WHERE n.nspname='public' AND p.proname LIKE 'cafe1\_%' AND p.proname <> 'cafe1_assert_operator'
      AND p.prorettype <> 'trigger'::regtype
  LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION '||r.fn||' FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION '||r.fn||' TO authenticated, service_role';
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.cafe1_consume_juror_challenge(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cafe1_consume_juror_challenge(text,text) TO service_role;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sites','inventory_items','recipe_components','suppliers','purchase_orders','purchase_order_items'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t||'_updated', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at()', t||'_updated', t);
  END LOOP;
END $$;