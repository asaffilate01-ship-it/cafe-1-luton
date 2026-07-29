CREATE TABLE public.code_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  ident text NOT NULL,
  ok boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.code_attempts TO service_role;
GRANT SELECT ON public.code_attempts TO authenticated;
ALTER TABLE public.code_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view code attempts" ON public.code_attempts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX code_attempts_lookup_idx ON public.code_attempts (kind, ident, created_at DESC);

CREATE OR REPLACE FUNCTION public.consume_promo_use(_code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH upd AS (
    UPDATE public.promo_codes
       SET uses = uses + 1
     WHERE upper(code) = upper(_code)
       AND active = true
       AND (max_uses IS NULL OR uses < max_uses)
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM upd);
$$;
REVOKE ALL ON FUNCTION public.consume_promo_use(text) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.validate_promo_code(text, integer, text);
CREATE OR REPLACE FUNCTION public.validate_promo_code(_code text, _subtotal_cents integer, _order_type text, _email text DEFAULT NULL)
RETURNS TABLE(code text, discount_type promo_discount_type, discount_value integer, discount_cents integer, message text, valid boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.promo_codes%ROWTYPE;
  d int := 0;
  prior int := 0;
BEGIN
  SELECT * INTO c FROM public.promo_codes WHERE upper(promo_codes.code) = upper(_code) LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT _code, 'percent'::public.promo_discount_type, 0, 0, 'Code not found', false; RETURN;
  END IF;
  IF c.active IS NOT TRUE THEN
    RETURN QUERY SELECT c.code, c.discount_type, c.discount_value, 0, 'Code is inactive', false; RETURN;
  END IF;
  IF c.starts_at IS NOT NULL AND c.starts_at > now() THEN
    RETURN QUERY SELECT c.code, c.discount_type, c.discount_value, 0, 'Code not active yet', false; RETURN;
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN QUERY SELECT c.code, c.discount_type, c.discount_value, 0, 'Code has expired', false; RETURN;
  END IF;
  IF c.max_uses IS NOT NULL AND c.uses >= c.max_uses THEN
    RETURN QUERY SELECT c.code, c.discount_type, c.discount_value, 0, 'Code usage limit reached', false; RETURN;
  END IF;
  IF _subtotal_cents < c.min_subtotal_cents THEN
    RETURN QUERY SELECT c.code, c.discount_type, c.discount_value, 0,
      'Minimum spend of £' || round(c.min_subtotal_cents/100.0,2) || ' required', false; RETURN;
  END IF;
  IF c.applies_to <> 'all' AND c.applies_to <> _order_type THEN
    RETURN QUERY SELECT c.code, c.discount_type, c.discount_value, 0,
      'Code only valid for ' || c.applies_to || ' orders', false; RETURN;
  END IF;

  IF c.first_order_only THEN
    IF _email IS NULL OR trim(_email) = '' THEN
      RETURN QUERY SELECT c.code, c.discount_type, c.discount_value, 0,
        'Enter your email address to use this first-order code', false; RETURN;
    END IF;
    SELECT count(*)::int INTO prior FROM public.orders o
      WHERE lower(o.customer_email) = lower(trim(_email))
        AND o.status NOT IN ('cancelled','pending_payment');
    IF prior > 0 THEN
      RETURN QUERY SELECT c.code, c.discount_type, c.discount_value, 0,
        'This code is for first orders only', false; RETURN;
    END IF;
  END IF;

  IF c.discount_type = 'percent' THEN
    d := (_subtotal_cents * c.discount_value) / 100;
  ELSIF c.discount_type = 'fixed_amount' THEN
    d := LEAST(c.discount_value, _subtotal_cents);
  ELSE
    d := 0;
  END IF;

  RETURN QUERY SELECT c.code, c.discount_type, c.discount_value, d, NULL::text, true;
END $function$;
REVOKE ALL ON FUNCTION public.validate_promo_code(text, integer, text, text) FROM PUBLIC, anon, authenticated;
-- end of migration