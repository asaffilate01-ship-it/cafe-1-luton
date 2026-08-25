revoke select on public.business_settings from anon;
grant select (
  id, name, accepting_orders, allow_preorder_when_closed, prep_minutes, delivery_minutes,
  min_order_cents, delivery_fee_cents, free_delivery_threshold_cents, closed_message,
  updated_at, delivery_open_time, delivery_close_time, delivery_origin_postcode,
  delivery_radius_m, site_id, vat_registered, court_staff_discount_percent
) on public.business_settings to anon;
revoke insert, update, delete on public.business_settings from anon;

revoke all on public.juror_attendance_challenges from anon, authenticated;
revoke all on public.juror_attendance_consumptions from anon, authenticated;
revoke all on public.juror_daily_presence from anon, authenticated;
grant all on public.juror_attendance_challenges to service_role;
grant all on public.juror_attendance_consumptions to service_role;
grant all on public.juror_daily_presence to service_role;