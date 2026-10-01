-- Self-service profile updates must not change account access privileges.
create or replace function public.protect_profile_access_fields()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      if new.role <> 'user' or cardinality(new.staff_permissions) <> 0 or new.org_id is not null then
        raise exception 'Account access fields can only be managed by an administrator.' using errcode = '42501';
      end if;
    elsif new.role is distinct from old.role
      or new.staff_permissions is distinct from old.staff_permissions
      or new.org_id is distinct from old.org_id then
      raise exception 'Account access fields can only be managed by an administrator.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_profile_access_fields() from public, anon, authenticated;
drop trigger if exists protect_profile_access_fields on public.profiles;
create trigger protect_profile_access_fields
before insert or update on public.profiles
for each row execute function public.protect_profile_access_fields();
