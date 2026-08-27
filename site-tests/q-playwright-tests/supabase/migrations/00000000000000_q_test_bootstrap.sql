-- Q TEST PROJECT - CONSOLIDATED SUPABASE BOOTSTRAP
-- Generated from the application migrations in D:/Dev/Q/supabase/migrations.
--
-- Target: a brand-new, dedicated Supabase test project only.
-- Run with Supabase CLI migrations or paste the complete file into the SQL editor.
-- Do not run this consolidated bootstrap on an existing or production project;
-- use the ordered parent application migrations there instead.
--
-- Auth users are intentionally not seeded here. Create test users through
-- Supabase Auth, then promote only the dedicated admin user with the documented
-- post-auth statement near the end of this file.

begin;


-- -----------------------------------------------------------------------------
-- Source: 20260801000000_privacy_rls.sql
-- -----------------------------------------------------------------------------
-- Privacy-first storage primitives. Every private row is owned by one auth user.
create extension if not exists pgcrypto;

create table if not exists public.memory_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'memory',
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null,
  mood_rating smallint check (mood_rating between 1 and 5),
  mood_tags text[] not null default '{}',
  is_private boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_mood_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mood_date date not null,
  rating smallint not null check (rating between 1 and 5),
  mood_label text not null,
  note text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, mood_date)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sender text not null check (sender in ('user', 'q_ai')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.memory_entries enable row level security;
alter table public.journal_entries enable row level security;
alter table public.daily_mood_logs enable row level security;
alter table public.chat_messages enable row level security;

create policy "Users can manage their own memories"
  on public.memory_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own journal entries"
  on public.journal_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own mood logs"
  on public.daily_mood_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own chat messages"
  on public.chat_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- Source: 20260801000001_vetted_knowledge_vector_search.sql
-- -----------------------------------------------------------------------------
create extension if not exists vector with schema extensions;

create table if not exists public.vetted_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  source text not null,
  source_url text,
  category text not null check (category in ('healthcare', 'legal')),
  embedding extensions.vector(768) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- IVFFlat is supported on older pgvector versions where HNSW is unavailable.
create index if not exists vetted_knowledge_chunks_embedding_idx
  on public.vetted_knowledge_chunks
  using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 100);

alter table public.vetted_knowledge_chunks enable row level security;

drop policy if exists "Anyone can read vetted knowledge" on public.vetted_knowledge_chunks;
create policy "Anyone can read vetted knowledge"
  on public.vetted_knowledge_chunks for select
  using (true);

create or replace function public.match_vetted_knowledge(
  query_embedding extensions.vector(768),
  match_threshold float default 0.65,
  match_count int default 5
)
returns table (
  id uuid,
  title text,
  content text,
  source text,
  source_url text,
  category text,
  similarity float
)
language sql
stable
as $$
  select
    chunks.id,
    chunks.title,
    chunks.content,
    chunks.source,
    chunks.source_url,
    chunks.category,
    1 - (chunks.embedding OPERATOR(extensions.<=>) query_embedding) as similarity
  from public.vetted_knowledge_chunks as chunks
  where 1 - (chunks.embedding OPERATOR(extensions.<=>) query_embedding) >= match_threshold
  order by chunks.embedding OPERATOR(extensions.<=>) query_embedding
  limit least(match_count, 10);
$$;


-- -----------------------------------------------------------------------------
-- Source: 20260801000002_rbac_audit_and_trusted_access.sql
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'beta_tester', 'partner_admin')),
  org_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default now()
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_user_profile();

alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'partner_admin'
  );
$$;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "Users can read their own audit logs" on public.audit_logs;
create policy "Users can read their own audit logs"
  on public.audit_logs for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can create their own audit logs" on public.audit_logs;
create policy "Users can create their own audit logs"
  on public.audit_logs for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Anyone can read vetted knowledge" on public.vetted_knowledge_chunks;
drop policy if exists "Authenticated users can read vetted knowledge" on public.vetted_knowledge_chunks;
create policy "Authenticated users can read vetted knowledge"
  on public.vetted_knowledge_chunks for select
  to authenticated
  using (true);

drop policy if exists "Admins can insert vetted knowledge" on public.vetted_knowledge_chunks;
create policy "Admins can insert vetted knowledge"
  on public.vetted_knowledge_chunks for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update vetted knowledge" on public.vetted_knowledge_chunks;
create policy "Admins can update vetted knowledge"
  on public.vetted_knowledge_chunks for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- -----------------------------------------------------------------------------
