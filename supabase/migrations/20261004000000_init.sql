-- Find Your Client: core schema.
--
-- Ownership model: every row carries user_id (denormalised onto child tables so
-- row-level-security checks never need a join). Signed-in users can read their own
-- data and create/delete their own scans; everything the analysis pipeline writes
-- (progress, businesses, events) goes through the server's secret key, which
-- bypasses RLS, so users can't forge or tamper with results.

-- ------------------------------------------------------------------ helpers

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------- profiles

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text check (char_length(full_name) <= 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'One row per auth user; created automatically on signup.';

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create the profile when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------------- scans

create table public.scans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  query           text not null check (char_length(query) between 2 and 200),
  label           text,
  lat             double precision,
  lon             double precision,
  radius_m        integer not null check (radius_m between 200 and 15000),
  country_code    text,
  currency        text not null default 'USD',
  categories      text[] not null default '{}',
  max_businesses  integer not null check (max_businesses between 1 and 150),
  include_chains  boolean not null default false,
  ai_mode         text not null default 'deep' check (ai_mode in ('deep', 'standard', 'off')),
  status          text not null default 'queued'
                  check (status in ('queued', 'geocoding', 'discovering', 'analyzing', 'done', 'failed')),
  error           text,
  discovered      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.scans is 'A user''s search: one region + filters, processed in the background.';

create index scans_user_created_idx on public.scans (user_id, created_at desc);
-- The worker resumes unfinished scans on boot.
create index scans_unfinished_idx on public.scans (created_at) where status not in ('done', 'failed');

create trigger scans_updated_at
  before update on public.scans
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------- businesses

create table public.businesses (
  id              uuid primary key default gen_random_uuid(),
  scan_id         uuid not null references public.scans (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  osm_id          text not null,
  name            text not null,
  category        text not null,
  category_label  text not null,
  grp             text not null,
  lat             double precision not null,
  lon             double precision not null,
  address         text,
  phone           text,
  website         text,
  email           text,
  opening_hours   text,
  brand           text,
  tags            jsonb not null default '{}',
  socials         jsonb not null default '{}',
  crawl           jsonb,
  google          jsonb,
  report          jsonb,
  research        jsonb,
  status          text not null default 'pending'
                  check (status in ('pending', 'crawling', 'enriching', 'scoring', 'researching', 'writing', 'done', 'failed')),
  error           text,
  opportunity     smallint check (opportunity between 0 and 100),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (scan_id, osm_id)
);

comment on table public.businesses is 'A discovered business and everything learned about it (crawl, Google data, research, report).';

create index businesses_scan_opportunity_idx on public.businesses (scan_id, opportunity desc nulls last);
create index businesses_user_idx on public.businesses (user_id);

create trigger businesses_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------- scan events

create table public.scan_events (
  id           bigint generated always as identity primary key,
  scan_id      uuid not null references public.scans (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  business_id  uuid references public.businesses (id) on delete set null,
  level        text not null default 'info' check (level in ('info', 'success', 'warn', 'error')),
  message      text not null,
  created_at   timestamptz not null default now()
);

comment on table public.scan_events is 'Live activity feed shown while a scan runs.';

create index scan_events_scan_idx on public.scan_events (scan_id, id desc);
create index scan_events_user_idx on public.scan_events (user_id);

-- Child rows always inherit the owner of their scan, so ownership can't drift.
create or replace function public.inherit_scan_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select s.user_id into new.user_id from public.scans s where s.id = new.scan_id;
  if new.user_id is null then
    raise exception 'scan % does not exist', new.scan_id;
  end if;
  return new;
end;
$$;

create trigger businesses_inherit_owner
  before insert on public.businesses
  for each row execute function public.inherit_scan_owner();

create trigger scan_events_inherit_owner
  before insert on public.scan_events
  for each row execute function public.inherit_scan_owner();

-- ------------------------------------------------------------ overview view

-- Scans with progress counters for the dashboard list. security_invoker makes the
-- view run with the caller's permissions, so RLS on the base tables still applies.
create view public.scan_overview
with (security_invoker = true)
as
select
  s.*,
  count(b.id)::int                                        as total,
  (count(b.id) filter (where b.status = 'done'))::int     as done,
  (count(b.id) filter (where b.status = 'failed'))::int   as failed,
  max(b.opportunity)::int                                 as top_opportunity
from public.scans s
left join public.businesses b on b.scan_id = s.id
group by s.id;

-- ------------------------------------------------------- row level security

alter table public.profiles    enable row level security;
alter table public.scans       enable row level security;
alter table public.businesses  enable row level security;
alter table public.scan_events enable row level security;

-- profiles: read and edit only your own
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- scans: read, create and delete your own. Progress updates come from the server.
create policy "scans: read own" on public.scans
  for select to authenticated using (user_id = (select auth.uid()));
create policy "scans: create own" on public.scans
  for insert to authenticated with check (user_id = (select auth.uid()) and status = 'queued');
create policy "scans: delete own" on public.scans
  for delete to authenticated using (user_id = (select auth.uid()));

-- businesses / events: read-only for owners; written by the server.
create policy "businesses: read own" on public.businesses
  for select to authenticated using (user_id = (select auth.uid()));
create policy "scan_events: read own" on public.scan_events
  for select to authenticated using (user_id = (select auth.uid()));

-- Anonymous visitors get nothing.
revoke all on public.profiles, public.scans, public.businesses, public.scan_events, public.scan_overview from anon;
