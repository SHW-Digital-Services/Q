create table if not exists public.life_guides (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 4 and 180),
  category text not null check (category in ('healthcare', 'rights', 'social', 'mental_health', 'career', 'housing')),
  summary text not null check (length(summary) between 10 and 500),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) between 2 and 20),
  key_contacts_or_links jsonb not null default '[]'::jsonb check (jsonb_typeof(key_contacts_or_links) = 'array'),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.peer_knowledge_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  title text not null check (length(title) between 4 and 140),
  author_alias text not null default 'Community Peer' check (length(author_alias) between 1 and 120),
  tags text[] not null default '{}'::text[],
  category text not null check (length(category) between 2 and 80),
  content text not null check (length(content) between 20 and 5000),
  advice_key_takeaways text[] not null default '{}'::text[],
  upvotes integer not null default 0 check (upvotes >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'archived')),
  moderation_note text,
  moderated_by uuid references auth.users(id) on delete set null,
  moderated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_life_guides_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  if new.status = 'published' and new.published_at is null then new.published_at = now(); end if;
  if new.status <> 'published' then new.published_at = null; end if;
  return new;
end;
$$;

create or replace function public.set_peer_knowledge_posts_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  if new.status = 'approved' and new.published_at is null then new.published_at = now(); end if;
  if new.status <> 'approved' then new.published_at = null; end if;
  return new;
end;
$$;

drop trigger if exists life_guides_set_updated_at on public.life_guides;
create trigger life_guides_set_updated_at before update on public.life_guides
for each row execute function public.set_life_guides_updated_at();

drop trigger if exists peer_knowledge_posts_set_updated_at on public.peer_knowledge_posts;
create trigger peer_knowledge_posts_set_updated_at before update on public.peer_knowledge_posts
for each row execute function public.set_peer_knowledge_posts_updated_at();

create index if not exists life_guides_public_idx on public.life_guides (category, title) where status = 'published';
create index if not exists peer_knowledge_public_idx on public.peer_knowledge_posts (published_at desc, created_at desc) where status = 'approved';
create index if not exists peer_knowledge_user_idx on public.peer_knowledge_posts (user_id, created_at desc);
create index if not exists peer_knowledge_status_idx on public.peer_knowledge_posts (status, created_at desc);

alter table public.life_guides enable row level security;
alter table public.peer_knowledge_posts enable row level security;

revoke all on public.life_guides from anon, authenticated;
revoke all on public.peer_knowledge_posts from anon, authenticated;
grant select on public.life_guides to anon, authenticated;
grant select, insert on public.peer_knowledge_posts to anon, authenticated;

drop policy if exists "Anyone can read published life guides" on public.life_guides;
create policy "Anyone can read published life guides"
on public.life_guides for select
to anon, authenticated
using (status = 'published' and published_at is not null and published_at <= now());

drop policy if exists "Staff can read all life guides" on public.life_guides;
create policy "Staff can read all life guides"
on public.life_guides for select
to authenticated
using (public.is_staff());

drop policy if exists "Admins manage life guides" on public.life_guides;
create policy "Admins manage life guides"
on public.life_guides for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Anyone can read approved peer knowledge" on public.peer_knowledge_posts;
create policy "Anyone can read approved peer knowledge"
on public.peer_knowledge_posts for select
to anon, authenticated
using (status = 'approved' and published_at is not null and published_at <= now());

drop policy if exists "Anyone can submit peer knowledge for moderation" on public.peer_knowledge_posts;
create policy "Anyone can submit peer knowledge for moderation"
on public.peer_knowledge_posts for insert
to anon, authenticated
with check (status = 'pending');

drop policy if exists "Staff can read all peer knowledge" on public.peer_knowledge_posts;
create policy "Staff can read all peer knowledge"
on public.peer_knowledge_posts for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff can moderate peer knowledge" on public.peer_knowledge_posts;
create policy "Staff can moderate peer knowledge"
on public.peer_knowledge_posts for update
to authenticated
using (public.is_staff())
with check (public.is_staff());
