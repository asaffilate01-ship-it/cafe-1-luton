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
  actor := public.cafe1_assert_operator(false);
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