-- Per-user server-side settings, replacing the Upstash KV blob keyed by a
-- self-signed machineId. Identity now comes from Neon Auth (neon_auth."user").
--
-- Shape mirrors the client's ServerSettings interface so the API layer stays a
-- thin pass-through: { jiraConfig, aiConfig }.

create table if not exists public.user_settings (
  user_id     uuid primary key references neon_auth."user" (id) on delete cascade,
  jira_config jsonb       not null default '{}'::jsonb,
  ai_config   jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.user_settings is
  'Per-user Jira and AI credentials. One row per Neon Auth user; cascades on user delete.';

-- Keep updated_at honest without relying on every caller to set it.
create or replace function public.touch_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_settings_touch_updated_at on public.user_settings;
create trigger user_settings_touch_updated_at
  before update on public.user_settings
  for each row execute function public.touch_updated_at();

-- Deny by default. The API connects as the owner (which bypasses RLS) and scopes
-- every query by the user id it read from a verified JWT — that is the real
-- boundary today. Enabling RLS with no policy means that if the Neon Data API is
-- ever turned on, the `authenticated` role gets nothing until a policy is written
-- deliberately, rather than silently exposing every row.
alter table public.user_settings enable row level security;
