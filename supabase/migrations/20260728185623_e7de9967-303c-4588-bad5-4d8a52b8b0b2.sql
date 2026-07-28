DROP POLICY IF EXISTS "orders_guest_read" ON public.orders;
DROP POLICY IF EXISTS "order_items_guest_read" ON public.order_items;
DROP POLICY IF EXISTS "Live location visible while out for delivery" ON public.driver_locations;

REVOKE SELECT ON public.orders FROM anon;
REVOKE SELECT ON public.order_items FROM anon;
REVOKE SELECT ON public.driver_locations FROM anon;