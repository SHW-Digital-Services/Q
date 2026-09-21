create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(slug) between 3 and 120),
  title text not null check (length(title) between 3 and 180),
  summary text not null check (length(summary) between 10 and 500),
  body text not null check (length(body) between 20 and 20000),
  content_type text not null default 'update' check (content_type in ('news', 'update')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  tags text[] not null default '{}'::text[],
  hero_image_url text,
  source_api_client_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'C')
  ) stored
);

create table if not exists public.content_api_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 3 and 120),
  token_hash text not null unique check (length(token_hash) = 64),
  token_prefix text not null check (length(token_prefix) between 8 and 16),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

alter table public.content_posts
  drop constraint if exists content_posts_source_api_client_id_fkey,
  add constraint content_posts_source_api_client_id_fkey
    foreign key (source_api_client_id) references public.content_api_clients(id) on delete set null;

create index if not exists content_posts_public_idx
  on public.content_posts (published_at desc, created_at desc)
  where status = 'published';
create index if not exists content_posts_content_type_idx on public.content_posts(content_type);
create index if not exists content_posts_search_idx on public.content_posts using gin(search_text);

create or replace function public.set_content_posts_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;
  if new.status <> 'published' then
    new.published_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists content_posts_set_updated_at on public.content_posts;
create trigger content_posts_set_updated_at
before update on public.content_posts
for each row execute function public.set_content_posts_updated_at();

alter table public.content_posts enable row level security;
alter table public.content_api_clients enable row level security;
revoke all on public.content_posts from anon, authenticated;
revoke all on public.content_api_clients from anon, authenticated;
grant select on public.content_posts to anon, authenticated;

drop policy if exists "Anyone can read published content" on public.content_posts;
create policy "Anyone can read published content"
on public.content_posts for select
to anon, authenticated
using (status = 'published' and published_at is not null and published_at <= now());

drop policy if exists "Staff can read all content" on public.content_posts;
create policy "Staff can read all content"
on public.content_posts for select
to authenticated
using (public.is_staff());

drop policy if exists "Admins manage content" on public.content_posts;
create policy "Admins manage content"
on public.content_posts for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins manage content API clients" on public.content_api_clients;
create policy "Admins manage content API clients"
on public.content_api_clients for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
