ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS prepared_by text;

CREATE OR REPLACE FUNCTION public.cafe1_set_prepared_by(_order_id uuid, _initials text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'staff')
    OR public.has_role(auth.uid(), 'admin')
  ) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  UPDATE public.orders
  SET
    prepared_by = NULLIF(trim(_initials), ''),
    updated_at = now()
  WHERE id = _order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cafe1_set_prepared_by(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cafe1_set_prepared_by(uuid, text) TO service_role;