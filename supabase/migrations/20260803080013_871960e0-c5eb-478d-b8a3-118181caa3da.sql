DO $$
DECLARE dev_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO dev_ids FROM auth.users WHERE email LIKE '%@cafe1.test';
  IF dev_ids IS NULL THEN RETURN; END IF;

  DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE customer_id = ANY(dev_ids));
  DELETE FROM public.orders WHERE customer_id = ANY(dev_ids);
  DELETE FROM public.user_roles WHERE user_id = ANY(dev_ids);
  DELETE FROM public.profiles WHERE id = ANY(dev_ids);
  DELETE FROM auth.users WHERE id = ANY(dev_ids);
END $$;