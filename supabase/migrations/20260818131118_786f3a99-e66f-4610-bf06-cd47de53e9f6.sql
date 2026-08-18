ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_reason text;

CREATE OR REPLACE FUNCTION public.cafe1_cancel_tab_order(_order_id uuid, _reason text)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ord public.orders%rowtype;
  actor uuid;
  reason text := nullif(trim(coalesce(_reason, '')), '');
begin
  actor := public.cafe1_assert_operator(false);
  if reason is null or length(reason) < 3 then
    raise exception 'A short cancellation reason is required';
  end if;

  select * into ord from public.orders where id = _order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if ord.status = 'cancelled' then
    return ord;
  end if;
  if ord.payment_status <> 'on_account' or ord.account_id is null then
    raise exception 'Only an unpaid house-tab order can be cancelled here';
  end if;
  if ord.status in ('completed', 'delivered', 'refunded') then
    raise exception 'That order is already finished and cannot be cancelled';
  end if;
  if exists (
    select 1 from public.order_payments payment
    where payment.order_id = ord.id and payment.method <> 'voucher'
  ) then
    raise exception 'That order already has a payment recorded';
  end if;

  update public.orders set
    status = 'cancelled',
    payment_status = 'pending',
    payment_method = null,
    account_id = null,
    cancelled_at = now(),
    cancellation_reason = reason
  where id = ord.id
  returning * into ord;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, terminal, detail
  ) values (
    actor, 'order.tab.cancelled', 'order', ord.id, ord.pos_terminal,
    jsonb_build_object(
      'order_number', ord.order_number,
      'reason', reason,
      'total_cents', ord.total_cents
    )
  );

  return ord;
end
$function$;