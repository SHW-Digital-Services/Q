create table if not exists public.crm_communications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  contact_request_id uuid references public.contact_requests(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  channel text not null default 'email' check (channel in ('email', 'phone', 'chat', 'other')),
  status text not null default 'logged' check (status in ('logged', 'draft', 'sent', 'failed')),
  sender_email text,
  recipient_email text,
  subject text,
  body text not null check (char_length(body) between 1 and 5000),
  actor_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint crm_communications_sender_email_length check (sender_email is null or char_length(sender_email) <= 320),
  constraint crm_communications_recipient_email_length check (recipient_email is null or char_length(recipient_email) <= 320),
  constraint crm_communications_subject_length check (subject is null or char_length(subject) <= 160)
);

create index if not exists crm_communications_created_at_idx on public.crm_communications (created_at desc);
create index if not exists crm_communications_user_created_at_idx on public.crm_communications (user_id, created_at desc);
create index if not exists crm_communications_contact_request_idx on public.crm_communications (contact_request_id, created_at desc);

alter table public.crm_communications enable row level security;
alter table public.crm_communications force row level security;
revoke all on table public.crm_communications from anon, authenticated;
grant all on table public.crm_communications to service_role;

comment on table public.crm_communications is 'Staff-only inbound and outbound communication ledger for CRM records.';
