REVOKE EXECUTE ON FUNCTION public.increment_promo_use(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_promo_use(text) TO service_role;