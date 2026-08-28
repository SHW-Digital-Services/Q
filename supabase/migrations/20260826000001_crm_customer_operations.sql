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
    execute format('drop policy if exists "Admins manage %s" on public.%I', table_name, table_name);
    execute format('create policy "Admins manage %s" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', table_name, table_name);
  end loop;
end $$;

create index if not exists crm_notes_user_idx on public.crm_notes(user_id, created_at desc);
create index if not exists crm_tasks_user_idx on public.crm_tasks(user_id, status, due_at);
create index if not exists crm_payments_user_idx on public.crm_payments(user_id, occurred_at desc);
create index if not exists crm_entitlements_user_idx on public.crm_entitlements(user_id, status);
create index if not exists crm_activities_user_idx on public.crm_activities(user_id, created_at desc);
