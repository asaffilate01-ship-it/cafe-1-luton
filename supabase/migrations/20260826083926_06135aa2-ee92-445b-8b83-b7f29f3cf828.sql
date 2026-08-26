create or replace function public.cafe1_assert_operator(_admin_only boolean default false)
returns uuid
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if _admin_only and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Manager approval required';
  end if;

  -- Manager step-up MFA removed at the business owner's request; admin role is sufficient.

  if not _admin_only and not (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff')
  ) then
    raise exception 'Forbidden';
  end if;

  return auth.uid();
end
$function$;