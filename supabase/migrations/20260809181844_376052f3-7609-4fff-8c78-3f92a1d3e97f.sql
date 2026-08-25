alter table public.menu_modifiers
  add column if not exists is_veg boolean not null default false;

comment on column public.menu_modifiers.is_veg is
  'True only when this modifier option is independently verified as vegetarian. This classification is separate from the base menu item.';