-- Source: 20260801000003_phase4_analytics_and_providers.sql
-- -----------------------------------------------------------------------------
create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  org_type text not null,
  geo_bounds jsonb not null default '{}'::jsonb,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sentiment_feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.chat_messages(id) on delete set null,
  score int check (score between -1 and 1),
  flagged_unsafe boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.providers enable row level security;
alter table public.sentiment_feedback enable row level security;

drop policy if exists "Admins can manage providers" on public.providers;
create policy "Admins can manage providers"
  on public.providers for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can read sentiment feedback" on public.sentiment_feedback;
create policy "Admins can read sentiment feedback"
  on public.sentiment_feedback for select
  to authenticated
  using (public.is_admin());

create or replace view public.user_retention_metrics
with (security_invoker = true)
as
with activity as (
  select user_id, created_at from public.chat_messages
  union all
  select user_id, created_at from public.journal_entries
  union all
  select user_id, created_at from public.daily_mood_logs
), first_activity as (
  select user_id, min(created_at) as first_seen from activity group by user_id
), cohorts as (
  select
    user_id,
    date_trunc('month', first_seen)::date as cohort_month,
    first_seen
  from first_activity
), retention as (
  select
    c.cohort_month,
    count(*)::int as users_count,
    count(*) filter (where exists (
      select 1 from activity a
      where a.user_id = c.user_id
        and a.created_at >= c.first_seen + interval '30 days'
        and a.created_at < c.first_seen + interval '31 days'
    ))::int as day_30_retained,
    count(*) filter (where exists (
      select 1 from activity a
      where a.user_id = c.user_id
        and a.created_at >= c.first_seen + interval '60 days'
        and a.created_at < c.first_seen + interval '61 days'
    ))::int as day_60_retained
  from cohorts c
  group by c.cohort_month
)
select
  cohort_month,
  users_count,
  day_30_retained,
  day_60_retained,
  round(day_30_retained::numeric / nullif(users_count, 0), 4) as day_30_rate,
  round(day_60_retained::numeric / nullif(users_count, 0), 4) as day_60_rate
from retention;

revoke all on public.user_retention_metrics from anon, authenticated;
grant select on public.user_retention_metrics to service_role;


