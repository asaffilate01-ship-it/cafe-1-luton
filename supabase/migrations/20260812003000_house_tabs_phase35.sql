-- Phase 35: atomic house-tab charging with credit-limit enforcement.
--
-- The till prepares one order and this RPC moves that same row to on_account.
-- It never inserts a second order, so the KDS receives exactly one ticket.

create or replace function public.cafe1_quick_add_account(_name text)
returns table(id uuid, name text, existed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text := trim(_name);
  account_row public.accounts%rowtype;
  actor uuid;
begin
  actor := public.cafe1_assert_finance_manager();
  if length(clean_name) < 2 or length(clean_name) > 120 then
    raise exception 'Enter an account or customer name';
  end if;

  select account.* into account_row
  from public.accounts account
  where account.active = true and lower(account.name) = lower(clean_name)
  order by account.created_at
  limit 1;
  if found then
    return query select account_row.id, account_row.name, true;
    return;
  end if;

  -- A counter-only tab deliberately has no customer-facing access code. A
  -- manager may generate and issue one later from Tab accounts if appropriate.
  insert into public.accounts (name, access_code_hash)
  values (clean_name, null)
  returning * into account_row;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, detail
  ) values (
    actor, 'account.counter.quick_add', 'account', account_row.id,
    jsonb_build_object('account_name', account_row.name)
  );

  return query select account_row.id, account_row.name, false;
end
$$;

revoke all on function public.cafe1_quick_add_account(text) from public, anon;
grant execute on function public.cafe1_quick_add_account(text) to authenticated;

create or replace function public.cafe1_charge_order_to_account(
  _order_id uuid,
  _account_id uuid
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  ord public.orders%rowtype;
  acct public.accounts%rowtype;
  unpaid_charges_cents bigint := 0;
  unapplied_payments_cents bigint := 0;
  balance_before_cents bigint := 0;
  order_due_cents integer := 0;
  projected_balance_cents bigint := 0;
begin
  if auth.uid() is null or not (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff')
  ) then
    raise exception 'Staff sign-in required';
  end if;

  -- Serialize charges for one account so two tills cannot both pass the same
  -- remaining credit limit at the same time.
  select * into acct
  from public.accounts
  where id = _account_id and active = true
  for update;
  if not found then raise exception 'That tab account is not available'; end if;

  select * into ord
  from public.orders
  where id = _order_id
  for update;
  if not found then raise exception 'Order not found'; end if;

  -- Safe retry after a slow connection: return the already-linked row without
  -- changing the ledger or emitting another audit event.
  if ord.payment_status = 'on_account' and ord.account_id = _account_id then
    return ord;
  end if;
  if ord.account_id is not null or ord.payment_method = 'account' then
    raise exception 'That order is already linked to a different tab';
  end if;
  if ord.payment_status = 'paid' then raise exception 'That order is already paid'; end if;
  if ord.payment_status not in ('pending') then
    raise exception 'Only an unpaid prepared order can be charged to a tab';
  end if;
  if exists (
    select 1 from public.order_payments payment
    where payment.order_id = ord.id and payment.method <> 'voucher'
  ) then
    raise exception 'That order already has a payment recorded';
  end if;

  select coalesce(sum(greatest(total_cents - refunded_cents, 0)), 0)
  into unpaid_charges_cents
  from public.orders
  where account_id = _account_id and payment_status = 'on_account';

  select coalesce(sum(amount_cents), 0)
  into unapplied_payments_cents
  from public.account_payments
  where account_id = _account_id and settled_at is null;

  balance_before_cents := greatest(unpaid_charges_cents - unapplied_payments_cents, 0);
  order_due_cents := greatest(ord.total_cents - ord.refunded_cents, 0);
  projected_balance_cents := balance_before_cents + order_due_cents;

  if acct.credit_limit_cents is not null
     and projected_balance_cents > acct.credit_limit_cents then
    raise exception 'This tab would exceed its credit limit. Current balance: %, order: %, limit: %',
      to_char(balance_before_cents / 100.0, 'FM£999999990.00'),
      to_char(order_due_cents / 100.0, 'FM£999999990.00'),
      to_char(acct.credit_limit_cents / 100.0, 'FM£999999990.00');
  end if;

  update public.orders set
    account_id = _account_id,
    payment_method = 'account',
    payment_status = 'on_account',
    company_name = coalesce(company_name, acct.name),
    customer_name = case
      when coalesce(nullif(trim(customer_name), ''), 'Counter') = 'Counter' then acct.name
      else customer_name
    end,
    status = case
      when status = 'pending_payment' then 'preparing'::public.order_status
      else status
    end
  where id = ord.id
  returning * into ord;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, terminal, detail
  ) values (
    auth.uid(), 'order.counter.on_account', 'order', ord.id, ord.pos_terminal,
    jsonb_build_object(
      'account_id', _account_id,
      'account_name', acct.name,
      'order_number', ord.order_number,
      'order_due_cents', order_due_cents,
      'balance_before_cents', balance_before_cents,
      'projected_balance_cents', projected_balance_cents,
      'credit_limit_cents', acct.credit_limit_cents
    )
  );

  return ord;
