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
