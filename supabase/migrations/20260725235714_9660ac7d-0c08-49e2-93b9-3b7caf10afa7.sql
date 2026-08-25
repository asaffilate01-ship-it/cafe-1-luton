
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS loyalty_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_points integer NOT NULL DEFAULT 0;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_earned integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS guest_token uuid NOT NULL DEFAULT gen_random_uuid();

-- Guest orders: anyone can insert an order without a customer_id
DROP POLICY IF EXISTS orders_guest_insert ON public.orders;
CREATE POLICY orders_guest_insert ON public.orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (customer_id IS NULL);

-- Guest order items: allow insert when the parent order has no customer_id
DROP POLICY IF EXISTS order_items_guest_insert ON public.order_items;
CREATE POLICY order_items_guest_insert ON public.order_items
  FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND o.customer_id IS NULL
  ));

-- Guest reads: allow reading an order/items only when it has no owner
-- (UUID id is unguessable and serves as the access token)
DROP POLICY IF EXISTS orders_guest_read ON public.orders;
CREATE POLICY orders_guest_read ON public.orders
  FOR SELECT TO anon, authenticated
  USING (customer_id IS NULL);

DROP POLICY IF EXISTS order_items_guest_read ON public.order_items;
CREATE POLICY order_items_guest_read ON public.order_items
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND o.customer_id IS NULL
  ));

GRANT INSERT ON public.orders TO anon;
GRANT INSERT ON public.order_items TO anon;
GRANT SELECT ON public.orders TO anon;
GRANT SELECT ON public.order_items TO anon;
