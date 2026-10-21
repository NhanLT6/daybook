-- Daily question counts for the public /api/help endpoint (the first-visit chat for
-- people who haven't signed in). One row per hashed IP per UTC day, plus a '*' row
-- per day for the deployment-wide cap. Nothing personal is kept: the IP is hashed.

create table if not exists public.help_usage (
  ip_hash text not null,
  day     date not null,
  count   integer not null default 0,
  primary key (ip_hash, day)
);

comment on table public.help_usage is
  'Rate limit for /api/help: questions per hashed IP per UTC day. Old rows can be deleted at any time.';

-- Same deny-by-default stance as user_settings: only the owner-level API connection reads it.
alter table public.help_usage enable row level security;
