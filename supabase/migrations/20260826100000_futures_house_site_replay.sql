-- Restore the missing location prerequisite for the legacy menu-clone
-- migration 20260826113316. On a fresh schema replay, only the Crown Court
-- site was seeded; the clone references the independent Futures House UUID.
--
-- Never enable this new location merely by running migrations. In-flight
-- orders, staff access, juror rules, menus, and physical devices require
-- location-specific acceptance. Existing site rows are not changed.
DO $$
DECLARE
  source_id CONSTANT uuid := 'cafe1000-0000-4000-8000-000000000001';
  futures_id CONSTANT uuid := 'bc24b444-ffc2-4912-9b0a-143513df4f20';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sites WHERE id=source_id) THEN
    RAISE EXCEPTION 'canonical_luton_crown_court_site_missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.sites
    WHERE code='FUTURES_HOUSE' AND id<>futures_id
  ) THEN
    RAISE EXCEPTION 'futures_house_site_identity_conflict';
  END IF;

  INSERT INTO public.sites (
    id,code,name,legal_name,trading_name,postcode,
    ordering_modes,own_delivery_enabled,active
  )
  SELECT futures_id,'FUTURES_HOUSE','Café 1 Futures House',
         s.legal_name,s.trading_name,'LU3 3QB',
         s.ordering_modes,false,false
  FROM public.sites AS s
  WHERE s.id=source_id
  ON CONFLICT (id) DO NOTHING;
END $$;
