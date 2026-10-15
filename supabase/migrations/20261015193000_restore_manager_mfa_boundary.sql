-- Restore the MFA boundary for sensitive manager-only actions.
-- Historical migration 20260826083926 deliberately removed AAL2. This
-- forward-only security update is DRAFT: do not merge/deploy to a trading
-- location until all managers have enrolled, completed AAL2 recovery checks
-- and operations have authorised the cutover.
CREATE OR REPLACE FUNCTION public.cafe1_assert_operator(
  _admin_only boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF _admin_only AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Manager approval required';
  END IF;
  IF _admin_only AND COALESCE(auth.jwt()->>'aal','aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'Manager multi-factor authentication is required';
  END IF;
  IF NOT _admin_only AND NOT (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.cafe1_assert_operator(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cafe1_assert_operator(boolean) TO authenticated,service_role;

COMMENT ON FUNCTION public.cafe1_assert_operator(boolean)
IS 'Manager-only actions require AAL2 MFA; staff operations retain named role checks.';
