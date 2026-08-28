alter table public.crm_products
  add column if not exists paypal_product_id text unique,
  add column if not exists paypal_sync_status text not null default 'not_synced'
    check (paypal_sync_status in ('not_synced','synced','error')),
  add column if not exists paypal_last_synced_at timestamptz;

create table if not exists public.paypal_webhook_events (
  id text primary key,
  event_type text not null,
  resource_id text,
  processed_at timestamptz not null default now()
);
alter table public.paypal_webhook_events enable row level security;
revoke all on public.paypal_webhook_events from anon, authenticated;
drop policy if exists "Admins read PayPal webhook events" on public.paypal_webhook_events;
create policy "Admins read PayPal webhook events" on public.paypal_webhook_events for select to authenticated using (public.is_admin());
