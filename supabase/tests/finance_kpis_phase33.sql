begin;

select plan(22);

select has_table('public','business_expenses','operating expense ledger exists');
select has_table('public','sumup_settlements','SumUp settlement ledger exists');
select has_column('public','order_items','unit_cost_cents','sale lines retain cost snapshots');
select has_column('public','purchase_orders','invoice_number','supplier invoices are recorded');
select has_column('public','purchase_orders','total_cost_cents','supplier receipt total is recorded');
select has_trigger('public','order_items','order_items_snapshot_cost','new sale lines snapshot menu cost');

select has_function('public','cafe1_finance_dashboard','manager KPI and P&L RPC exists');
select has_function('public','cafe1_save_expense','audited expense posting RPC exists');
select has_function('public','cafe1_void_expense','audited expense correction RPC exists');
select has_function('public','cafe1_save_supplier','supplier master RPC exists');
select has_function('public','cafe1_receive_purchase','supplier receipt RPC exists');
select has_function('public','cafe1_import_sumup_expenses','SumUp expense import RPC exists');
select has_function('public','cafe1_import_sumup_settlements','SumUp settlement import RPC exists');
select has_function('public','cafe1_assert_finance_manager','finance MFA boundary exists');

select ok(
  not has_function_privilege('anon','public.cafe1_finance_dashboard(uuid,date,date)','EXECUTE'),
  'anonymous users cannot read management financials'
);
select ok(
  has_function_privilege('authenticated','public.cafe1_finance_dashboard(uuid,date,date)','EXECUTE'),
  'authenticated managers can enter the guarded financial boundary'
);
select ok(
  not has_function_privilege('authenticated','public.cafe1_assert_finance_manager()','EXECUTE'),
  'the internal AAL2 assertion cannot be called directly'
);
select ok(
  not has_column_privilege('authenticated','public.order_items','unit_cost_cents','SELECT'),
  'customer order-item reads cannot see internal cost snapshots'
);
select ok(
  has_column_privilege('authenticated','public.order_items','name','SELECT'),
  'safe order-item descriptions remain readable under RLS'
);
select is(
  (select count(*)::integer from pg_policies where schemaname='public' and policyname='business_expenses_admin_read'),
  1,
  'expense ledger has one manager-only read policy'
);
select is(
  (select count(*)::integer from pg_policies where schemaname='public' and policyname='sumup_settlements_admin_read'),
  1,
  'settlement ledger has one manager-only read policy'
);
select has_index('public','business_expenses','business_expenses_provider_ref_uniq','provider references prevent duplicate expenses');

select * from finish();
rollback;
