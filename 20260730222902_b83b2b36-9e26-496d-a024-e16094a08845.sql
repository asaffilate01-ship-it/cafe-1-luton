-- Privileged SECURITY DEFINER routines: server-side (service_role) only.
REVOKE ALL ON FUNCTION public.get_voucher_balance(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_voucher_balance_by_code(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_voucher(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_promo_use(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_voucher_balance(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_voucher_balance_by_code(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_voucher(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_promo_use(text) TO service_role;

-- Internal-only routines: not callable through the Data API.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;

-- Role helper: used by RLS for signed-in users only.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Public checkout helpers stay callable (explicit, least-privilege grants).
REVOKE ALL ON FUNCTION public.validate_promo_code(text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_customer_discount(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_account_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_promo_code(text, integer, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_customer_discount(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_account_code(text) TO anon, authenticated, service_role;