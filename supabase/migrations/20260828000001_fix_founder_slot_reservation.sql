-- Qualify output-column names in the founder reservation function so PostgreSQL
-- never confuses them with founder_subscriber_slots columns at checkout time.
create or replace function public.reserve_founder_subscriber_slot(target_user_id uuid, target_interval text)
returns table(slot_number smallint, discount_cycles_remaining smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_slot smallint;
  cycles smallint;
begin
  if target_user_id is distinct from auth.uid() and auth.role() <> 'service_role' then
    raise exception 'Cannot reserve a founder slot for another user' using errcode = '42501';
  end if;
  if target_interval not in ('month', 'year') then return; end if;
  if exists(select 1 from public.profiles p where p.id = target_user_id and p.role in ('staff', 'partner_admin')) then return; end if;

  perform pg_advisory_xact_lock(7100100);
  update public.founder_subscriber_slots f set status = 'released'
    where f.status = 'reserved' and f.reservation_expires_at < now();
  if exists(select 1 from public.founder_subscriber_slots f where f.user_id = target_user_id and f.status = 'qualified') then return; end if;

  cycles := case when target_interval = 'month' then 3 else 1 end;
  select f.slot_number into selected_slot
    from public.founder_subscriber_slots f
    where f.user_id = target_user_id and f.status = 'reserved'
    limit 1;
  if selected_slot is not null then
    update public.founder_subscriber_slots f
      set billing_interval = target_interval,
          discount_cycles_remaining = cycles,
          reservation_expires_at = now() + interval '2 hours'
      where f.slot_number = selected_slot;
    return query select selected_slot, cycles;
    return;
  end if;

  select candidate::smallint into selected_slot
    from generate_series(1, 100) candidate
    where not exists(
      select 1 from public.founder_subscriber_slots f
      where f.slot_number = candidate and f.status in ('reserved', 'qualified')
    )
    limit 1;
  if selected_slot is null then return; end if;

  delete from public.founder_subscriber_slots f
    where f.slot_number = selected_slot or f.user_id = target_user_id;
  insert into public.founder_subscriber_slots(slot_number, user_id, billing_interval, discount_cycles_remaining)
    values(selected_slot, target_user_id, target_interval, cycles);
  return query select selected_slot, cycles;
end;
$$;

revoke all on function public.reserve_founder_subscriber_slot(uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_founder_subscriber_slot(uuid, text) to service_role;
