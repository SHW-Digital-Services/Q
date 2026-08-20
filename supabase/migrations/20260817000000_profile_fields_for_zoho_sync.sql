alter table public.profiles
  add column if not exists preferred_name text,
  add column if not exists pronouns text,
  add column if not exists identity_tags text[] not null default '{}',
  add column if not exists location_region text,
  add column if not exists life_stage text,
  add column if not exists opt_in_memory boolean not null default true,
  add column if not exists crm_sync_consent boolean not null default true,
  add column if not exists privacy_level text not null default 'high',
  add column if not exists zoho_last_synced_at timestamptz,
  add column if not exists zoho_sync_status text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_privacy_level_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_privacy_level_check
      check (privacy_level in ('high', 'standard'));
  end if;
end $$;

create or replace function public.touch_profiles_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.touch_profiles_updated_at();

grant select, insert, update on public.profiles to authenticated;

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
