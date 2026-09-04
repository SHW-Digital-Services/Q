-- Repair profile columns required by the authenticated profile editor.
-- This is intentionally idempotent for projects whose earlier profile-fields
-- migration was recorded but not reflected in the PostgREST schema cache.
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
    select 1 from pg_constraint
    where conname = 'profiles_privacy_level_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_privacy_level_check
      check (privacy_level in ('high', 'standard'));
  end if;
end $$;

grant select, insert, update on public.profiles to authenticated;
notify pgrst, 'reload schema';
