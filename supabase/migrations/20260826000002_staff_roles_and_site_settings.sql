do $$ declare constraint_name text; begin
  select conname into constraint_name from pg_constraint
  where conrelid = 'public.profiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%role%';
  if constraint_name is not null then execute format('alter table public.profiles drop constraint %I', constraint_name); end if;
end $$;
alter table public.profiles add constraint profiles_role_check check (role in ('user','beta_tester','staff','partner_admin'));

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.site_settings(key, value) values ('launch_override', 'false'::jsonb) on conflict (key) do nothing;
alter table public.site_settings enable row level security;
grant select on public.site_settings to anon, authenticated;
create policy "Anyone can read site settings" on public.site_settings for select using (true);
create policy "Admins manage site settings" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role in ('staff','partner_admin'));
$$;
