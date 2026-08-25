CREATE OR REPLACE FUNCTION public.cafe1_verify_juror_id(_code text)
RETURNS TABLE(ok boolean, message text, code text, opted_in boolean, valid_until date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  normalised text;
  holder public.voucher_holders%ROWTYPE;
BEGIN
  normalised := upper(regexp_replace(COALESCE(_code, ''), '[^A-Za-z0-9\-]', '', 'g'));
  IF length(normalised) < 3 THEN
    RETURN QUERY SELECT false, 'Please enter your Juror ID exactly as HMCTS issued it.', NULL::text, false, NULL::date;
    RETURN;
  END IF;

  SELECT * INTO holder FROM public.voucher_holders WHERE upper(code) = normalised;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'That Juror ID is not recognised. Please check the sheet from the Jury Officer.', NULL::text, false, NULL::date;
    RETURN;
  END IF;
  IF NOT holder.active THEN
    RETURN QUERY SELECT false, 'This Juror ID has been deactivated. Please speak to the Jury Officer.', NULL::text, false, NULL::date;
    RETURN;
  END IF;
  IF holder.valid_from > CURRENT_DATE THEN
    RETURN QUERY SELECT false, 'This Juror ID is not active yet - it starts on your first day of service.', NULL::text, false, NULL::date;
    RETURN;
  END IF;
  IF holder.valid_until IS NOT NULL AND holder.valid_until < CURRENT_DATE THEN
    RETURN QUERY SELECT false, 'This Juror ID has expired. The Jury Officer can arrange an extension.', NULL::text, false, NULL::date;
    RETURN;
  END IF;

  INSERT INTO public.voucher_events (holder_id, code, event, detail)
  VALUES (holder.id, holder.code, 'menu_access', 'Jury Only menu unlocked with Juror ID');

  RETURN QUERY SELECT true,
    'Verified - the Jury Only menu is open.',
    holder.code,
    (holder.opted_in_at IS NOT NULL AND holder.pin_hash IS NOT NULL),
    holder.valid_until;
END $function$;

REVOKE ALL ON FUNCTION public.cafe1_verify_juror_id(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cafe1_verify_juror_id(text) TO service_role;