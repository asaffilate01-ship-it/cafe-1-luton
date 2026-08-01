begin;

select plan(17);

select has_table('public', 'audit_events', 'audit table exists');
select has_table('public', 'till_shifts', 'till shift table exists');
select has_table('public', 'till_cash_events', 'cash ledger exists');
select has_table('public', 'payment_attempts', 'payment attempts exist');
select has_table('public', 'order_payments', 'payment ledger exists');
select has_table('public', 'order_refunds', 'refund ledger exists');
select has_column('public', 'orders', 'idempotency_key', 'orders are idempotent');
select has_column('public', 'orders', 'refunded_cents', 'refund total exists');
select has_column('public', 'orders', 'tracking_token_hash', 'tracking bearer hash exists');
select has_column('public', 'accounts', 'access_code_hash', 'account code hash exists');
select has_function('public', 'prepare_counter_order', 'counter order RPC exists');
select has_function('public', 'finalize_counter_card', 'card finalisation RPC exists');
select has_function('public', 'transition_order_status', 'status RPC exists');
select has_function('public', 'claim_delivery_order', 'delivery claim RPC exists');
select has_function('public', 'award_loyalty_for_order', 'loyalty RPC exists');
select has_function('public', 'complete_order_refund', 'refund completion RPC exists');
select has_function('public', 'reserve_order_refund', 'refund reservation RPC exists');

select * from finish();
rollback;
