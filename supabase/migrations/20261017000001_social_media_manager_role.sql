alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('user', 'beta_tester', 'staff', 'partner_admin', 'social_media_manager'));
