begin;

select plan(41);

select has_table('public', 'sites', 'sites table exists');
select has_table('public', 'inventory_items', 'inventory table exists');
select has_table('public', 'recipe_components', 'recipe table exists');
select has_table('public', 'stock_movements', 'stock ledger exists');
select has_table('public', 'stocktakes', 'stocktake table exists');
select has_table('public', 'operational_checklists', 'control checklist table exists');
select has_table('public', 'staff_time_entries', 'staff time table exists');
select has_table('public', 'daily_control_summaries', 'daily accounts summary exists');
select has_table('public', 'kds_stations', 'kitchen station table exists');
select has_table('public', 'customer_favourites', 'customer favourites exist');
select has_table('public', 'customer_feedback', 'customer feedback exists');
select has_table('public', 'juror_attendance_challenges', 'juror challenge table exists');
select has_table('public', 'system_alerts', 'system alert table exists');

select has_column('public', 'menu_items', 'barcode', 'menu barcode exists');
select has_column('public', 'menu_items', 'allergens', 'menu allergens exist');
select has_column('public', 'menu_items', 'cost_cents', 'menu food cost exists');
select has_column('public', 'menu_items', 'prep_seconds', 'menu prep target exists');
select has_column('public', 'menu_items', 'station_code', 'menu kitchen station exists');
select has_column('public', 'orders', 'operator_id', 'counter operator attribution exists');
select has_column('public', 'orders', 'inventory_posted_at', 'inventory posting guard exists');

select has_function('public', 'cafe1_inventory_dashboard', 'inventory dashboard RPC exists');
select has_function('public', 'cafe1_record_stock_movement', 'stock movement RPC exists');
select has_function('public', 'cafe1_start_stocktake', 'stocktake start RPC exists');
select has_function('public', 'cafe1_complete_stocktake', 'stocktake completion RPC exists');
select has_function('public', 'cafe1_operations_dashboard', 'operations dashboard RPC exists');
select has_function('public', 'cafe1_generate_daily_summary', 'daily accounts RPC exists');
select has_function('public', 'cafe1_clock_staff', 'staff clock RPC exists');
select has_function('public', 'cafe1_customer_favourites', 'favourites read RPC exists');
select has_function('public', 'cafe1_submit_feedback', 'feedback RPC exists');
select has_function('public', 'cafe1_security_dashboard', 'security dashboard RPC exists');
select has_function('public', 'cafe1_create_juror_challenge', 'juror challenge RPC exists');
select has_function('public', 'cafe1_consume_juror_challenge', 'juror verification RPC exists');

select is(
  (select postcode from public.sites where code = 'LUTON'),
  'LU1 2AA',
  'confirmed Luton postcode is applied'
);
select ok(
  not has_column_privilege('anon', 'public.menu_items', 'cost_cents', 'SELECT'),
  'anonymous menu reads cannot see internal cost'
);
select ok(
  not has_column_privilege('authenticated', 'public.menu_items', 'barcode', 'SELECT'),
  'customer tokens cannot read operational barcodes directly'
);
select ok(
  has_column_privilege('anon', 'public.menu_items', 'price_cents', 'SELECT'),
  'public menu price remains readable'
);
select ok(
  has_column_privilege('authenticated', 'public.menu_items', 'allergens', 'SELECT'),
  'authenticated customers can read allergen information'
);
select ok(
  position('auth.jwt()' in pg_get_functiondef('public.cafe1_assert_operator(boolean)'::regprocedure)) > 0
    and position('aal2' in pg_get_functiondef('public.cafe1_assert_operator(boolean)'::regprocedure)) > 0,
  'manager database actions enforce AAL2'
);
select ok(
  not has_function_privilege('anon', 'public.cafe1_assert_operator(boolean)', 'EXECUTE'),
  'operator guard is not anonymous'
);
select ok(
  has_function_privilege('authenticated', 'public.cafe1_assert_operator(boolean)', 'EXECUTE'),
  'authenticated operators can call the guarded RPC boundary'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and policyname = 'sites_public_read'),
  1,
  'operations policies are installed once'
);

select * from finish();
rollback;
