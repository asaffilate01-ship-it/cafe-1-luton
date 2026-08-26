-- Loyalty balances are money-like values. Customers may read their own balance,
-- but only trusted server operations may change points, stamps or free drinks.

revoke insert, update on table public.profiles from anon;
revoke insert, update on table public.profiles from authenticated;

-- Keep ordinary profile editing available. Existing row-level policies still
-- decide whether the signed-in person may update a particular profile row.
grant update (full_name, email, phone, updated_at)
  on table public.profiles to authenticated;

do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'award_loyalty_for_order',
        'spend_loyalty_points',
        'refund_loyalty_points'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end
$$;
