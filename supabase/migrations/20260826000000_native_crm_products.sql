-- Native Q CRM product catalogue. PayPal remains the payment processor.
create table if not exists public.crm_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_minor integer not null default 0 check (price_minor >= 0),
  currency text not null default 'GBP' check (char_length(currency) = 3),
  billing_interval text not null default 'month' check (billing_interval in ('one_time', 'month', 'year')),
  paypal_plan_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_products enable row level security;
revoke all on public.crm_products from anon, authenticated;

drop policy if exists "Admins can read CRM products" on public.crm_products;
create policy "Admins can read CRM products"
  on public.crm_products for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can create CRM products" on public.crm_products;
create policy "Admins can create CRM products"
  on public.crm_products for insert to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update CRM products" on public.crm_products;
create policy "Admins can update CRM products"
  on public.crm_products for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.touch_crm_products_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_crm_products_updated_at on public.crm_products;
create trigger touch_crm_products_updated_at
  before update on public.crm_products
  for each row execute procedure public.touch_crm_products_updated_at();
