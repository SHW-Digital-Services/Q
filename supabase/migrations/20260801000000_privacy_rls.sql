-- Privacy-first storage primitives. Every private row is owned by one auth user.
create extension if not exists pgcrypto;

create table if not exists public.memory_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'memory',
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null,
  mood_rating smallint check (mood_rating between 1 and 5),
  mood_tags text[] not null default '{}',
  is_private boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_mood_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mood_date date not null,
  rating smallint not null check (rating between 1 and 5),
  mood_label text not null,
  note text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, mood_date)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sender text not null check (sender in ('user', 'q_ai')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.memory_entries enable row level security;
alter table public.journal_entries enable row level security;
alter table public.daily_mood_logs enable row level security;
alter table public.chat_messages enable row level security;

create policy "Users can manage their own memories"
  on public.memory_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own journal entries"
  on public.journal_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own mood logs"
  on public.daily_mood_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own chat messages"
  on public.chat_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
