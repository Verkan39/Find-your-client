-- Guest mode (Supabase anonymous sign-ins).
--
-- Guests are real auth users with is_anonymous = true, so every existing RLS
-- policy already isolates their data. This migration adds:
--   * server-only scan creation (closes a gap where any signed-in user could
--     insert scans straight through the Data API and skip the daily limits);
--   * moving a guest's scans into an existing account when they log in;
--   * deleting guests (and, by cascade, their scans) after a retention window.

-- --------------------------------------------- scans: created by the server only
drop policy if exists "scans: create own" on public.scans;
revoke insert on public.scans from authenticated;

-- ------------------------------------------------------ guest -> real account
create or replace function public.transfer_guest_data(p_guest uuid, p_owner uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  moved integer;
begin
  if not exists (select 1 from auth.users where id = p_guest and is_anonymous) then
    raise exception 'source user is not a guest';
  end if;
  if not exists (select 1 from auth.users where id = p_owner and not is_anonymous) then
    raise exception 'target user is not a registered account';
  end if;

  update public.scans set user_id = p_owner where user_id = p_guest;
  get diagnostics moved = row_count;
  update public.businesses set user_id = p_owner where user_id = p_guest;
  update public.scan_events set user_id = p_owner where user_id = p_guest;
  delete from auth.users where id = p_guest;
  return moved;
end;
$$;

-- -------------------------------------------------------------- retention
create or replace function public.cleanup_guests(max_age interval default interval '24 hours')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from auth.users where is_anonymous and created_at < now() - max_age;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.transfer_guest_data(uuid, uuid) from public, anon, authenticated;
revoke all on function public.cleanup_guests(interval) from public, anon, authenticated;
grant execute on function public.transfer_guest_data(uuid, uuid) to service_role;
grant execute on function public.cleanup_guests(interval) to service_role;
