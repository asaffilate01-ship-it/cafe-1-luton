drop view if exists public.business_public_settings;

revoke select on public.business_settings from anon;
grant select (
  id, name, accepting_orders, allow_preorder_when_closed, prep_minutes,
  delivery_minutes, min_order_cents, delivery_fee_cents,
  free_delivery_threshold_cents, closed_message, updated_at,
  delivery_open_time, delivery_close_time, delivery_origin_postcode,
  delivery_radius_m, site_id, vat_registered, deliveroo_url, justeat_url
) on public.business_settings to anon;

drop policy if exists business_settings_public_read on public.business_settings;
create policy business_settings_public_read on public.business_settings
  for select to anon using (true);

revoke all on function public.has_role(uuid, app_role) from anon, public;
revoke all on function public.is_court_working_day(date) from anon, public;
grant execute on function public.has_role(uuid, app_role) to authenticated, service_role;
grant execute on function public.is_court_working_day(date) to authenticated, service_role;
