alter table public.crm_entitlements
  drop constraint if exists crm_entitlements_source_check;

alter table public.crm_entitlements
  add constraint crm_entitlements_source_check
  check (source in ('manual','paypal','promotion','community_competition'));

create table if not exists public.community_newsletters (
  id uuid primary key default gen_random_uuid(),
  award_month date not null unique,
  status text not null default 'preview' check (status in ('preview','awarded','delivered','delivery_failed')),
  payload jsonb not null default '{}'::jsonb,
  slack_message_id text,
  delivery_error text,
  created_at timestamptz not null default now(),
  awarded_at timestamptz,
  delivered_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.community_competition_winners (
  id uuid primary key default gen_random_uuid(),
  newsletter_id uuid not null references public.community_newsletters(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  post_id uuid not null references public.peer_knowledge_posts(id) on delete restrict,
  winner_type text not null check (winner_type in ('random_top_five','most_liked')),
  likes integer not null default 0 check (likes >= 0),
  prize_months integer not null default 0 check (prize_months >= 0),
  eligible_again_at timestamptz,
  created_at timestamptz not null default now(),
  unique (newsletter_id, winner_type)
);

create index if not exists community_competition_user_eligibility_idx
  on public.community_competition_winners (user_id, winner_type, created_at desc);

alter table public.community_newsletters enable row level security;
alter table public.community_competition_winners enable row level security;
revoke all on public.community_newsletters from anon, authenticated;
revoke all on public.community_competition_winners from anon, authenticated;
