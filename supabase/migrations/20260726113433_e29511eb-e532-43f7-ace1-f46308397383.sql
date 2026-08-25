
ALTER TABLE public.voucher_holders ADD COLUMN IF NOT EXISTS code text;
UPDATE public.voucher_holders SET code = upper(substr(replace(id::text,'-',''),1,8)) WHERE code IS NULL;
ALTER TABLE public.voucher_holders ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS voucher_holders_code_uniq ON public.voucher_holders (upper(code));
ALTER TABLE public.voucher_holders ALTER COLUMN name DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.get_voucher_balance_by_code(_code text)
 RETURNS TABLE(holder_id uuid, holder_name text, code text, allocated_cents integer, used_cents integer, remaining_cents integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT h.id,
         h.name,
         h.code,
         COALESCE(a.amount_cents,0),
         COALESCE((SELECT SUM(r.amount_cents)::int FROM public.voucher_redemptions r
                    WHERE r.holder_id = h.id AND r.for_date = CURRENT_DATE),0),
         GREATEST(COALESCE(a.amount_cents,0) - COALESCE((SELECT SUM(r.amount_cents)::int FROM public.voucher_redemptions r
                    WHERE r.holder_id = h.id AND r.for_date = CURRENT_DATE),0), 0)
    FROM public.voucher_holders h
    LEFT JOIN public.voucher_allocations a ON a.holder_id = h.id AND a.for_date = CURRENT_DATE
   WHERE h.active = true
     AND _code IS NOT NULL AND trim(_code) <> ''
     AND upper(h.code) = upper(trim(_code))
   LIMIT 1
$function$;

REVOKE ALL ON FUNCTION public.get_voucher_balance_by_code(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_voucher_balance_by_code(text) TO service_role;
