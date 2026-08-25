begin;

select plan(11);

select ok(
  not exists (
    select 1
    from public.menu_categories
    where active = true
    group by site_id, lower(btrim(name))
    having count(*) > 1
  ),
  'menu category names are unique within a site'
);

select ok(
  not exists (
    select 1
    from public.menu_items
    where active = true
    group by site_id, category_id, lower(btrim(name))
    having count(*) > 1
  ),
  'menu item names are unique within a category and site'
);

select ok(
  not exists (
    select 1
    from public.menu_modifiers
    group by category_id, item_id, lower(btrim(coalesce(group_name, 'Extras'))), lower(btrim(name))
    having count(*) > 1
  ),
  'modifier choices are unique within their scope and group'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'menu_modifiers'
      and column_name = 'is_veg'
      and data_type = 'boolean'
      and is_nullable = 'NO'
  ),
  'every modifier has a required vegetarian classification'
);

select ok(
  not exists (
    select 1 from public.menu_modifiers
    where num_nonnulls(category_id, item_id) <> 1
  ),
  'every modifier has exactly one category or item scope'
);

select ok(
  not exists (
    select 1 from public.menu_modifiers
    where min_selections < 0
       or (max_selections is not null and max_selections < min_selections)
  ),
  'modifier selection ranges are valid'
);

select ok(
  not exists (
    select 1 from public.menu_modifiers
    where group_type = 'single' and coalesce(max_selections, 1) > 1
  ),
  'single-choice modifier groups cannot select more than one option'
);

select ok(
  not exists (
    select 1 from public.menu_modifiers
    where required and min_selections < 1
  ),
  'required modifier groups require at least one selection'
);

select ok(
  not exists (
    select 1 from public.menu_categories
    where active = true and lower(btrim(name)) in (
      'cold past pot', 'small naan rolls', 'chicken nuggets', 'iced matche latte', 'omlettes'
    )
  ),
  'legacy category aliases are not offered for sale'
);

select ok(
  not exists (
    select 1 from public.menu_items
    where active = true and lower(btrim(name)) in (
      'paratha and chickpeas', 'paratha omelette and chickpeas',
      'paratha, omelette and chickpeas', 'paratha, desi omelette and chickpeas',
      'plain omlette', 'cheese & onion omlette', 'cheese & tomato omlette',
      'chicken & cheese omlette', 'desi omlette', 'iced matche latte', 'garlic mayom'
    )
  ),
  'legacy item aliases and spelling errors are not offered for sale'
);

select ok(
  exists (
    select 1
    from public.menu_categories category
    join public.sites site on site.id = category.site_id
    where site.code = 'LUTON' and category.active = true
      and category.name = 'Cold Pasta Pot'
  ) and exists (
    select 1
    from public.menu_items item
    join public.menu_categories category on category.id = item.category_id
    join public.sites site on site.id = item.site_id
    where site.code = 'LUTON' and item.active = true
      and category.name = 'Iced Matcha Latte' and item.name = 'Iced Matcha Latte'
  ),
  'canonical catalogue labels remain available'
);

select * from finish();
rollback;
