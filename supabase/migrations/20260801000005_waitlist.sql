create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  email text not null unique check (
    char_length(email) between 5 and 320
    and email = lower(email)
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

drop policy if exists "Anyone can join the waitlist" on public.waitlist;
create policy "Anyone can join the waitlist"
  on public.waitlist for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Admins can read the waitlist" on public.waitlist;
create policy "Admins can read the waitlist"
  on public.waitlist for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can manage the waitlist" on public.waitlist;
create policy "Admins can manage the waitlist"
  on public.waitlist for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create index if not exists waitlist_created_at_idx on public.waitlist (created_at desc);
