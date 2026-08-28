-- User content remains private even when application roles gain administrative access.
do $$
declare table_name text;
begin
  foreach table_name in array array['memory_entries', 'journal_entries', 'daily_mood_logs', 'chat_messages'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
  end loop;
end $$;

drop policy if exists "Users can manage their own memories" on public.memory_entries;
drop policy if exists "Users can manage their own journal entries" on public.journal_entries;
drop policy if exists "Users can manage their own mood logs" on public.daily_mood_logs;
drop policy if exists "Users can manage their own chat messages" on public.chat_messages;

create policy "memory_entries_owner_only" on public.memory_entries for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "journal_entries_owner_only" on public.journal_entries for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "daily_mood_logs_owner_only" on public.daily_mood_logs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "chat_messages_owner_only" on public.chat_messages for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.hosted_ai_usage_windows (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_kind text not null check (window_kind in ('minute', 'day')),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, window_kind, window_start)
);

alter table public.hosted_ai_usage_windows enable row level security;
alter table public.hosted_ai_usage_windows force row level security;
revoke all on table public.hosted_ai_usage_windows from anon, authenticated;

create or replace function public.consume_hosted_ai_allowance()
returns table (allowed boolean, tier text, minute_remaining integer, day_remaining integer)
language plpgsql security definer set search_path = public
as $$
declare
  caller uuid := auth.uid();
  paid boolean := false;
  minute_limit integer;
  day_limit integer;
  minute_count integer;
  day_count integer;
  minute_bucket timestamptz := date_trunc('minute', now());
  day_bucket timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
begin
  if caller is null then raise exception 'Authentication required' using errcode = '28000'; end if;

  select exists (
    select 1 from public.subscriptions where user_id = caller and status = 'ACTIVE'
      and (current_period_end is null or current_period_end > now())
  ) into paid;
  minute_limit := case when paid then 10 else 4 end;
  day_limit := case when paid then 100 else 20 end;

  insert into public.hosted_ai_usage_windows (user_id, window_kind, window_start, request_count)
  values (caller, 'minute', minute_bucket, 1)
  on conflict (user_id, window_kind, window_start) do update
    set request_count = hosted_ai_usage_windows.request_count + 1, updated_at = now()
  returning request_count into minute_count;

  insert into public.hosted_ai_usage_windows (user_id, window_kind, window_start, request_count)
  values (caller, 'day', day_bucket, 1)
  on conflict (user_id, window_kind, window_start) do update
    set request_count = hosted_ai_usage_windows.request_count + 1, updated_at = now()
  returning request_count into day_count;

  return query select minute_count <= minute_limit and day_count <= day_limit,
    case when paid then 'paid' else 'free' end,
    greatest(minute_limit - minute_count, 0), greatest(day_limit - day_count, 0);
end;
$$;

revoke all on function public.consume_hosted_ai_allowance() from public, anon;
grant execute on function public.consume_hosted_ai_allowance() to authenticated;
create index if not exists hosted_ai_usage_windows_cleanup_idx on public.hosted_ai_usage_windows (window_start);
