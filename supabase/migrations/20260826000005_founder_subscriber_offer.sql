alter table public.crm_products
  add column if not exists paypal_founder_plan_id text unique,
  add column if not exists paypal_founder_plan_active boolean not null default false;

create table if not exists public.founder_subscriber_slots (
  slot_number smallint primary key check (slot_number between 1 and 100),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  billing_interval text not null check (billing_interval in ('month','year')),
  status text not null default 'reserved' check (status in ('reserved','qualified','released')),
  discount_cycles_remaining smallint not null check (discount_cycles_remaining between 0 and 3),
  paypal_subscription_id text,
  reserved_at timestamptz not null default now(),
  reservation_expires_at timestamptz not null default (now() + interval '2 hours'),
  qualified_at timestamptz
);

alter table public.founder_subscriber_slots enable row level security;
revoke all on public.founder_subscriber_slots from anon, authenticated;
grant select on public.founder_subscriber_slots to authenticated;
create policy "Users read their founder offer" on public.founder_subscriber_slots for select to authenticated using (user_id = auth.uid() or public.is_admin());

create or replace function public.reserve_founder_subscriber_slot(target_user_id uuid, target_interval text)
returns table(slot_number smallint, discount_cycles_remaining smallint)
language plpgsql security definer set search_path = public as $$
declare selected_slot smallint;
declare cycles smallint;
begin
  if target_interval not in ('month','year') then return; end if;
  if exists(select 1 from public.profiles where id = target_user_id and role in ('staff','partner_admin')) then return; end if;
  perform pg_advisory_xact_lock(7100100);
  update public.founder_subscriber_slots set status = 'released'
    where status = 'reserved' and reservation_expires_at < now();
  if exists(select 1 from public.founder_subscriber_slots f where f.user_id = target_user_id and f.status = 'qualified') then return; end if;
  cycles := case when target_interval = 'month' then 3 else 1 end;
  select f.slot_number into selected_slot from public.founder_subscriber_slots f where f.user_id = target_user_id and f.status = 'reserved' limit 1;
  if selected_slot is not null then
    update public.founder_subscriber_slots set billing_interval = target_interval, discount_cycles_remaining = cycles, reservation_expires_at = now() + interval '2 hours' where founder_subscriber_slots.slot_number = selected_slot;
    return query select selected_slot, cycles;
    return;
  end if;
  select candidate::smallint into selected_slot from generate_series(1,100) candidate
    where not exists(select 1 from public.founder_subscriber_slots f where f.slot_number = candidate and f.status in ('reserved','qualified')) limit 1;
  if selected_slot is null then return; end if;
  delete from public.founder_subscriber_slots where slot_number = selected_slot or user_id = target_user_id;
  insert into public.founder_subscriber_slots(slot_number,user_id,billing_interval,discount_cycles_remaining)
    values(selected_slot,target_user_id,target_interval,cycles);
  return query select selected_slot, cycles;
end $$;

revoke all on function public.reserve_founder_subscriber_slot(uuid,text) from public, anon, authenticated;
comment on table public.founder_subscriber_slots is 'First 100 non-staff subscribers eligible for 50% off three monthly cycles or one annual cycle.';
