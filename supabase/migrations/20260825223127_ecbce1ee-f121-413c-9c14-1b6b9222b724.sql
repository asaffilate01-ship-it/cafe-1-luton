-- Remove blanket anon read of business_settings (exposes vat_number and
-- court_staff_discount_percent) and replace it with column-level grants that
-- only cover customer-facing fields.
REVOKE SELECT ON public.business_settings FROM anon;

GRANT SELECT (
  id, name, accepting_orders, allow_preorder_when_closed, prep_minutes,
  delivery_minutes, min_order_cents, delivery_fee_cents,
  free_delivery_threshold_cents, closed_message, updated_at,
  delivery_open_time, delivery_close_time, delivery_origin_postcode,
  delivery_radius_m, site_id, vat_registered, deliveroo_url, justeat_url
) ON public.business_settings TO anon;

DROP POLICY IF EXISTS business_settings_public_read ON public.business_settings;
CREATE POLICY business_settings_public_read
  ON public.business_settings
  FOR SELECT
  TO anon
  USING (true);