-- Explicit table privileges.
--
-- Local Supabase (and most hosted projects) grant these automatically through
-- default privileges, but hosted projects can be configured to NOT expose new
-- tables to the Data API. Granting explicitly makes the app work either way.
-- Row-level security still decides which rows each user can see; these grants
-- only decide which operations reach RLS at all.

-- Signed-in users: exactly the operations their RLS policies allow.
grant select, update               on public.profiles      to authenticated;
grant select, insert, delete       on public.scans         to authenticated;
grant select                       on public.businesses    to authenticated;
grant select                       on public.scan_events   to authenticated;
grant select                       on public.user_settings to authenticated;
grant select                       on public.scan_overview to authenticated;

-- The server (secret key) does everything else: worker writes, encrypted keys.
grant all on public.profiles, public.scans, public.businesses, public.scan_events,
             public.user_settings, public.api_keys, public.scan_overview to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function public.email_registered(text) to service_role;

-- Never: anonymous visitors, or users touching encrypted keys.
revoke all on public.profiles, public.scans, public.businesses, public.scan_events,
              public.user_settings, public.api_keys, public.scan_overview from anon;
revoke all on public.api_keys from authenticated;
