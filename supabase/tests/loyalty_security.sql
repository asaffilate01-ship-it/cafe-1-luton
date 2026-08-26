begin;

select plan(9);

select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'loyalty_points', 'UPDATE'),
  'customers cannot update loyalty points'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'lifetime_points', 'UPDATE'),
  'customers cannot update lifetime points'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'drink_stamps', 'UPDATE'),
  'customers cannot update drink stamps'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'free_drinks_available', 'UPDATE'),
  'customers cannot create free drinks'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'free_drinks_redeemed', 'UPDATE'),
  'customers cannot alter redeemed drink history'
);
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE'),
  'customers retain ordinary profile editing'
);
select ok(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'award_loyalty_for_order'
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  'customers cannot award loyalty through the database function'
);
select ok(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'spend_loyalty_points'
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  'customers cannot spend another balance directly'
);
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'award_loyalty_for_order'
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
  ),
  'trusted server can award loyalty after confirmed payment'
);

select * from finish();
rollback;