-- -----------------------------------------------------------------------------
-- Source: 20260801000004_paypal_subscriptions.sql
-- -----------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  paypal_subscription_id text not null unique,
  paypal_plan_id text not null,
  status text not null check (status in ('APPROVAL_PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "Users can read their own subscription" on public.subscriptions;
create policy "Users can read their own subscription"
  on public.subscriptions for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

revoke insert, update, delete on public.subscriptions from anon, authenticated;


-- -----------------------------------------------------------------------------
-- Source: 20260801000005_waitlist.sql
-- -----------------------------------------------------------------------------
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  email text not null unique check (
    char_length(email) between 5 and 320
    and email = lower(email)
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

drop policy if exists "Anyone can join the waitlist" on public.waitlist;
create policy "Anyone can join the waitlist"
  on public.waitlist for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Admins can read the waitlist" on public.waitlist;
create policy "Admins can read the waitlist"
  on public.waitlist for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can manage the waitlist" on public.waitlist;
create policy "Admins can manage the waitlist"
  on public.waitlist for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create index if not exists waitlist_created_at_idx on public.waitlist (created_at desc);


-- -----------------------------------------------------------------------------
-- Source: 20260802000006_admin_access.sql
-- -----------------------------------------------------------------------------
-- Add admin access support via Supabase user metadata
-- This creates a helper function to check whether a user is an admin.

create or replace function public.is_admin_user(user_id uuid)
returns boolean
language sql
as $$
  select exists (
    select 1
    from auth.users au
    where au.id = user_id
      and (
        coalesce(au.raw_app_meta_data->>'isAdmin', '') = 'true'
        or coalesce(au.raw_user_meta_data->>'isAdmin', '') = 'true'
      )
  );
$$;

comment on function public.is_admin_user(uuid) is 'Returns true when a Supabase auth user has isAdmin set to true in app metadata or user metadata.';


-- -----------------------------------------------------------------------------
-- Source: 20260817000000_profile_fields_for_zoho_sync.sql
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists preferred_name text,
  add column if not exists pronouns text,
  add column if not exists identity_tags text[] not null default '{}',
  add column if not exists location_region text,
  add column if not exists life_stage text,
  add column if not exists opt_in_memory boolean not null default true,
  add column if not exists crm_sync_consent boolean not null default true,
  add column if not exists privacy_level text not null default 'high',
  add column if not exists zoho_last_synced_at timestamptz,
  add column if not exists zoho_sync_status text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_privacy_level_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_privacy_level_check
      check (privacy_level in ('high', 'standard'));
  end if;
end $$;

create or replace function public.touch_profiles_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.touch_profiles_updated_at();

grant select, insert, update on public.profiles to authenticated;

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());


-- -----------------------------------------------------------------------------
-- Source: 20260820000000_password_reset_requests.sql
-- -----------------------------------------------------------------------------
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


-- -----------------------------------------------------------------------------
-- Source: 20260826000000_native_crm_products.sql
-- -----------------------------------------------------------------------------
-- Native Q CRM product catalogue. PayPal remains the payment processor.
create table if not exists public.crm_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_minor integer not null default 0 check (price_minor >= 0),
  currency text not null default 'GBP' check (char_length(currency) = 3),
  billing_interval text not null default 'month' check (billing_interval in ('one_time', 'month', 'year')),
  paypal_plan_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_products enable row level security;
revoke all on public.crm_products from anon, authenticated;

drop policy if exists "Admins can read CRM products" on public.crm_products;
create policy "Admins can read CRM products"
  on public.crm_products for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can create CRM products" on public.crm_products;
create policy "Admins can create CRM products"
  on public.crm_products for insert to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update CRM products" on public.crm_products;
create policy "Admins can update CRM products"
  on public.crm_products for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.touch_crm_products_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_crm_products_updated_at on public.crm_products;
create trigger touch_crm_products_updated_at
  before update on public.crm_products
  for each row execute procedure public.touch_crm_products_updated_at();


-- -----------------------------------------------------------------------------
-- Source: 20260826000001_crm_customer_operations.sql
-- -----------------------------------------------------------------------------
-- Operational CRM records. Sensitive journal/chat content must never be copied here.
alter table public.profiles
  add column if not exists crm_status text not null default 'customer'
    check (crm_status in ('lead', 'prospect', 'customer', 'inactive', 'blocked')),
  add column if not exists phone text,
  add column if not exists company text,
  add column if not exists address jsonb not null default '{}'::jsonb,
  add column if not exists crm_owner_id uuid references auth.users(id) on delete set null;

create table if not exists public.crm_notes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000), created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, description text, status text not null default 'open' check (status in ('open','in_progress','completed','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_at timestamptz, assigned_to uuid references auth.users(id) on delete set null, created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.crm_payments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'paypal', provider_transaction_id text, amount_minor integer not null check (amount_minor >= 0),
  currency text not null default 'GBP' check (char_length(currency)=3), status text not null check (status in ('pending','completed','failed','refunded','voided')),
  payment_type text not null default 'one_time' check (payment_type in ('one_time','subscription','refund')),
  description text, recorded_by uuid references auth.users(id) on delete set null, occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(), unique(provider, provider_transaction_id)
);

create table if not exists public.crm_entitlements (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.crm_products(id) on delete restrict, status text not null default 'active' check (status in ('active','paused','cancelled','expired')),
  source text not null default 'manual' check (source in ('manual','paypal','promotion')),
  starts_at timestamptz not null default now(), ends_at timestamptz, assigned_by uuid references auth.users(id) on delete set null,
  reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null, activity_type text not null, summary text not null,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

do $$ declare table_name text; begin
  foreach table_name in array array['crm_notes','crm_tasks','crm_payments','crm_entitlements','crm_activities'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('create policy "Admins manage %s" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', table_name, table_name);
  end loop;
end $$;

create index if not exists crm_notes_user_idx on public.crm_notes(user_id, created_at desc);
create index if not exists crm_tasks_user_idx on public.crm_tasks(user_id, status, due_at);
create index if not exists crm_payments_user_idx on public.crm_payments(user_id, occurred_at desc);
create index if not exists crm_entitlements_user_idx on public.crm_entitlements(user_id, status);
create index if not exists crm_activities_user_idx on public.crm_activities(user_id, created_at desc);


-- -----------------------------------------------------------------------------
-- Source: 20260826000002_staff_roles_and_site_settings.sql
-- -----------------------------------------------------------------------------
do $$ declare constraint_name text; begin
  select conname into constraint_name from pg_constraint
  where conrelid = 'public.profiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%role%';
  if constraint_name is not null then execute format('alter table public.profiles drop constraint %I', constraint_name); end if;
end $$;
alter table public.profiles add constraint profiles_role_check check (role in ('user','beta_tester','staff','partner_admin'));

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.site_settings(key, value) values ('launch_override', 'false'::jsonb) on conflict (key) do nothing;
alter table public.site_settings enable row level security;
grant select on public.site_settings to anon, authenticated;
create policy "Anyone can read site settings" on public.site_settings for select using (true);
create policy "Admins manage site settings" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role in ('staff','partner_admin'));
$$;


-- -----------------------------------------------------------------------------
-- Source: 20260826000003_paypal_product_sync.sql
-- -----------------------------------------------------------------------------
alter table public.crm_products
  add column if not exists paypal_product_id text unique,
  add column if not exists paypal_sync_status text not null default 'not_synced'
    check (paypal_sync_status in ('not_synced','synced','error')),
  add column if not exists paypal_last_synced_at timestamptz;

create table if not exists public.paypal_webhook_events (
  id text primary key,
  event_type text not null,
  resource_id text,
  processed_at timestamptz not null default now()
);
alter table public.paypal_webhook_events enable row level security;
revoke all on public.paypal_webhook_events from anon, authenticated;
create policy "Admins read PayPal webhook events" on public.paypal_webhook_events for select to authenticated using (public.is_admin());


-- -----------------------------------------------------------------------------
-- Source: 20260826000004_referral_credit_wallet.sql
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto;

create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{8,16}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  prospect_email text not null,
  prospect_user_id uuid unique references auth.users(id) on delete set null,
  status text not null default 'invited' check (status in ('invited','signed_up','qualified','rejected')),
  signed_up_at timestamptz,
  qualified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (referrer_user_id, prospect_email)
);

create table if not exists public.referral_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  referral_id uuid references public.referrals(id) on delete set null,
  kind text not null check (kind in ('referred_customer','referrer','admin_adjustment','redemption','reversal')),
  amount_minor integer not null check (amount_minor <> 0),
  currency text not null default 'GBP' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending','available','used','expired','revoked')),
  available_at timestamptz not null default now(),
  expires_at timestamptz,
  paypal_sale_id text,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists referral_welcome_credit_once on public.referral_credits(referral_id, kind) where kind = 'referred_customer';
create unique index if not exists referral_referrer_credit_once on public.referral_credits(referral_id, kind) where kind = 'referrer';
create unique index if not exists referral_redemption_sale_once on public.referral_credits(paypal_sale_id, kind) where kind = 'redemption';
create index if not exists referral_credits_wallet on public.referral_credits(user_id, currency, status, available_at);
create index if not exists referrals_prospect_email on public.referrals(lower(prospect_email));

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_credits enable row level security;
revoke all on public.referral_codes, public.referrals, public.referral_credits from anon, authenticated;
grant select on public.referral_codes, public.referrals, public.referral_credits to authenticated;

create policy "Users read their referral code" on public.referral_codes for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "Users read their referrals" on public.referrals for select to authenticated using (referrer_user_id = auth.uid() or prospect_user_id = auth.uid() or public.is_admin());
create policy "Users read their credits" on public.referral_credits for select to authenticated using (user_id = auth.uid() or public.is_admin());

comment on table public.referral_credits is 'Append-only referral credit ledger. Positive rows earn credit; negative redemption/reversal rows consume it.';


-- -----------------------------------------------------------------------------
-- Source: 20260826000005_founder_subscriber_offer.sql
-- -----------------------------------------------------------------------------
alter table public.crm_products
  add column if not exists paypal_founder_plan_id text unique,
  add column if not exists paypal_founder_plan_active boolean not null default false;

create table if not exists public.founder_subscriber_slots (
  slot_number smallint primary key check (slot_number between 1 and 100),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  billing_interval text not null check (billing_interval in ('month','year')),
  status text not null default 'reserved' check (status in ('reserved','qualified','released')),
  discount_cycles_remaining smallint not null check (discount_cycles_remaining between 0 and 3),
  paypal_subscription_id text,
  reserved_at timestamptz not null default now(),
  reservation_expires_at timestamptz not null default (now() + interval '2 hours'),
  qualified_at timestamptz
);

alter table public.founder_subscriber_slots enable row level security;
revoke all on public.founder_subscriber_slots from anon, authenticated;
grant select on public.founder_subscriber_slots to authenticated;
create policy "Users read their founder offer" on public.founder_subscriber_slots for select to authenticated using (user_id = auth.uid() or public.is_admin());

create or replace function public.reserve_founder_subscriber_slot(target_user_id uuid, target_interval text)
returns table(slot_number smallint, discount_cycles_remaining smallint)
language plpgsql security definer set search_path = public as $$
declare selected_slot smallint;
declare cycles smallint;
begin
  if target_interval not in ('month','year') then return; end if;
  if exists(select 1 from public.profiles where id = target_user_id and role in ('staff','partner_admin')) then return; end if;
  perform pg_advisory_xact_lock(7100100);
  update public.founder_subscriber_slots set status = 'released'
    where status = 'reserved' and reservation_expires_at < now();
  if exists(select 1 from public.founder_subscriber_slots f where f.user_id = target_user_id and f.status = 'qualified') then return; end if;
  cycles := case when target_interval = 'month' then 3 else 1 end;
  select f.slot_number into selected_slot from public.founder_subscriber_slots f where f.user_id = target_user_id and f.status = 'reserved' limit 1;
  if selected_slot is not null then
    update public.founder_subscriber_slots set billing_interval = target_interval, discount_cycles_remaining = cycles, reservation_expires_at = now() + interval '2 hours' where founder_subscriber_slots.slot_number = selected_slot;
    return query select selected_slot, cycles;
    return;
  end if;
  select candidate::smallint into selected_slot from generate_series(1,100) candidate
    where not exists(select 1 from public.founder_subscriber_slots f where f.slot_number = candidate and f.status in ('reserved','qualified')) limit 1;
  if selected_slot is null then return; end if;
  delete from public.founder_subscriber_slots where slot_number = selected_slot or user_id = target_user_id;
  insert into public.founder_subscriber_slots(slot_number,user_id,billing_interval,discount_cycles_remaining)
    values(selected_slot,target_user_id,target_interval,cycles);
  return query select selected_slot, cycles;
end $$;

revoke all on function public.reserve_founder_subscriber_slot(uuid,text) from public, anon, authenticated;
comment on table public.founder_subscriber_slots is 'First 100 non-staff subscribers eligible for 50% off three monthly cycles or one annual cycle.';


-- -----------------------------------------------------------------------------
-- Consolidated test-project hardening and explicit grants
-- -----------------------------------------------------------------------------

-- Supabase normally supplies API grants through its default roles. These
-- explicit grants make the intended client access clear and reproducible.
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete
  on public.memory_entries,
     public.journal_entries,
     public.daily_mood_logs,
     public.chat_messages
  to authenticated;

grant select on public.vetted_knowledge_chunks to authenticated;
grant execute on function public.match_vetted_knowledge(extensions.vector, float, int)
  to authenticated, service_role;

grant select on public.profiles to authenticated;
revoke insert, update, delete on public.profiles from authenticated;

-- Users may edit only non-privileged self-service profile columns. In
-- particular, role, CRM status/ownership, company, address, and sync audit
-- fields remain server/service-role controlled.
grant update (
  preferred_name,
  pronouns,
  identity_tags,
  location_region,
  life_stage,
  opt_in_memory,
  crm_sync_consent,
  privacy_level,
  updated_at
) on public.profiles to authenticated;

drop policy if exists "Users can create their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own safe profile fields"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

grant select, insert on public.audit_logs to authenticated;
grant select on public.subscriptions to authenticated;
grant select, insert on public.waitlist to anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant select on public.referral_codes, public.referrals, public.referral_credits
  to authenticated;

-- The Q server calls this RPC with its service-role client. Browser clients
-- must not be able to reserve slots for arbitrary users.
grant execute on function public.reserve_founder_subscriber_slot(uuid, text)
  to service_role;

-- Deterministic, non-live catalogue rows for test fixtures. They remain
-- inactive until PayPal sandbox products/plans are created and synchronized.
insert into public.crm_products (
  id,
  name,
  description,
  price_minor,
  currency,
  billing_interval,
  active
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    'Q Monthly',
    'Q monthly subscription for automated tests',
    999,
    'GBP',
    'month',
    false
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'Q Annual',
    'Q annual subscription for automated tests',
    9999,
    'GBP',
    'year',
    false
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  price_minor = excluded.price_minor,
  currency = excluded.currency,
  billing_interval = excluded.billing_interval;

comment on table public.profiles is
  'Q user profiles. Privileged roles are assigned only by trusted server/service-role operations.';

commit;

-- -----------------------------------------------------------------------------
-- AFTER creating users in Authentication > Users
-- -----------------------------------------------------------------------------
-- Promote exactly the dedicated Playwright admin by replacing the email below.
-- Run this statement separately after the Auth user exists:
--
-- update public.profiles
-- set role = 'partner_admin', updated_at = now()
-- where id = (
--   select id from auth.users
--   where lower(email) = lower('playwright-admin@example.test')
-- );
--
-- Optional staff account:
--
-- update public.profiles
-- set role = 'staff', updated_at = now()
-- where id = (
--   select id from auth.users
--   where lower(email) = lower('playwright-staff@example.test')
-- );

