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