end
$$;

revoke all on function public.cafe1_charge_order_to_account(uuid, uuid)
  from public, anon;
grant execute on function public.cafe1_charge_order_to_account(uuid, uuid)
  to authenticated, service_role;

create or replace function public.cafe1_record_tab_payment(
  _account_id uuid,
  _amount_cents integer,
  _method text,
  _reference text default null,
  _note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  acct public.accounts%rowtype;
  payment_row public.account_payments%rowtype;
  charges_cents bigint := 0;
  prior_payments_cents bigint := 0;
  balance_before_cents bigint := 0;
  balance_after_cents bigint := 0;
  fully_settled boolean := false;
  settled_at_value timestamptz := null;
  paid_orders integer := 0;
  actor uuid;
begin
  actor := public.cafe1_assert_finance_manager();
  if _amount_cents <= 0 then raise exception 'Payment must be greater than zero'; end if;
  if _method not in ('cash', 'card', 'bank_transfer', 'other') then
    raise exception 'Invalid tab payment method';
  end if;

  select * into acct from public.accounts where id = _account_id for update;
  if not found then raise exception 'Tab account not found'; end if;

  select coalesce(sum(greatest(total_cents - refunded_cents, 0)), 0)
  into charges_cents
  from public.orders
  where account_id = _account_id and payment_status = 'on_account';

  select coalesce(sum(amount_cents), 0)
  into prior_payments_cents
  from public.account_payments
  where account_id = _account_id and settled_at is null;

  balance_before_cents := greatest(charges_cents - prior_payments_cents, 0);
  if balance_before_cents = 0 then raise exception 'This tab is already paid'; end if;
  if _amount_cents > balance_before_cents then
    raise exception 'Payment exceeds the outstanding tab balance of %',
      to_char(balance_before_cents / 100.0, 'FM£999999990.00');
  end if;

  balance_after_cents := balance_before_cents - _amount_cents;
  fully_settled := balance_after_cents = 0;
  if fully_settled then settled_at_value := now(); end if;

  insert into public.account_payments (
    account_id, amount_cents, method, reference, note, recorded_by, settled_at
  ) values (
    _account_id, _amount_cents, _method, nullif(trim(_reference), ''),
    nullif(trim(_note), ''), actor, settled_at_value
  ) returning * into payment_row;

  if fully_settled then
    update public.account_payments
    set settled_at = settled_at_value
    where account_id = _account_id and settled_at is null;

    update public.orders
    set payment_status = 'paid'
    where account_id = _account_id and payment_status = 'on_account';
    get diagnostics paid_orders = row_count;
  end if;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, detail
  ) values (
    actor,
    case when fully_settled then 'account.payment.settled' else 'account.payment.partial' end,
    'account', _account_id,
    jsonb_build_object(
      'payment_id', payment_row.id,
      'amount_cents', _amount_cents,
      'method', _method,
      'reference', nullif(trim(_reference), ''),
      'balance_before_cents', balance_before_cents,
      'balance_after_cents', balance_after_cents,
      'paid_orders', paid_orders
    )
  );

  return jsonb_build_object(
    'payment_id', payment_row.id,
    'amount_cents', _amount_cents,
    'balance_before_cents', balance_before_cents,
    'balance_after_cents', balance_after_cents,
    'fully_settled', fully_settled,
    'paid_orders', paid_orders,
    'settled_at', settled_at_value
  );
end
$$;

revoke all on function public.cafe1_record_tab_payment(uuid, integer, text, text, text)
  from public, anon;
grant execute on function public.cafe1_record_tab_payment(uuid, integer, text, text, text)
  to authenticated;
