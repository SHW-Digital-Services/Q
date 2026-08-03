create extension if not exists vector with schema extensions;

create table if not exists public.vetted_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  source text not null,
  source_url text,
  category text not null check (category in ('healthcare', 'legal')),
  embedding extensions.vector(768) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- IVFFlat is supported on older pgvector versions where HNSW is unavailable.
create index if not exists vetted_knowledge_chunks_embedding_idx
  on public.vetted_knowledge_chunks
  using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 100);

alter table public.vetted_knowledge_chunks enable row level security;

drop policy if exists "Anyone can read vetted knowledge" on public.vetted_knowledge_chunks;
create policy "Anyone can read vetted knowledge"
  on public.vetted_knowledge_chunks for select
  using (true);

create or replace function public.match_vetted_knowledge(
  query_embedding extensions.vector(768),
  match_threshold float default 0.65,
  match_count int default 5
)
returns table (
  id uuid,
  title text,
  content text,
  source text,
  source_url text,
  category text,
  similarity float
)
language sql
stable
as $$
  select
    chunks.id,
    chunks.title,
    chunks.content,
    chunks.source,
    chunks.source_url,
    chunks.category,
    1 - (chunks.embedding OPERATOR(extensions.<=>) query_embedding) as similarity
  from public.vetted_knowledge_chunks as chunks
  where 1 - (chunks.embedding OPERATOR(extensions.<=>) query_embedding) >= match_threshold
  order by chunks.embedding OPERATOR(extensions.<=>) query_embedding
  limit least(match_count, 10);
$$;
