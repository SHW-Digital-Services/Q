-- Support remains server-only: every API read checks ownership or staff capability.
alter table public.contact_requests
  add column user_id uuid references auth.users(id) on delete set null,
  add column assigned_to uuid references auth.users(id) on delete set null,
  add column guest_access boolean not null default true;
alter table public.contact_requests drop constraint contact_requests_status_check;
update public.contact_requests set status = 'resolved' where status = 'answered';
alter table public.contact_requests add constraint contact_requests_status_check
  check (status in ('new','in_progress','waiting_for_user','resolved','closed'));
create index contact_requests_owner_activity_idx on public.contact_requests(user_id, updated_at desc) where user_id is not null;
create index contact_requests_assignee_activity_idx on public.contact_requests(assigned_to, updated_at desc);
-- Support copies in the older communication ledger share the request lifetime.
alter table public.crm_communications drop constraint crm_communications_contact_request_id_fkey;
alter table public.crm_communications add constraint crm_communications_contact_request_id_fkey
  foreign key (contact_request_id) references public.contact_requests(id) on delete cascade;

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.contact_requests(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_kind text not null check (author_kind in ('user','staff')),
  internal boolean not null default false,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  check (not internal or author_kind = 'staff')
);
create index support_messages_request_created_idx on public.support_messages(request_id, created_at, id);
create table public.support_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.contact_requests(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('created','reply','note','status','assignment','archive','restore')),
  status text not null,
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index support_events_request_created_idx on public.support_events(request_id, created_at, id);
create table public.support_access (
  token_hash text primary key check (char_length(token_hash) = 64),
  request_id uuid not null references public.contact_requests(id) on delete cascade,
  kind text not null check (kind in ('link','session')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index support_access_request_idx on public.support_access(request_id);
create index support_access_expiry_idx on public.support_access(expires_at);
create table public.support_notifications (
  message_id uuid primary key references public.support_messages(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','unavailable')),
  updated_at timestamptz not null default now()
);
alter table public.support_messages enable row level security;
alter table public.support_messages force row level security;
alter table public.support_events enable row level security;
alter table public.support_events force row level security;
alter table public.support_access enable row level security;
alter table public.support_access force row level security;
alter table public.support_notifications enable row level security;
alter table public.support_notifications force row level security;
revoke all on public.support_messages, public.support_events, public.support_access, public.support_notifications from public, anon, authenticated;
grant all on public.support_messages, public.support_events, public.support_access, public.support_notifications to service_role;

-- Preserve legacy replies as historical records, without claiming email delivery.
insert into public.support_messages(request_id, author_id, author_kind, body, created_at)
select id, answered_by, 'staff', response_text, coalesce(answered_at,updated_at)
from public.contact_requests where nullif(btrim(response_text),'') is not null;

create function public.create_support_request(p_id uuid, p_user_id uuid, p_email text, p_name text, p_category text, p_subject text, p_body text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result public.contact_requests;
begin
  insert into public.contact_requests(id,user_id,email,name,category,subject,message,guest_access)
  values(p_id,p_user_id,p_email,p_name,p_category,p_subject,p_body,p_user_id is null)
  on conflict(id) do nothing returning * into result;
  if result.id is null then
    select * into result from public.contact_requests where id = p_id;
    if result.user_id is distinct from p_user_id or result.email <> p_email or result.message <> p_body or result.subject <> p_subject or result.name is distinct from p_name or result.category <> p_category then
      raise exception 'SUPPORT_CONFLICT';
    end if;
    return to_jsonb(result);
  end if;
  insert into public.support_events(request_id,actor_id,action,status) values(p_id,p_user_id,'created','new');
  return to_jsonb(result);
end $$;

-- Lock the request so reply/status/archive changes cannot overwrite one another.
create function public.change_support_request(p_request_id uuid, p_actor_id uuid, p_staff boolean, p_action text,
  p_message_id uuid default null, p_body text default null, p_status text default null, p_assignee uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare ticket public.contact_requests; previous public.support_messages; next_status text; internal_note boolean;
begin
  select * into ticket from public.contact_requests where id = p_request_id for update;
  if ticket.id is null then raise exception 'SUPPORT_NOT_FOUND'; end if;
  if not p_staff and ticket.user_id is distinct from p_actor_id then raise exception 'SUPPORT_NOT_FOUND'; end if;
  next_status := ticket.status;
  if p_action in ('reply','note') then
    internal_note := p_action = 'note';
    if internal_note and not p_staff then raise exception 'SUPPORT_FORBIDDEN'; end if;
    if p_message_id is null or p_body is null or char_length(btrim(p_body)) not between 1 and 5000 then raise exception 'SUPPORT_INVALID'; end if;
    select * into previous from public.support_messages where id = p_message_id;
    if previous.id is not null then
      if previous.request_id <> p_request_id or previous.author_id is distinct from p_actor_id or previous.body <> p_body or previous.internal <> internal_note or previous.author_kind <> (case when p_staff then 'staff' else 'user' end) then raise exception 'SUPPORT_CONFLICT'; end if;
      return to_jsonb(ticket);
    end if;
    if not internal_note then next_status := case when p_staff then 'waiting_for_user' else 'in_progress' end; end if;
    insert into public.support_messages(id,request_id,author_id,author_kind,internal,body)
    values(p_message_id,p_request_id,p_actor_id,case when p_staff then 'staff' else 'user' end,internal_note,p_body);
    if p_staff and not internal_note then insert into public.support_notifications(message_id) values(p_message_id); end if;
  elsif p_action = 'status' then
    if p_status not in ('new','in_progress','waiting_for_user','resolved','closed') or p_status is null then raise exception 'SUPPORT_INVALID'; end if;
    if not p_staff and p_status not in ('closed','in_progress') then raise exception 'SUPPORT_FORBIDDEN'; end if;
    next_status := p_status;
  elsif p_action = 'assignment' and p_staff then
    if p_assignee is not null and not exists(select 1 from public.profiles where id = p_assignee and role in ('staff','partner_admin')) then raise exception 'SUPPORT_INVALID'; end if;
    update public.contact_requests set assigned_to = p_assignee where id = p_request_id;
  elsif p_action in ('archive','restore') and p_staff then
    update public.contact_requests set archived_at = case when p_action = 'archive' then now() else null end where id = p_request_id;
  else raise exception 'SUPPORT_FORBIDDEN'; end if;
  update public.contact_requests set status = next_status, updated_at = now(),
    archived_at = case when p_action = 'reply' then null else archived_at end
    where id = p_request_id returning * into ticket;
  insert into public.support_events(request_id,actor_id,action,status,assigned_to) values(p_request_id,p_actor_id,p_action,next_status,ticket.assigned_to);
  return to_jsonb(ticket);
end $$;

-- Link exchange is one-use and atomic, including session creation.
create function public.exchange_support_access(p_link_hash text, p_session_hash text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare access public.support_access;
begin
  delete from public.support_access where token_hash = p_link_hash and kind = 'link' and expires_at > now() returning * into access;
  if access.request_id is null then return null; end if;
  insert into public.support_access(token_hash,request_id,kind,expires_at) values(p_session_hash,access.request_id,'session',access.expires_at);
  return jsonb_build_object('requestId',access.request_id,'expiresAt',access.expires_at);
end $$;
revoke all on function public.create_support_request(uuid,uuid,text,text,text,text,text),
  public.change_support_request(uuid,uuid,boolean,text,uuid,text,text,uuid), public.exchange_support_access(text,text) from public, anon, authenticated;
grant execute on function public.create_support_request(uuid,uuid,text,text,text,text,text),
  public.change_support_request(uuid,uuid,boolean,text,uuid,text,text,uuid), public.exchange_support_access(text,text) to service_role;

-- Retain conversations for 365 days after their last activity, not submission.
-- Cascades remove messages, events, notifications and access grants together.
create or replace function public.purge_expired_operational_data()
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb := '{}'::jsonb; affected integer;
begin
  delete from public.contact_requests where status in ('resolved','closed') and updated_at < now() - interval '365 days';
  get diagnostics affected = row_count; result := result || jsonb_build_object('contact_requests', affected);
  delete from public.support_access where expires_at < now();
  delete from public.password_reset_requests where status <> 'pending' and created_at < now() - interval '90 days'; get diagnostics affected = row_count; result := result || jsonb_build_object('password_reset_requests', affected);
  delete from public.security_events where occurred_at < now() - interval '400 days'; get diagnostics affected = row_count; result := result || jsonb_build_object('security_events', affected);
  delete from public.paypal_webhook_events where processed_at < now() - interval '400 days'; get diagnostics affected = row_count; result := result || jsonb_build_object('paypal_webhook_events', affected);
  delete from public.privacy_requests where status = 'completed' and completed_at < now() - interval '2190 days'; get diagnostics affected = row_count; result := result || jsonb_build_object('privacy_requests', affected);
  delete from public.api_rate_limits where expires_at < now() - interval '1 day';
  return result;
end $$;
revoke all on function public.purge_expired_operational_data() from public, anon, authenticated;
grant execute on function public.purge_expired_operational_data() to service_role;
