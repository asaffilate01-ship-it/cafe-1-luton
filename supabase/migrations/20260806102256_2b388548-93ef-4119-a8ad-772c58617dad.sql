CREATE OR REPLACE FUNCTION public.cafe1_reassign_order_channel(_order_id uuid, _channel text)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor uuid;
  o public.orders;
  ch text := lower(trim(coalesce(_channel, '')));
  new_source text;
  new_terminal text;
BEGIN
  actor := public.cafe1_assert_operator(false);

  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF ch IN ('deliveroo', 'just_eat', 'uber_eats', 'tgtg') THEN
    new_source := ch;
    new_terminal := NULL;
  ELSIF ch = 'web' THEN
    new_source := 'web';
    new_terminal := NULL;
  ELSIF ch IN ('jury', 'judge', 'public') THEN
    new_terminal := ch;
    -- Keep till-originated tickets on their till source; anything arriving from
    -- a marketplace or the website becomes a counter ticket for that side.
    IF coalesce(o.source, '') IN ('sumup_pos', 'counter', 'till') THEN
      new_source := o.source;
    ELSE
      new_source := 'counter';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown area: %', _channel;
  END IF;

  UPDATE public.orders
     SET source = new_source,
         pos_terminal = new_terminal,
         updated_at = now()
   WHERE id = _order_id
  RETURNING * INTO o;

  INSERT INTO public.audit_events (actor_id, action, entity_type, entity_id, terminal, detail)
  VALUES (
    actor,
    'order.reassign_channel',
    'order',
    _order_id,
    new_terminal,
    jsonb_build_object(
      'order_number', o.order_number,
      'to_channel', ch,
      'new_source', new_source,
      'new_terminal', new_terminal
    )
  );

  RETURN o;
END $$;

REVOKE EXECUTE ON FUNCTION public.cafe1_reassign_order_channel(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cafe1_reassign_order_channel(uuid, text) TO authenticated;