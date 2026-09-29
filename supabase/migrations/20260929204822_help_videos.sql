create table public.help_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 3 and 180),
  steps text[] not null check (cardinality(steps) between 1 and 50),
  video_url text check (video_url ~ '^https://'),
  video_path text check (video_path ~ '^videos/[0-9a-f-]+\.(mp4|webm|ogg)$'),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((video_url is null) <> (video_path is null))
);
create index help_videos_public_idx on public.help_videos (created_at desc) where status = 'published';
alter table public.help_videos enable row level security;
revoke all on public.help_videos from anon, authenticated;
grant select on public.help_videos to anon, authenticated;
create policy "Public published help videos" on public.help_videos for select to anon, authenticated using (status = 'published');
create policy "Admins read help videos" on public.help_videos for select to authenticated using ((select public.is_admin()));

-- Private files are exposed to viewers only by the published-video API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('help-videos', 'help-videos', false, 104857600, array['video/mp4', 'video/webm', 'video/ogg']);
