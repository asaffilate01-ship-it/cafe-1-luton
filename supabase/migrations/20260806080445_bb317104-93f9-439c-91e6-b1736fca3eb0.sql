
-- 1. Activate HMCTS Juror IDs supplied by the Jury Office ------------------
CREATE OR REPLACE FUNCTION public.cafe1_activate_juror_ids(
  _batch text,
  _juror_ids text[],
  _valid_from date DEFAULT CURRENT_DATE,
  _weeks integer DEFAULT 12
)
RETURNS TABLE(juror_id text, status text, valid_from date, valid_until date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  actor uuid;
  raw text;
  normalised text;
  end_date date;
  holder public.voucher_holders%ROWTYPE;
BEGIN
  actor := public.cafe1_assert_operator(true);
  IF length(trim(COALESCE(_batch, ''))) < 2 OR length(_batch) > 120 THEN
    RAISE EXCEPTION 'A batch label is required';
  END IF;
  IF _juror_ids IS NULL OR array_length(_juror_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Provide at least one Juror ID';
  END IF;
  IF array_length(_juror_ids, 1) > 500 THEN
    RAISE EXCEPTION 'Activate at most 500 Juror IDs at a time';
  END IF;
  IF _weeks < 1 OR _weeks > 26 THEN RAISE EXCEPTION 'Activation must be 1 to 26 weeks'; END IF;
  IF _valid_from < CURRENT_DATE - 30 OR _valid_from > CURRENT_DATE + 120 THEN
    RAISE EXCEPTION 'Invalid activation start date';
  END IF;

  end_date := _valid_from + (_weeks * 7) - 1;

  FOREACH raw IN ARRAY _juror_ids LOOP
    normalised := upper(regexp_replace(COALESCE(raw, ''), '[^A-Za-z0-9\-]', '', 'g'));
    CONTINUE WHEN length(normalised) < 3 OR length(normalised) > 40;

    SELECT * INTO holder FROM public.voucher_holders WHERE upper(code) = normalised FOR UPDATE;

    IF FOUND THEN
      UPDATE public.voucher_holders
      SET active = true,
          deactivated_at = NULL,
          batch = trim(_batch),
          valid_from = LEAST(voucher_holders.valid_from, _valid_from),
          valid_until = GREATEST(COALESCE(voucher_holders.valid_until, end_date), end_date),
          updated_at = now()
      WHERE id = holder.id
      RETURNING * INTO holder;

      INSERT INTO public.voucher_events (holder_id, code, event, detail, actor_id)
      VALUES (holder.id, holder.code, 'reactivate',
        format('Re-activated with batch %s until %s', trim(_batch), end_date), actor);

      juror_id := holder.code;
      status := 'updated';
    ELSE
      INSERT INTO public.voucher_holders (
        code, batch, active, daily_amount_cents, valid_from, valid_until,
        pin_hash, failed_pin_attempts, issued_by, attendance_required, security_version
      ) VALUES (
        normalised, trim(_batch), true, 571, _valid_from, end_date,
        NULL, 0, actor, false, 3
      ) RETURNING * INTO holder;

      INSERT INTO public.voucher_events (holder_id, code, event, detail, actor_id)
      VALUES (holder.id, holder.code, 'issued',
        format('Juror ID activated; batch %s; valid %s to %s', trim(_batch), _valid_from, end_date),
        actor);

      juror_id := holder.code;
      status := 'activated';
    END IF;

    valid_from := holder.valid_from;
    valid_until := holder.valid_until;
    RETURN NEXT;
  END LOOP;
END $function$;

REVOKE ALL ON FUNCTION public.cafe1_activate_juror_ids(text, text[], date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cafe1_activate_juror_ids(text, text[], date, integer) TO authenticated, service_role;

-- 2. Juror self-service opt-in: issues the six-digit PIN exactly once -------
CREATE OR REPLACE FUNCTION public.juror_opt_in_with_id(_code text, _source text DEFAULT 'online')
RETURNS TABLE(ok boolean, message text, pin text, already boolean, valid_until date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  normalised text;
  holder public.voucher_holders%ROWTYPE;
  pin_bytes bytea;
  generated_pin text;
BEGIN
  normalised := upper(regexp_replace(COALESCE(_code, ''), '[^A-Za-z0-9\-]', '', 'g'));
  IF length(normalised) < 3 THEN
    RETURN QUERY SELECT false, 'Please enter your Juror ID exactly as HMCTS issued it.', NULL::text, false, NULL::date;
    RETURN;
  END IF;

  SELECT * INTO holder FROM public.voucher_holders WHERE upper(code) = normalised FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'That Juror ID is not on the scheme yet. Please ask the Jury Officer or a member of the Cafe 1 team.', NULL::text, false, NULL::date;
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
  IF holder.opted_in_at IS NOT NULL AND holder.pin_hash IS NOT NULL THEN
    RETURN QUERY SELECT true, 'You have already opted in. Use your Juror ID and the PIN you noted down. If you have lost it, ask a member of the Cafe 1 team to reset it.', NULL::text, true, holder.valid_until;
    RETURN;
  END IF;

  pin_bytes := gen_random_bytes(4);
  generated_pin := lpad(((
      get_byte(pin_bytes, 0)::bigint * 16777216
    + get_byte(pin_bytes, 1)::bigint * 65536
    + get_byte(pin_bytes, 2)::bigint * 256
    + get_byte(pin_bytes, 3)::bigint
  ) % 1000000)::text, 6, '0');

  UPDATE public.voucher_holders
  SET pin_hash = crypt(generated_pin, gen_salt('bf', 11)),
      failed_pin_attempts = 0,
      pin_locked_until = NULL,
      opted_in_at = COALESCE(holder.opted_in_at, now()),
      opt_in_source = left(COALESCE(NULLIF(trim(_source), ''), 'online'), 30),
      security_version = 3,
      updated_at = now()
  WHERE id = holder.id
  RETURNING * INTO holder;

  INSERT INTO public.voucher_events (holder_id, code, event, detail)
  VALUES (holder.id, holder.code, 'opt_in', left(COALESCE(_source, 'online'), 30)),
         (holder.id, holder.code, 'pin_issued', 'PIN generated at opt-in and shown once');

  RETURN QUERY SELECT true, 'You are on the scheme. Note your PIN down now - it cannot be shown again.', generated_pin, false, holder.valid_until;
END $function$;

REVOKE ALL ON FUNCTION public.juror_opt_in_with_id(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.juror_opt_in_with_id(text, text) TO service_role;

-- 3. Manager-only PIN reset -------------------------------------------------
CREATE OR REPLACE FUNCTION public.cafe1_reset_juror_pin(_holder_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  actor uuid;
  holder public.voucher_holders%ROWTYPE;
  pin_bytes bytea;
  generated_pin text;
BEGIN
  actor := public.cafe1_assert_operator(true);
  IF length(trim(COALESCE(_reason, ''))) < 4 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT * INTO holder FROM public.voucher_holders WHERE id = _holder_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Juror ID not found'; END IF;

  pin_bytes := gen_random_bytes(4);
  generated_pin := lpad(((
      get_byte(pin_bytes, 0)::bigint * 16777216
    + get_byte(pin_bytes, 1)::bigint * 65536
    + get_byte(pin_bytes, 2)::bigint * 256
    + get_byte(pin_bytes, 3)::bigint
  ) % 1000000)::text, 6, '0');

  UPDATE public.voucher_holders
  SET pin_hash = crypt(generated_pin, gen_salt('bf', 11)),
      failed_pin_attempts = 0,
      pin_locked_until = NULL,
      security_version = 3,
      updated_at = now()
  WHERE id = holder.id;

  INSERT INTO public.voucher_events (holder_id, code, event, detail, actor_id)
  VALUES (holder.id, holder.code, 'pin_reset', trim(_reason), actor);

  RETURN jsonb_build_object('code', holder.code, 'pin', generated_pin);
END $function$;

REVOKE ALL ON FUNCTION public.cafe1_reset_juror_pin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cafe1_reset_juror_pin(uuid, text) TO authenticated, service_role;
