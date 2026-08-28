create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null check (char_length(email) between 5 and 320),
  category text not null default 'general' check (category in ('general', 'account', 'billing', 'privacy', 'technical', 'feedback')),
  subject text not null check (char_length(subject) between 3 and 160),
  message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'answered', 'closed')),
  response_text text check (response_text is null or char_length(response_text) <= 5000),
  answered_by uuid references auth.users(id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_requests_status_created_idx on public.contact_requests(status, created_at desc);
alter table public.contact_requests enable row level security;
alter table public.contact_requests force row level security;
revoke all on public.contact_requests from anon, authenticated;
grant all on public.contact_requests to service_role;

comment on table public.contact_requests is 'Public support enquiries routed to the staff CRM; access is only through server-authorised endpoints.';
