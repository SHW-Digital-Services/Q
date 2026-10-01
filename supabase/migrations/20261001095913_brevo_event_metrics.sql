-- Aggregate all events in the reporting window; never depend on UI pagination.
create or replace function public.brevo_event_metrics(p_days integer default 30)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  first_day date;
  last_day date := (now() at time zone 'UTC')::date;
  result jsonb;
begin
  if p_days not in (7, 30, 90) or p_days is null then
    raise exception 'Choose a 7, 30 or 90 day reporting period.' using errcode = '22023';
  end if;
  first_day := last_day - (p_days - 1);
  with filtered as (
    select event_type, status, received_at from public.brevo_webhook_events
    where received_at >= (first_day::timestamp at time zone 'UTC')
      and received_at < ((last_day + 1)::timestamp at time zone 'UTC')
  ), buckets as (
    select (received_at at time zone 'UTC')::date as day, event_type, count(*) as count
    from filtered group by 1, 2
  )
  select jsonb_build_object(
    'days', p_days, 'from', first_day, 'to', last_day,
    'total', (select count(*) from filtered),
    'awaitingReview', (select count(*) from filtered where status = 'received'),
    'reviewed', (select count(*) from filtered where status = 'reviewed'),
    'buckets', coalesce((select jsonb_agg(jsonb_build_object('date', day, 'event_type', event_type, 'count', count) order by day, event_type) from buckets), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.brevo_event_metrics(integer) from public, anon, authenticated;
grant execute on function public.brevo_event_metrics(integer) to service_role;
