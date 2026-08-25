DO $migration$
DECLARE
  function_signature regprocedure := 'public.prepare_counter_order(uuid,uuid,text,text,text,text,text,text,text,jsonb,text,integer,text)'::regprocedure;
  function_sql text;
  revised_sql text;
BEGIN
  SELECT pg_get_functiondef(function_signature::oid) INTO function_sql;

  revised_sql := replace(
    function_sql,
    'WHERE id = _shift_id AND terminal = _terminal AND closed_at IS NULL FOR UPDATE;',
    'WHERE id = _shift_id AND closed_at IS NULL FOR UPDATE;'
  );

  revised_sql := replace(
    revised_sql,
    'IF _terminal NOT IN (''jury'', ''judge'', ''public'') THEN',
    'IF _terminal NOT IN (''jury'', ''judge'', ''public'', ''futures_public'') THEN'
  );

  IF revised_sql = function_sql THEN
    RAISE EXCEPTION 'prepare_counter_order definition did not contain the expected shift-terminal checks';
  END IF;

  EXECUTE revised_sql;
END
$migration$;