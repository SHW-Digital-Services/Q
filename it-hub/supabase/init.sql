-- Run this in Supabase SQL editor to create tables used by IT Hub
create extension if not exists pgcrypto;

create table if not exists it_hub_events (
  id uuid default gen_random_uuid() primary key,
  type text not null,
  payload jsonb not null,
  created_at timestamptz default now()
);

create table if not exists it_hub_incidents (
  id uuid default gen_random_uuid() primary key,
  external_id text,
  title text not null,
  status text not null,
  details text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- These tables are server-only. Require privileged backend credentials.
alter table it_hub_events enable row level security;
alter table it_hub_events force row level security;
alter table it_hub_incidents enable row level security;
alter table it_hub_incidents force row level security;

revoke all on table it_hub_events, it_hub_incidents from public, anon, authenticated;
grant all on table it_hub_events, it_hub_incidents to service_role;
