create extension if not exists pgcrypto;

create table if not exists public.it_hub_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists it_hub_events_created_at_idx
  on public.it_hub_events (created_at desc);

alter table public.it_hub_events enable row level security;
alter table public.it_hub_events force row level security;
revoke all on table public.it_hub_events from public, anon, authenticated;
grant all on table public.it_hub_events to service_role;
