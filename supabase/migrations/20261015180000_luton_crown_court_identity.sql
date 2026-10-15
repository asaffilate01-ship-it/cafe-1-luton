-- Forward-only location identity correction for the Luton repository.
-- The inherited early schema started with a STALBANS-coded site and the
-- later Luton seed used ON CONFLICT DO NOTHING on that same stable UUID.
-- Fix the actual source row by UUID; never let the St Albans postcode drive
-- the Luton Crown Court delivery calculation.
--
-- This migration DOES NOT enable the separate, draft Futures House site,
-- replace terminal assignments, or authorise a Dishbee production cutover.
DO $$
DECLARE
  crown_id CONSTANT uuid := 'cafe1000-0000-4000-8000-000000000001';
  futures_id CONSTANT uuid := 'bc24b444-ffc2-4912-9b0a-143513df4f20';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sites WHERE id=crown_id) THEN
    RAISE EXCEPTION 'luton_crown_court_site_missing';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.sites
    WHERE code='LUTON' AND id<>crown_id
  ) THEN
    RAISE EXCEPTION 'luton_site_code_identity_conflict';
  END IF;

  UPDATE public.sites
  SET code='LUTON',postcode='LU1 2AA',updated_at=now()
  WHERE id=crown_id AND
    (code IS DISTINCT FROM 'LUTON' OR postcode IS DISTINCT FROM 'LU1 2AA');

  -- The Luton delivery-settings row is tied to the actual Crown Court site.
  -- Never stamp this postcode onto the separate Futures House branch.
  UPDATE public.business_settings
  SET delivery_origin_postcode='LU1 2AA',updated_at=now()
  WHERE site_id=crown_id
    AND delivery_origin_postcode IS DISTINCT FROM 'LU1 2AA';

  IF NOT EXISTS(
    SELECT 1 FROM public.sites
    WHERE id=futures_id AND code='FUTURES_HOUSE' AND postcode='LU3 3QB'
  ) THEN
    RAISE EXCEPTION 'futures_house_site_mapping_inconsistent';
  END IF;
END $$;
