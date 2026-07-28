CREATE UNIQUE INDEX IF NOT EXISTS voucher_holders_code_key ON public.voucher_holders (upper(code));
ALTER TABLE public.voucher_holders ADD CONSTRAINT voucher_holders_code_unique UNIQUE (code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voucher_holders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voucher_allocations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voucher_redemptions TO authenticated;
GRANT ALL ON public.voucher_holders TO service_role;
GRANT ALL ON public.voucher_allocations TO service_role;
GRANT ALL ON public.voucher_redemptions TO service_role;