begin;

select plan(28);

select has_table('public', 'audit_events', 'immutable audit event table exists');
select has_table('public', 'till_shifts', 'till shift table exists');
select has_table('public', 'till_cash_events', 'till cash ledger exists');
select has_table('public', 'payment_attempts', 'payment attempt table exists');
select has_table('public', 'order_payments', 'order tender ledger exists');
select has_table('public', 'order_refunds', 'refund ledger exists');

select has_column('public', 'orders', 'idempotency_key', 'orders have an idempotency key');
select has_column('public', 'orders', 'refunded_cents', 'orders track refunded value');
select has_column('public', 'orders', 'till_shift_id', 'orders retain till shift attribution');
select has_column('public', 'orders', 'sumup_sale_key', 'orders retain one logical SumUp sale key');
select has_index(
  'public',
  'orders',
  'orders_sumup_sale_key_uniq',
  'one SumUp sale can create only one order'
);
select has_column('public', 'accounts', 'access_code_hash', 'account codes are hashable');

select has_function('public', 'open_till_shift', 'atomic shift opening exists');
select has_function('public', 'prepare_counter_order', 'server-priced counter order exists');
select has_function('public', 'finalize_counter_card', 'verified card finalisation exists');
select has_function('public', 'reserve_order_refund', 'idempotent refund reservation exists');
select has_function('public', 'transition_order_status', 'controlled order transitions exist');
select has_function('public', 'claim_delivery_order', 'atomic driver claiming exists');
select has_function('public', 'verify_account_code', 'hashed account-code verification exists');

select ok(
  not has_table_privilege('anon', 'public.orders', 'SELECT'),
  'anonymous users cannot enumerate orders'
);
select ok(
  not has_table_privilege('anon', 'public.orders', 'INSERT'),
  'anonymous users cannot bypass server-priced checkout'
);
select ok(
  not has_table_privilege('anon', 'public.order_items', 'SELECT'),
  'anonymous users cannot enumerate order items'
);
select ok(
  not has_table_privilege('anon', 'public.order_items', 'INSERT'),
  'anonymous users cannot insert arbitrary order items'
);
select ok(
  not has_function_privilege('authenticated', 'public.verify_account_code(text)', 'EXECUTE'),
  'account verification is not directly callable by customers'
);
select ok(
  has_function_privilege('service_role', 'public.verify_account_code(text)', 'EXECUTE'),
  'service role can verify hashed account codes'
);
select ok(
  not has_function_privilege('authenticated', 'public.reserve_order_refund(uuid,uuid,integer,integer,integer,text,uuid,text,text)', 'EXECUTE'),
  'refund reservation is service-only'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.audit_events'::regclass),
  'audit events have row-level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.order_refunds'::regclass),
  'refund records have row-level security enabled'
);

select * from finish();
rollback;
