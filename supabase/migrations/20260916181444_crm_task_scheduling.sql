alter table public.crm_tasks
  add column if not exists starts_at timestamptz;

create index if not exists crm_tasks_starts_at_idx on public.crm_tasks (user_id, starts_at);
