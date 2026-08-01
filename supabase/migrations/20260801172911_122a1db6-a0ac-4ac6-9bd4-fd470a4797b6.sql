CREATE OR REPLACE FUNCTION public.__tmp_apply_hardening(_sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  EXECUTE _sql;
END
$fn$;
REVOKE ALL ON FUNCTION public.__tmp_apply_hardening(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.__tmp_apply_hardening(text) TO sandbox_exec;