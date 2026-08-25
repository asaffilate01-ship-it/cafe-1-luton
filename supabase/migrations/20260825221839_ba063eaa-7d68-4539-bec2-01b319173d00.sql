-- 1) Site scoping helpers -------------------------------------------------
create or replace function public.cafe1_current_site_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select nullif(coalesce(
    auth.jwt() -> 'app_metadata' ->> 'site_id',
    auth.jwt() ->> 'site_id'
  ), '')::uuid
$$;

create or replace function public.cafe1_can_access_site(_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.has_role(auth.uid(), 'admin') then true
    when not public.has_role(auth.uid(), 'staff') then false
    when public.cafe1_current_site_id() is not null
      then _site_id is null or _site_id = public.cafe1_current_site_id()
    else (select count(*) from public.sites where active) <= 1
  end
$$;

revoke all on function public.cafe1_current_site_id() from public, anon;
revoke all on function public.cafe1_can_access_site(uuid) from public, anon;
grant execute on function public.cafe1_current_site_id() to authenticated, service_role;
grant execute on function public.cafe1_can_access_site(uuid) to authenticated, service_role;

-- 2) Orders --------------------------------------------------------------
drop policy if exists orders_staff_read on public.orders;
create policy orders_staff_read on public.orders
  for select to authenticated
  using (public.has_role(auth.uid(), 'staff') and public.cafe1_can_access_site(site_id));

-- 3) House accounts ------------------------------------------------------
alter table public.accounts add column if not exists site_id uuid references public.sites(id);
drop policy if exists accounts_staff_read on public.accounts;
create policy accounts_staff_read on public.accounts
  for select to authenticated
  using (public.cafe1_can_access_site(site_id));

-- 4) Operational tables ---------------------------------------------------
drop policy if exists operations_staff_read_inventory on public.inventory_items;
create policy operations_staff_read_inventory on public.inventory_items
  for select to authenticated using (public.cafe1_can_access_site(site_id));

drop policy if exists operations_staff_read_suppliers on public.suppliers;
create policy operations_staff_read_suppliers on public.suppliers
  for select to authenticated using (public.cafe1_can_access_site(site_id));

drop policy if exists operations_staff_read_movements on public.stock_movements;
create policy operations_staff_read_movements on public.stock_movements
  for select to authenticated using (public.cafe1_can_access_site(site_id));

drop policy if exists operations_staff_read_purchase_orders on public.purchase_orders;
create policy operations_staff_read_purchase_orders on public.purchase_orders
  for select to authenticated using (public.cafe1_can_access_site(site_id));

drop policy if exists operations_staff_read_purchase_items on public.purchase_order_items;
create policy operations_staff_read_purchase_items on public.purchase_order_items
  for select to authenticated using (
    exists (
      select 1 from public.purchase_orders po
      where po.id = purchase_order_items.purchase_order_id
        and public.cafe1_can_access_site(po.site_id)
    )
  );

drop policy if exists operations_staff_read_stocktakes on public.stocktakes;
create policy operations_staff_read_stocktakes on public.stocktakes
  for select to authenticated using (public.cafe1_can_access_site(site_id));

drop policy if exists operations_staff_read_stocktake_lines on public.stocktake_lines;
create policy operations_staff_read_stocktake_lines on public.stocktake_lines
  for select to authenticated using (
    exists (
      select 1 from public.stocktakes st
      where st.id = stocktake_lines.stocktake_id
        and public.cafe1_can_access_site(st.site_id)
    )
  );

drop policy if exists operations_staff_read_checklists on public.operational_checklists;
create policy operations_staff_read_checklists on public.operational_checklists
  for select to authenticated using (public.cafe1_can_access_site(site_id));

drop policy if exists operations_staff_read_completions on public.checklist_completions;
create policy operations_staff_read_completions on public.checklist_completions
  for select to authenticated using (
    exists (
      select 1 from public.operational_checklists c
      where c.id = checklist_completions.checklist_id
        and public.cafe1_can_access_site(c.site_id)
    )
  );

drop policy if exists operations_staff_read_summaries on public.daily_control_summaries;
create policy operations_staff_read_summaries on public.daily_control_summaries
  for select to authenticated using (public.cafe1_can_access_site(site_id));

drop policy if exists kds_stations_staff_read on public.kds_stations;
create policy kds_stations_staff_read on public.kds_stations
  for select to authenticated using (public.cafe1_can_access_site(site_id));

drop policy if exists till_shifts_staff_read on public.till_shifts;
create policy till_shifts_staff_read on public.till_shifts
  for select to authenticated
  using (
    public.cafe1_can_access_site(site_id)
    and (public.has_role(auth.uid(), 'admin') or staff_id = auth.uid())
  );

-- 5) Business settings ----------------------------------------------------
drop policy if exists biz_read on public.business_settings;
create policy business_settings_staff_read on public.business_settings
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

create or replace view public.business_public_settings as
  select id, name, accepting_orders, allow_preorder_when_closed, prep_minutes,
         delivery_minutes, min_order_cents, delivery_fee_cents,
         free_delivery_threshold_cents, closed_message, updated_at,
         delivery_open_time, delivery_close_time, delivery_origin_postcode,
         delivery_radius_m, site_id, vat_registered, deliveroo_url, justeat_url
  from public.business_settings;

grant select on public.business_public_settings to anon, authenticated, service_role;

-- 6) Signed-out callers may not execute internal routines -----------------
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
      and p.proname not in ('has_role', 'is_court_working_day')
  loop
    execute format('revoke all on function %s from anon, public', fn.sig);
    execute format('grant execute on function %s to authenticated, service_role', fn.sig);
  end loop;
end $$;

-- Trigger/internal-only routines are not callable by signed-in users either.
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in (
        'handle_new_user','guard_profile_reward_columns','tg_set_updated_at',
        'cafe1_post_order_inventory','cafe1_snapshot_order_item_cost',
        'award_loyalty_for_order','refund_loyalty_points','spend_loyalty_points',
        'consume_promo_use','increment_promo_use','validate_promo_code',
        'get_customer_discount','verify_account_code','complete_order_refund',
        'redeem_voucher','opt_in_voucher','opt_in_voucher_secure',
        'juror_opt_in_with_id','verify_juror_voucher_credentials',
        'cafe1_verify_juror_id','reserve_juror_voucher',
        'release_juror_voucher_reservation','attach_juror_voucher_reservation',
        'get_voucher_balance','get_voucher_balance_by_code','get_juror_claim_rows',
        'cafe1_consume_juror_challenge','cafe1_consume_juror_challenge_v2',
        'cafe1_create_juror_challenge','prepare_counter_order',
        'prepare_counter_order_secure','court_staff_profile'
      )
  loop
    execute format('revoke all on function %s from anon, authenticated, public', fn.sig);
    execute format('grant execute on function %s to service_role', fn.sig);
  end loop;
end $$;
