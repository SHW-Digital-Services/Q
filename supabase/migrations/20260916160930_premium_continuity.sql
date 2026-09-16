create table public.premium_continuity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 1000000),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.premium_continuity enable row level security;
revoke all on public.premium_continuity from public, anon, authenticated;
grant select, insert, update, delete on public.premium_continuity to service_role;
-- No direct browser access: the authenticated API verifies ownership and entitlement.
create function public.save_premium_continuity(owner_id uuid, expected_revision integer, new_payload jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare next_revision integer;
begin
  if expected_revision = 0 then
    insert into public.premium_continuity(user_id,payload) values(owner_id,new_payload)
    on conflict (user_id) do nothing returning revision into next_revision;
  else
    update public.premium_continuity set payload=new_payload, revision=revision+1, updated_at=now()
    where user_id=owner_id and revision=expected_revision returning revision into next_revision;
  end if;
  return next_revision;
end; $$;
revoke all on function public.save_premium_continuity(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.save_premium_continuity(uuid,integer,jsonb) to service_role;
