-- Phases 1-3: privileged access, webhook idempotency, and privacy lifecycle.

alter table public.profiles
  add column if not exists staff_permissions text[] not null default '{}'::text[];

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users(id) on delete set null,
  subject_id uuid references auth.users(id) on delete set null,
  action text not null check (length(action) between 1 and 100),
  outcome text not null check (outcome in ('allowed', 'denied', 'failed')),
  request_id text not null check (length(request_id) between 1 and 100),
  metadata jsonb not null default '{}'::jsonb
);
alter table public.security_events enable row level security;
revoke all on public.security_events from anon, authenticated;

create table if not exists public.api_rate_limits (
  bucket text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  expires_at timestamptz not null
);
alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon, authenticated;

create or replace function public.consume_api_rate_limit(
  bucket_key text,
  window_seconds integer,
  maximum_requests integer
) returns table(allowed boolean, retry_after_seconds integer)
language plpgsql security definer set search_path = public
as $$
declare
  now_at timestamptz := clock_timestamp();
  current_row public.api_rate_limits%rowtype;
begin
  if length(bucket_key) > 200 or window_seconds < 1 or maximum_requests < 1 then
    raise exception 'invalid rate limit configuration';
  end if;
  insert into public.api_rate_limits(bucket, window_started_at, request_count, expires_at)
  values (bucket_key, now_at, 1, now_at + make_interval(secs => window_seconds))
  on conflict (bucket) do update set
    window_started_at = case when public.api_rate_limits.expires_at <= now_at then now_at else public.api_rate_limits.window_started_at end,
    request_count = case when public.api_rate_limits.expires_at <= now_at then 1 else public.api_rate_limits.request_count + 1 end,
    expires_at = case when public.api_rate_limits.expires_at <= now_at then now_at + make_interval(secs => window_seconds) else public.api_rate_limits.expires_at end
  returning * into current_row;
  return query select current_row.request_count <= maximum_requests,
    greatest(1, ceil(extract(epoch from (current_row.expires_at - now_at)))::integer);
end;
$$;
revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;

alter table public.paypal_webhook_events
  add column if not exists status text not null default 'completed'
    check (status in ('processing', 'completed', 'failed')),
  add column if not exists attempt_count integer not null default 1,
  add column if not exists claimed_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists last_error_code text;

update public.paypal_webhook_events
set status = 'completed', completed_at = coalesce(completed_at, processed_at)
where completed_at is null;

create or replace function public.claim_paypal_webhook(
  event_id text,
  event_name text,
  event_resource_id text
) returns table(claimed boolean, current_status text)
language plpgsql security definer set search_path = public
as $$
declare row_status text;
begin
  insert into public.paypal_webhook_events(id, event_type, resource_id, status, claimed_at, processed_at)
  values (event_id, event_name, event_resource_id, 'processing', now(), now())
  on conflict (id) do nothing
  returning status into row_status;
  if found then
    return query select true, row_status;
    return;
  end if;
  update public.paypal_webhook_events set
    attempt_count = attempt_count + 1,
    status = 'processing', claimed_at = now(), failed_at = null, last_error_code = null
  where id = event_id and (
    status = 'failed' or (status = 'processing' and claimed_at < now() - interval '10 minutes')
  ) returning status into row_status;
  if found then
    return query select true, row_status;
    return;
  end if;
  select status into row_status from public.paypal_webhook_events where id = event_id;
  return query select false, row_status;
end;
$$;
revoke all on function public.claim_paypal_webhook(text, text, text) from public, anon, authenticated;
grant execute on function public.claim_paypal_webhook(text, text, text) to service_role;

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  request_type text not null check (request_type in ('export', 'deletion')),
  status text not null default 'requested' check (status in ('requested', 'processing', 'held', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  hold_reason text,
  receipt_id uuid not null default gen_random_uuid(),
  error_code text
);
create index if not exists privacy_requests_user_idx on public.privacy_requests(user_id, requested_at desc);
alter table public.privacy_requests enable row level security;
revoke all on public.privacy_requests from anon, authenticated;
grant select on public.privacy_requests to authenticated;
create policy "Users read own privacy requests" on public.privacy_requests for select to authenticated using (user_id = auth.uid());

-- Preserve statutory payment evidence without retaining an account link after deletion.
alter table public.crm_payments alter column user_id drop not null;
alter table public.crm_payments drop constraint if exists crm_payments_user_id_fkey;
alter table public.crm_payments add constraint crm_payments_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;

create table if not exists public.processor_deletion_tasks (
  id uuid primary key default gen_random_uuid(),
  privacy_request_id uuid not null references public.privacy_requests(id) on delete cascade,
  processor text not null,
  status text not null default 'pending' check (status in ('pending', 'not_required', 'completed', 'failed')),
  updated_at timestamptz not null default now(),
  reference text
);
alter table public.processor_deletion_tasks enable row level security;
revoke all on public.processor_deletion_tasks from anon, authenticated;

create table if not exists public.retention_policies (
  data_category text primary key,
  retention_days integer not null check (retention_days > 0),
  rationale text not null,
  updated_at timestamptz not null default now()
);
alter table public.retention_policies enable row level security;
revoke all on public.retention_policies from anon, authenticated;
insert into public.retention_policies(data_category, retention_days, rationale) values
  ('contact_requests', 365, 'Customer support follow-up and accountability'),
  ('password_reset_requests', 90, 'Security support and abuse investigation'),
  ('security_events', 400, 'Security monitoring and incident investigation'),
  ('paypal_webhook_events', 400, 'Payment integrity and dispute evidence'),
  ('completed_privacy_requests', 2190, 'Accountability evidence for data-rights requests')
on conflict (data_category) do update set retention_days = excluded.retention_days, rationale = excluded.rationale, updated_at = now();

create or replace function public.purge_expired_operational_data()
returns jsonb language plpgsql security definer set search_path = public
as $$
declare result jsonb := '{}'::jsonb; affected integer;
begin
  delete from public.contact_requests where status in ('answered', 'closed') and created_at < now() - interval '365 days'; get diagnostics affected = row_count; result := result || jsonb_build_object('contact_requests', affected);
  delete from public.password_reset_requests where status <> 'pending' and created_at < now() - interval '90 days'; get diagnostics affected = row_count; result := result || jsonb_build_object('password_reset_requests', affected);
  delete from public.security_events where occurred_at < now() - interval '400 days'; get diagnostics affected = row_count; result := result || jsonb_build_object('security_events', affected);
  delete from public.paypal_webhook_events where processed_at < now() - interval '400 days'; get diagnostics affected = row_count; result := result || jsonb_build_object('paypal_webhook_events', affected);
  delete from public.privacy_requests where status = 'completed' and completed_at < now() - interval '2190 days'; get diagnostics affected = row_count; result := result || jsonb_build_object('privacy_requests', affected);
  delete from public.api_rate_limits where expires_at < now() - interval '1 day';
  return result;
end;
$$;
revoke all on function public.purge_expired_operational_data() from public, anon, authenticated;
grant execute on function public.purge_expired_operational_data() to service_role;

-- Client-written audit rows are not authoritative security logs.
drop policy if exists "Users can create their own audit logs" on public.audit_logs;
revoke insert on public.audit_logs from authenticated;
