REVOKE EXECUTE ON FUNCTION public.get_voucher_balance(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_voucher(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_voucher_balance(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_voucher(uuid, uuid, integer) TO service_role;