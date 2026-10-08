create table public.staff_chat_messages (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  user_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  role text not null check (role in ('staff','partner_admin')),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);
create table public.staff_chat_presence (
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null,
  last_seen timestamptz not null default now(),
  primary key (user_id, session_id)
);
create index staff_chat_presence_last_seen_idx on public.staff_chat_presence(last_seen);
alter table public.staff_chat_messages enable row level security;
alter table public.staff_chat_presence enable row level security;
revoke all on public.staff_chat_messages, public.staff_chat_presence from anon, authenticated;
grant all on public.staff_chat_messages, public.staff_chat_presence to service_role;
grant usage, select on sequence public.staff_chat_messages_id_seq to service_role;
-- All access is through the API, which verifies the current profiles.role on every request.
