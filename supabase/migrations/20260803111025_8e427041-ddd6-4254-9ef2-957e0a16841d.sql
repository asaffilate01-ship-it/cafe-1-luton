CREATE OR REPLACE FUNCTION public.set_counter_order_schedule(_order_id uuid, _scheduled_for timestamptz)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated public.orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')
  ) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  IF _scheduled_for IS NOT NULL AND (
    _scheduled_for <= now() + interval '5 minutes' OR _scheduled_for > now() + interval '14 days'
  ) THEN
    RAISE EXCEPTION 'A later time must be at least 5 minutes ahead and within 14 days';
  END IF;

  UPDATE public.orders SET
    schedule_mode = CASE WHEN _scheduled_for IS NULL THEN 'asap' ELSE 'scheduled' END,
    scheduled_for = _scheduled_for,
    updated_at = now()
  WHERE id = _order_id
    AND source = 'counter'
    AND status NOT IN ('completed', 'cancelled', 'refunded', 'delivered')
  RETURNING * INTO updated;

  IF NOT FOUND THEN RAISE EXCEPTION 'That counter order cannot be rescheduled'; END IF;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, terminal, detail)
  VALUES (
    auth.uid(), 'order.counter.scheduled', 'order', updated.id, updated.pos_terminal,
    jsonb_build_object('order_number', updated.order_number, 'scheduled_for', _scheduled_for)
  );

  RETURN updated;
END $$;

REVOKE ALL ON FUNCTION public.set_counter_order_schedule(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_counter_order_schedule(uuid, timestamptz) TO authenticated, service_role;