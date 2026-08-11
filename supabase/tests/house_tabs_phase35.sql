begin;

select plan(14);

select has_table('public', 'accounts', 'house-tab accounts exist');
select has_table('public', 'account_payments', 'house-tab payment history exists');
select has_column('public', 'orders', 'account_id', 'orders retain their tab account');
select has_function(
  'public',
  'cafe1_charge_order_to_account',
  array['uuid', 'uuid'],
  'one-order tab charging RPC exists'
);
select has_function(
  'public',
  'cafe1_record_tab_payment',
  array['uuid', 'integer', 'text', 'text', 'text'],
  'atomic part-payment and full-settlement RPC exists'
);
select has_function(
  'public',
  'cafe1_quick_add_account',
  array['text'],
  'audited counter tab creation RPC exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.cafe1_charge_order_to_account(uuid,uuid)',
    'EXECUTE'
  ),
  'anonymous users cannot charge a house tab'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.cafe1_record_tab_payment(uuid,integer,text,text,text)',
    'EXECUTE'
  ),
  'anonymous users cannot settle house tabs'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.cafe1_record_tab_payment(uuid,integer,text,text,text)',
    'EXECUTE'
  ),
  'signed-in managers can enter the internally guarded settlement boundary'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.cafe1_quick_add_account(text)',
    'EXECUTE'
  ),
  'anonymous users cannot create house tabs'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.cafe1_quick_add_account(text)',
    'EXECUTE'
  ),
  'signed-in managers can enter the internally guarded tab-creation boundary'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.cafe1_charge_order_to_account(uuid,uuid)',
    'EXECUTE'
  ),
  'signed-in operators can enter the guarded tab boundary'
);
select ok(
  (select proconfig @> array['search_path=public']
   from pg_proc
   where oid = 'public.cafe1_charge_order_to_account(uuid,uuid)'::regprocedure),
  'tab charging pins its security-definer search path'
);
select is(
  (select count(*)::integer
   from pg_indexes
   where schemaname = 'public' and indexname = 'orders_account_id_idx'),
  1,
  'tab order history has an account index'
);

select * from finish();
rollback;
