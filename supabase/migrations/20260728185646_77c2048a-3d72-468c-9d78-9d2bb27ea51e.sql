REVOKE EXECUTE ON FUNCTION public.redeem_voucher(uuid, uuid, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_promo_use(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_voucher_balance(text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_voucher_balance_by_code(text) FROM anon, authenticated;