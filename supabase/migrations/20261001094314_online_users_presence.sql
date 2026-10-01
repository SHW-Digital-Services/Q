-- Realtime already enables RLS on realtime.messages; do not ALTER its ownership.
drop policy if exists "authenticated can read online presence" on realtime.messages;
drop policy if exists "authenticated can publish online presence" on realtime.messages;

create policy "CRM read online presence" on realtime.messages
for select to authenticated
using (
  extension = 'presence' and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and (
      (p.role in ('staff', 'partner_admin') and (select realtime.topic()) = 'online-users') or
      (p.role = 'partner_admin' and (select realtime.topic()) in ('online-staff', 'online-admins'))
    )
  )
);

create policy "Accounts publish own online category" on realtime.messages
for insert to authenticated
with check (
  extension = 'presence' and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and (
      (p.role in ('user', 'beta_tester') and (select realtime.topic()) = 'online-users') or
      (p.role = 'staff' and (select realtime.topic()) = 'online-staff') or
      (p.role = 'partner_admin' and (select realtime.topic()) = 'online-admins')
    )
  )
);

-- Restrictive guards keep unrelated broad policies from widening these topics.
create policy "Protect CRM presence reads" on realtime.messages
as restrictive for select to public
using (
  (select realtime.topic()) not in ('online-users', 'online-staff', 'online-admins') or (
    extension = 'presence' and exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and (
        (p.role in ('staff', 'partner_admin') and (select realtime.topic()) = 'online-users') or
        (p.role = 'partner_admin' and (select realtime.topic()) in ('online-staff', 'online-admins'))
      )
    )
  )
);

create policy "Protect CRM presence publishing" on realtime.messages
as restrictive for insert to public
with check (
  (select realtime.topic()) not in ('online-users', 'online-staff', 'online-admins') or (
    extension = 'presence' and exists (
      select 1 from public.profiles p where p.id = (select auth.uid()) and (
        (p.role in ('user', 'beta_tester') and (select realtime.topic()) = 'online-users') or
        (p.role = 'staff' and (select realtime.topic()) = 'online-staff') or
        (p.role = 'partner_admin' and (select realtime.topic()) = 'online-admins')
      )
    )
  )
);
