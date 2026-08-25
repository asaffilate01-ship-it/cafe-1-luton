INSERT INTO public.sites (id, code, name, legal_name, trading_name, postcode, ordering_modes, own_delivery_enabled, active)
VALUES (
  'cafe1000-0000-4000-8000-000000000001',
  'LUTON',
  'Café 1 Luton',
  'Café 1 Luton',
  'Café 1',
  'LU1 2AA',
  ARRAY['dine_in','collection','delivery'],
  true,
  true
)
ON CONFLICT (id) DO NOTHING;