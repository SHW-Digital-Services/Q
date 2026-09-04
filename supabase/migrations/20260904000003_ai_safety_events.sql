create table if not exists public.ai_safety_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  request_id text not null,
  event_type text not null check (event_type in ('crisis_intercepted', 'provider_failure', 'kill_switch', 'model_rejected')),
  model text,
  outcome text not null,
  metadata jsonb not null default '{}'::jsonb
);
alter table public.ai_safety_events enable row level security;
revoke all on public.ai_safety_events from anon, authenticated;
create index if not exists ai_safety_events_occurred_idx on public.ai_safety_events(occurred_at desc);
