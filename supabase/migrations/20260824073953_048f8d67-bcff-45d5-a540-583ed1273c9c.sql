alter table public.business_settings
  add column if not exists deliveroo_url text,
  add column if not exists justeat_url text;
