create or replace function public.cafe1_charge_order_to_account(_order_id uuid, _account_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  ord public.orders%rowtype;
  acct public.accounts%rowtype;
begin
  if auth.uid() is null or not (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff')
  ) then raise exception 'Forbidden'; end if;

  select * into acct from public.accounts where id = _account_id and active = true;
  if not found then raise exception 'That tab account is not available'; end if;

  select * into ord from public.orders where id = _order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if ord.payment_status = 'paid' then raise exception 'That order is already paid'; end if;
  if exists (select 1 from public.order_payments p where p.order_id = ord.id and p.method <> 'voucher') then
    raise exception 'That order already has a payment recorded';
  end if;

  update public.orders set
    account_id = _account_id,
    payment_method = 'account',
    payment_status = 'on_account',
    company_name = coalesce(company_name, acct.name),
    customer_name = case when coalesce(nullif(trim(customer_name), ''), 'Counter') = 'Counter'
                         then acct.name else customer_name end,
    status = case when status = 'pending_payment' then 'preparing'::public.order_status else status end
  where id = ord.id
  returning * into ord;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, terminal, detail)
  values (auth.uid(), 'order.counter.on_account', 'order', ord.id, ord.pos_terminal,
    jsonb_build_object('account_id', _account_id, 'account_name', acct.name,
      'order_number', ord.order_number, 'total_cents', ord.total_cents));

  return ord;
end $$;