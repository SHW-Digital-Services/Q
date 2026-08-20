create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  message text,
  status text not null default 'pending' check (status in ('pending', 'reset', 'failed')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);

create index if not exists password_reset_requests_created_at_idx
  on public.password_reset_requests (created_at desc);

create index if not exists password_reset_requests_status_idx
  on public.password_reset_requests (status);

alter table public.password_reset_requests enable row level security;

revoke all on public.password_reset_requests from anon, authenticated;
grant all on public.password_reset_requests to service_role;
