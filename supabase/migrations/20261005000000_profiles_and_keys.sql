-- Richer user profiles + bring-your-own API keys.
--
-- * profiles gains optional "about you" fields collected at signup.
-- * user_settings holds each user's provider choices (which AI / places / search
--   provider and model). Users can read it; only the server writes it, after the
--   user has re-entered their password.
-- * api_keys holds provider keys ENCRYPTED by the app server (AES-256-GCM).
--   RLS is on with no policies, so no client key can ever read it — only the
--   server's secret key, which decrypts in memory when a scan runs.

-- ------------------------------------------------------------------ profiles

alter table public.profiles
  add column phone             text check (char_length(phone) <= 40),
  add column contact_email     text check (char_length(contact_email) <= 200),
  add column headline          text check (char_length(headline) <= 120),
  add column location          text check (char_length(location) <= 120),
  add column experience_level  text check (experience_level in ('student', 'junior', 'mid', 'senior', 'agency')),
  add column portfolio_url     text check (char_length(portfolio_url) <= 300),
  add column bio               text check (char_length(bio) <= 1000),
  add column skills            text[] not null default '{}' check (cardinality(skills) <= 30),
  add column interests         text[] not null default '{}' check (cardinality(interests) <= 30);

-- Copy signup metadata into the profile. Everything is clamped/whitelisted here so
-- odd input can never make signup itself fail.
create or replace function public.clean_tags(v jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(t), '{}')
  from (
    select left(btrim(x), 40) as t
    from jsonb_array_elements_text(case when jsonb_typeof(v) = 'array' then v else '[]'::jsonb end) as x
    where btrim(x) <> ''
    limit 30
  ) s;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (
    id, email, full_name, phone, contact_email, headline, location,
    experience_level, portfolio_url, bio, skills, interests
  ) values (
    new.id,
    new.email,
    nullif(left(btrim(m ->> 'full_name'), 120), ''),
    nullif(left(btrim(m ->> 'phone'), 40), ''),
    nullif(left(btrim(m ->> 'contact_email'), 200), ''),
    nullif(left(btrim(m ->> 'headline'), 120), ''),
    nullif(left(btrim(m ->> 'location'), 120), ''),
    case when m ->> 'experience_level' in ('student', 'junior', 'mid', 'senior', 'agency') then m ->> 'experience_level' end,
    nullif(left(btrim(m ->> 'portfolio_url'), 300), ''),
    nullif(left(btrim(m ->> 'bio'), 1000), ''),
    public.clean_tags(m -> 'skills'),
    public.clean_tags(m -> 'interests')
  );
  return new;
end;
$$;

-- ------------------------------------------------------------ user_settings

create table public.user_settings (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  llm_provider     text check (llm_provider in ('anthropic', 'openai', 'gemini', 'openrouter', 'groq', 'mistral', 'deepseek', 'custom')),
  llm_model        text check (char_length(llm_model) <= 200),
  places_provider  text check (places_provider in ('google_places', 'yelp')),
  search_provider  text check (search_provider in ('native', 'tavily', 'brave', 'serper')),
  updated_at       timestamptz not null default now()
);

comment on table public.user_settings is 'Which provider/model each user chose. Written by the server only.';

create trigger user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;
create policy "user_settings: read own" on public.user_settings
  for select to authenticated using (user_id = (select auth.uid()));

-- ----------------------------------------------------------------- api_keys

create table public.api_keys (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  provider         text not null check (provider in (
                     'anthropic', 'openai', 'gemini', 'openrouter', 'groq', 'mistral', 'deepseek', 'custom',
                     'google_places', 'yelp', 'tavily', 'brave', 'serper')),
  encrypted_key    text not null,
  key_hint         text not null check (char_length(key_hint) <= 24),
  base_url         text check (char_length(base_url) <= 300),
  verified_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, provider)
);

comment on table public.api_keys is 'Encrypted third-party API keys. Server-only: RLS enabled with no policies.';

create trigger api_keys_updated_at
  before update on public.api_keys
  for each row execute function public.set_updated_at();

alter table public.api_keys enable row level security;
revoke all on public.api_keys from anon, authenticated;
revoke all on public.user_settings from anon;
