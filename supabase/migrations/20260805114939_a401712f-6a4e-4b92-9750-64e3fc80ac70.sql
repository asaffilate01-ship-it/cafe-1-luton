DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE deliveroo_order_id = 'hub:HUBTEST1');
DELETE FROM public.orders WHERE deliveroo_order_id = 'hub:HUBTEST1';