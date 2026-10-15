-- Restore a lost authenticated POS RPC grant after the later migration
-- replaced the original 11-argument secure function with a 14-argument
-- version. It is still a SECURITY DEFINER function: verify that PIN checks
-- are intact before exposing it to authenticated till operators.
DO $$
DECLARE
  secure_fn CONSTANT regprocedure :=
    to_regprocedure('public.prepare_counter_order_secure(uuid,uuid,text,text,text,text,text,text,text,text,jsonb,text,integer,text)');
  fn_body text;
BEGIN
  IF secure_fn IS NULL THEN
    RAISE EXCEPTION 'expected_secure_counter_checkout_missing';
  END IF;
  SELECT pg_get_functiondef(secure_fn) INTO fn_body;
  IF position('verify_juror_voucher_credentials' in fn_body)=0
     OR position('public.prepare_counter_order(' in fn_body)=0 THEN
    RAISE EXCEPTION 'counter_checkout_security_preconditions_unverified';
  END IF;
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon',secure_fn);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role',secure_fn);
END $$;
