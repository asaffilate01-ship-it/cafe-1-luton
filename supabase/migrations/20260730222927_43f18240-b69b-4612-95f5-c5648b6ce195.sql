REVOKE EXECUTE ON FUNCTION public.get_voucher_balance_by_code(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.opt_in_voucher(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_court_working_day(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_voucher_balance_by_code(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.opt_in_voucher(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_court_working_day(date) TO service_role;