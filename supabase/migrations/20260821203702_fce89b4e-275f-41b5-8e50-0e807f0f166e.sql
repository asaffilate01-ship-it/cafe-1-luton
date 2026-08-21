
-- copy category-scoped modifiers onto their items before moving the items
insert into public.menu_modifiers (category_id, item_id, name, description, price_cents, sort_order, active, group_name, group_type, required, min_selections, max_selections, is_exclusive, is_veg)
select null, i.id, m.name, m.description, m.price_cents, m.sort_order, m.active, m.group_name, m.group_type, m.required, m.min_selections, m.max_selections, m.is_exclusive, m.is_veg
from public.menu_modifiers m
join public.menu_items i on i.category_id = m.category_id
where m.category_id in (
  '684260c8-f176-41b5-9a44-cfd421571470', -- Desi Parathas
  'd10f716f-b831-40e1-81b9-06280d6d861d', -- Samosas
  'e1b9c9f1-a0f6-4e9d-9ef1-fd0986e73ed1'  -- Toast
)
on conflict do nothing;

delete from public.menu_modifiers
where category_id in (
  '684260c8-f176-41b5-9a44-cfd421571470',
  'd10f716f-b831-40e1-81b9-06280d6d861d',
  'e1b9c9f1-a0f6-4e9d-9ef1-fd0986e73ed1'
);

-- rename Desi Breakfast -> Desi
update public.menu_categories set name = 'Desi' where id = '1eed4c19-5bd2-4d64-87eb-38e3f80be195';

-- move parathas + samosas into Desi
update public.menu_items set category_id = '1eed4c19-5bd2-4d64-87eb-38e3f80be195'
where category_id in ('684260c8-f176-41b5-9a44-cfd421571470','d10f716f-b831-40e1-81b9-06280d6d861d');

-- move extras + toast into Breakfast
update public.menu_items set category_id = 'bb0e54a7-67e0-4523-a4a3-c219b4e8e541'
where category_id in ('1936d9f1-c0e3-49fc-9990-f96bc2280aec','e1b9c9f1-a0f6-4e9d-9ef1-fd0986e73ed1');

-- hide the now-empty categories
update public.menu_categories set active = false
where id in (
  '684260c8-f176-41b5-9a44-cfd421571470',
  'd10f716f-b831-40e1-81b9-06280d6d861d',
  '1936d9f1-c0e3-49fc-9990-f96bc2280aec',
  'e1b9c9f1-a0f6-4e9d-9ef1-fd0986e73ed1'
);
