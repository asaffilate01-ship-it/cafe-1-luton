
-- Set search_path on trigger fn and lock down execution
alter function public.tg_set_updated_at() set search_path = public;
revoke execute on function public.tg_set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, public.app_role) from public;
-- has_role is used inside RLS policies; policies execute regardless of grants,
-- but revoke direct execute for anon; keep authenticated since RLS calls it via SQL.
revoke execute on function public.has_role(uuid, public.app_role) from anon;
