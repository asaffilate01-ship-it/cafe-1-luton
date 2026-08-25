
-- ============ ROLES ============
create type public.app_role as enum ('admin','staff','driver','customer');
create type public.order_status as enum ('pending_payment','paid','preparing','ready','out_for_delivery','delivered','completed','cancelled','refunded');
create type public.order_type as enum ('delivery','collection','dine_in');
create type public.payment_status as enum ('pending','paid','failed','refunded');

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_self_read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_self_insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_self_update" on public.profiles for update to authenticated using (auth.uid() = id);

-- ============ USER ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create policy "user_roles_self_read" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "user_roles_admin_all" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Auto create profile + customer role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'customer')
  on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ MENU ============
create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.menu_categories to anon, authenticated;
grant insert, update, delete on public.menu_categories to authenticated;
grant all on public.menu_categories to service_role;
alter table public.menu_categories enable row level security;
create policy "cats_public_read" on public.menu_categories for select to anon, authenticated using (true);
create policy "cats_staff_write" on public.menu_categories for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'staff'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'staff'));

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.menu_categories(id) on delete set null,
  name text not null,
  description text,
  price_cents int not null check (price_cents >= 0),
  image_url text,
  active boolean not null default true,
  is_veg boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.menu_items to anon, authenticated;
grant insert, update, delete on public.menu_items to authenticated;
grant all on public.menu_items to service_role;
alter table public.menu_items enable row level security;
create policy "items_public_read" on public.menu_items for select to anon, authenticated using (true);
create policy "items_staff_write" on public.menu_items for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'staff'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'staff'));

-- ============ ORDERS ============
create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number int not null unique default nextval('public.order_number_seq'),
  customer_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  type order_type not null,
  address_line1 text,
  address_line2 text,
  city text,
  postcode text,
  delivery_notes text,
  status order_status not null default 'pending_payment',
  payment_status payment_status not null default 'pending',
  subtotal_cents int not null default 0,
  delivery_fee_cents int not null default 0,
  total_cents int not null default 0,
  sumup_checkout_id text,
  sumup_reference text unique,
  sumup_transaction_id text,
  driver_id uuid references auth.users(id) on delete set null,
  ready_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;

create policy "orders_customer_read" on public.orders for select to authenticated
  using (customer_id = auth.uid());
create policy "orders_customer_insert" on public.orders for insert to authenticated
  with check (customer_id = auth.uid());
create policy "orders_staff_all" on public.orders for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'staff'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'staff'));
create policy "orders_driver_read" on public.orders for select to authenticated
  using (driver_id = auth.uid() and public.has_role(auth.uid(),'driver'));
create policy "orders_driver_update" on public.orders for update to authenticated
  using (driver_id = auth.uid() and public.has_role(auth.uid(),'driver'))
  with check (driver_id = auth.uid() and public.has_role(auth.uid(),'driver'));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  name text not null,
  qty int not null check (qty > 0),
  unit_price_cents int not null,
  notes text,
  created_at timestamptz not null default now()
);
grant select, insert on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;

create policy "order_items_read" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_items.order_id
    and (o.customer_id = auth.uid()
         or (o.driver_id = auth.uid() and public.has_role(auth.uid(),'driver'))
         or public.has_role(auth.uid(),'staff')
         or public.has_role(auth.uid(),'admin'))));
create policy "order_items_insert" on public.order_items for insert to authenticated
  with check (exists (select 1 from public.orders o where o.id = order_items.order_id
    and (o.customer_id = auth.uid()
         or public.has_role(auth.uid(),'staff')
         or public.has_role(auth.uid(),'admin'))));

-- ============ updated_at trigger ============
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger tg_profiles_updated before update on public.profiles for each row execute function public.tg_set_updated_at();
create trigger tg_menu_items_updated before update on public.menu_items for each row execute function public.tg_set_updated_at();
create trigger tg_orders_updated before update on public.orders for each row execute function public.tg_set_updated_at();

-- ============ Realtime ============
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;

-- ============ SEED MENU (Cafe1) ============
insert into public.menu_categories (id, name, sort_order) values
  ('11111111-1111-1111-1111-111111111101','Hot Drinks',1),
  ('11111111-1111-1111-1111-111111111102','Cold Drinks',2),
  ('11111111-1111-1111-1111-111111111103','Breakfast',3),
  ('11111111-1111-1111-1111-111111111104','Sandwiches',4),
  ('11111111-1111-1111-1111-111111111105','Cakes & Pastries',5);

insert into public.menu_items (category_id, name, description, price_cents, is_veg, sort_order) values
  ('11111111-1111-1111-1111-111111111101','Espresso','Double shot, house blend',280,true,1),
  ('11111111-1111-1111-1111-111111111101','Flat White','Silky micro-foam over espresso',360,true,2),
  ('11111111-1111-1111-1111-111111111101','Cappuccino','Espresso, steamed milk, foam',360,true,3),
  ('11111111-1111-1111-1111-111111111101','Latte','Smooth and creamy',380,true,4),
  ('11111111-1111-1111-1111-111111111101','Mocha','Espresso with rich chocolate',420,true,5),
  ('11111111-1111-1111-1111-111111111102','Iced Latte','Chilled espresso over ice',400,true,1),
  ('11111111-1111-1111-1111-111111111102','Fresh OJ','Freshly squeezed orange juice',390,true,2),
  ('11111111-1111-1111-1111-111111111103','Full English','Sausage, bacon, egg, beans, toast',995,false,1),
  ('11111111-1111-1111-1111-111111111103','Avocado Toast','Sourdough, chilli, lime',745,true,2),
  ('11111111-1111-1111-1111-111111111103','Eggs Benedict','Poached eggs, hollandaise, muffin',895,false,3),
  ('11111111-1111-1111-1111-111111111104','Chicken Club','Grilled chicken, bacon, lettuce, tomato',825,false,1),
  ('11111111-1111-1111-1111-111111111104','Halloumi Wrap','Grilled halloumi, roasted peppers, harissa',795,true,2),
  ('11111111-1111-1111-1111-111111111105','Butter Croissant','Flaky French classic',295,true,1),
  ('11111111-1111-1111-1111-111111111105','Chocolate Brownie','Rich, gooey, sea salt',345,true,2),
  ('11111111-1111-1111-1111-111111111105','Carrot Cake','With cream cheese frosting',395,true,3);
