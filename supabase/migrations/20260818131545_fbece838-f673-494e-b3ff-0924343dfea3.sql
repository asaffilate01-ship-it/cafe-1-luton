CREATE OR REPLACE FUNCTION public.cafe1_settle_tab_order(_order_id uuid, _method text)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ord public.orders%rowtype;
  actor uuid;
  method text := lower(nullif(trim(coalesce(_method, '')), ''));
begin
  actor := public.cafe1_assert_operator(false);
  if method is null or method not in ('cash', 'card', 'bank_transfer', 'other') then
    raise exception 'Choose how the tab order was paid';
  end if;

  select * into ord from public.orders where id = _order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if ord.payment_status = 'paid' then
    return ord;
  end if;
  if ord.payment_status <> 'on_account' then
    raise exception 'Only a house-tab order can be settled here';
  end if;

  insert into public.order_payments (order_id, method, amount_cents, received_by)
  values (ord.id, method, ord.total_cents, actor);

  update public.orders set
    payment_status = 'paid',
    payment_method = method
  where id = ord.id
  returning * into ord;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, terminal, detail
  ) values (
    actor, 'order.tab.settled', 'order', ord.id, ord.pos_terminal,
    jsonb_build_object('order_number', ord.order_number, 'method', method, 'total_cents', ord.total_cents)
  );

  return ord;
end
$function$;

REVOKE ALL ON FUNCTION public.cafe1_settle_tab_order(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cafe1_settle_tab_order(uuid, text) TO authenticated;