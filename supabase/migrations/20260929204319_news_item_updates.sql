-- Preserve existing unlinked updates for staff to associate with real news.
-- NOT VALID exempts existing rows; all new/changed active updates require a parent.
alter table public.content_posts
  alter column content_type set default 'news',
  add column parent_news_id uuid,
  add column parent_news_type text not null default 'news' check (parent_news_type = 'news'),
  add constraint content_posts_id_type_key unique (id, content_type),
  add constraint content_posts_parent_news_fkey foreign key (parent_news_id, parent_news_type)
    references public.content_posts (id, content_type) on delete restrict,
  add constraint content_posts_news_relationship_check check (
    (content_type = 'news' and parent_news_id is null) or
    (content_type = 'update' and (parent_news_id is not null or status = 'archived'))
  ) not valid;

create index content_posts_parent_news_idx on public.content_posts (parent_news_id, published_at desc);

-- Public updates are served through the grouped content API, which verifies
-- the parent's publication status. Direct public table reads expose news only.
drop policy if exists "Anyone can read published content" on public.content_posts;
create policy "Anyone can read published content"
on public.content_posts for select to anon, authenticated
using (content_type = 'news' and status = 'published' and published_at is not null and published_at <= now());
