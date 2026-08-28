-- Hosted OpenAI processing is reserved for active subscribers and authorised staff.
-- Private local Llama processing remains available without consuming this allowance.
create or replace function public.consume_hosted_ai_allowance()
returns table (allowed boolean, tier text, minute_remaining integer, day_remaining integer)
language plpgsql security definer set search_path = public
as $$
declare
  caller uuid := auth.uid();
  entitled boolean := false;
  minute_limit integer := 10;
  day_limit integer := 100;
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
  into entitled;

  if not entitled then
    return query select false, 'local_only'::text, 0, 0;
    return;
  end if;

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
    'paid'::text,
    greatest(minute_limit - minute_count, 0),
    greatest(day_limit - day_count, 0);
end;
$$;

revoke all on function public.consume_hosted_ai_allowance() from public, anon;
grant execute on function public.consume_hosted_ai_allowance() to authenticated;

comment on function public.consume_hosted_ai_allowance() is 'Atomically consumes hosted AI allowance for active subscribers, staff, and partner admins; all other users are local-only.';
