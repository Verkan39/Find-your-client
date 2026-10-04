-- Lets the signup form say "this email already has an account" before step 2.
-- Callable only by the server (service role); browsers can't probe it directly.
create or replace function public.email_registered(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users where lower(email) = lower(btrim(p_email)));
$$;

revoke all on function public.email_registered(text) from public, anon, authenticated;
grant execute on function public.email_registered(text) to service_role;
