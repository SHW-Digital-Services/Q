-- Ensure a retried or duplicated sale cannot consume a founder discount twice.
alter table public.founder_subscriber_slots
  add column if not exists last_paypal_sale_id text;

create or replace function public.apply_founder_payment(
  target_user_id uuid,
  target_subscription_id text,
  target_sale_id text
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare affected integer;
begin
  update public.founder_subscriber_slots set
    status = 'qualified',
    qualified_at = coalesce(qualified_at, now()),
    paypal_subscription_id = target_subscription_id,
    discount_cycles_remaining = greatest(0, discount_cycles_remaining - 1),
    last_paypal_sale_id = target_sale_id
  where user_id = target_user_id
    and status in ('reserved', 'qualified')
    and discount_cycles_remaining > 0
    and last_paypal_sale_id is distinct from target_sale_id;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;
revoke all on function public.apply_founder_payment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.apply_founder_payment(uuid, text, text) to service_role;
