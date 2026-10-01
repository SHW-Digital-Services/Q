-- Archiving preserves the workflow status, message and recorded reply.
alter table public.contact_requests add column archived_at timestamptz;

create index contact_requests_inbox_created_idx
  on public.contact_requests (created_at desc) where archived_at is null;
create index contact_requests_archive_created_idx
  on public.contact_requests (created_at desc) where archived_at is not null;
