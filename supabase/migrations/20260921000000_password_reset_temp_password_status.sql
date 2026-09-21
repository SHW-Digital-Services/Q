alter table public.password_reset_requests
  drop constraint if exists password_reset_requests_status_check;

alter table public.password_reset_requests
  add constraint password_reset_requests_status_check
  check (status in ('pending', 'reset', 'temp_issued', 'failed'));