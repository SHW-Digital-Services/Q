create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'beta_tester', 'partner_admin')),
  org_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default now()
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_user_profile();

alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'partner_admin'
  );
$$;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "Users can read their own audit logs" on public.audit_logs;
create policy "Users can read their own audit logs"
  on public.audit_logs for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can create their own audit logs" on public.audit_logs;
create policy "Users can create their own audit logs"
  on public.audit_logs for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Anyone can read vetted knowledge" on public.vetted_knowledge_chunks;
drop policy if exists "Authenticated users can read vetted knowledge" on public.vetted_knowledge_chunks;
create policy "Authenticated users can read vetted knowledge"
  on public.vetted_knowledge_chunks for select
  to authenticated
  using (true);

drop policy if exists "Admins can insert vetted knowledge" on public.vetted_knowledge_chunks;
create policy "Admins can insert vetted knowledge"
  on public.vetted_knowledge_chunks for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update vetted knowledge" on public.vetted_knowledge_chunks;
create policy "Admins can update vetted knowledge"
  on public.vetted_knowledge_chunks for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
