REVOKE EXECUTE ON FUNCTION public.validate_promo_code(text, integer, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_account_code(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_customer_discount(text) FROM anon, authenticated;

CREATE POLICY "Customers can view the driver location for their own order"
ON public.driver_locations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = driver_locations.order_id
      AND o.customer_id = auth.uid()
  )
);