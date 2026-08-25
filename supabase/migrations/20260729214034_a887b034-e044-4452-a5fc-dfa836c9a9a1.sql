DROP POLICY IF EXISTS orders_customer_insert ON public.orders;
DROP POLICY IF EXISTS orders_guest_insert ON public.orders;
DROP POLICY IF EXISTS order_items_insert ON public.order_items;
DROP POLICY IF EXISTS order_items_guest_insert ON public.order_items;

REVOKE INSERT ON public.orders FROM anon;
REVOKE INSERT ON public.order_items FROM anon;

CREATE POLICY order_items_staff_insert ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));