create table public.brevo_webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 3 and 120),
  webhook_type text not null check (webhook_type in ('transactional', 'marketing', 'other')),
  integration_address text not null unique check (integration_address ~ '^[0-9a-f]{24}@q-ai\.online$'),
  token_hash text not null check (length(token_hash) = 64),
  token_prefix text not null check (length(token_prefix) between 8 and 16),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_received_at timestamptz
);
create table public.brevo_webhook_events (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.brevo_webhook_endpoints(id) on delete restrict,
  dedupe_key text not null check (length(dedupe_key) = 64),
  event_type text not null check (length(event_type) between 1 and 120),
  email text check (length(email) <= 320),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 65536),
  status text not null default 'received' check (status in ('received', 'reviewed')),
  received_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  unique (endpoint_id, dedupe_key)
);
create index brevo_webhook_events_received_idx on public.brevo_webhook_events (received_at desc, id desc);
create index brevo_webhook_events_endpoint_received_idx on public.brevo_webhook_events (endpoint_id, received_at desc, id desc);
create index brevo_webhook_events_reviewed_by_idx on public.brevo_webhook_events (reviewed_by);
create index brevo_webhook_endpoints_created_by_idx on public.brevo_webhook_endpoints (created_by);
create index brevo_webhook_endpoints_updated_by_idx on public.brevo_webhook_endpoints (updated_by);
alter table public.brevo_webhook_endpoints enable row level security;
alter table public.brevo_webhook_endpoints force row level security;
alter table public.brevo_webhook_events enable row level security;
alter table public.brevo_webhook_events force row level security;
revoke all on public.brevo_webhook_endpoints, public.brevo_webhook_events from anon, authenticated;
grant all on public.brevo_webhook_endpoints, public.brevo_webhook_events to service_role;

-- Validate the current secret and enabled state in the same transaction as the
-- batch insert. Rotation/disable cannot race an already checked request.
create function public.receive_brevo_webhook(p_endpoint_id uuid, p_token_hash text, p_events jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  endpoint uuid;
  inserted_count integer;
begin
  select id into endpoint from public.brevo_webhook_endpoints
    where id = p_endpoint_id and active and token_hash = p_token_hash for update;
  if endpoint is null then return jsonb_build_object('authorised', false); end if;
  if p_events is null or jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) not between 1 and 100 then
    raise exception 'Invalid event batch' using errcode = '22023';
  end if;
  insert into public.brevo_webhook_events (endpoint_id, dedupe_key, event_type, email, payload)
    select endpoint, e.dedupe_key, e.event_type, e.email, e.payload
    from jsonb_to_recordset(p_events) as e(dedupe_key text, event_type text, email text, payload jsonb)
    on conflict (endpoint_id, dedupe_key) do nothing;
  get diagnostics inserted_count = row_count;
  update public.brevo_webhook_endpoints set last_received_at = now() where id = endpoint;
  return jsonb_build_object('authorised', true, 'received', inserted_count, 'duplicates', jsonb_array_length(p_events) - inserted_count);
end;
$$;
revoke all on function public.receive_brevo_webhook(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.receive_brevo_webhook(uuid, text, jsonb) to service_role;
