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
