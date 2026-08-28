-- Staff and partner administrators receive the paid hosted-AI allowance without PayPal billing.
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

  select
    exists (
      select 1 from public.subscriptions
      where user_id = caller and status = 'ACTIVE'
        and (current_period_end is null or current_period_end > now())
    )
    or exists (
      select 1 from public.profiles
      where id = caller and role in ('staff', 'partner_admin')
    )
  into paid;

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

comment on function public.consume_hosted_ai_allowance() is 'Atomically consumes hosted AI allowance; active subscribers, staff, and partner admins receive the paid tier.';
