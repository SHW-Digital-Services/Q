# Supabase test-project setup

This directory contains one consolidated migration for a brand-new Supabase
project dedicated to the Q Playwright suite:

`migrations/00000000000000_q_test_bootstrap.sql`

It is generated from, and intended to match, the ordered migrations in the
parent Q application at `D:\Dev\Q\supabase\migrations`.

Do not apply the consolidated file to production or to an existing project.
Existing environments must continue using the normal ordered migrations from
the parent Q repository.

## What the migration creates

- Private memories, journal entries, mood logs, and chat messages.
- Profiles, roles, audit logs, and the Auth profile-creation trigger.
- Vetted knowledge with pgvector search.
- Providers, sentiment feedback, and retention analytics.
- Subscriptions and PayPal webhook idempotency records.
- Waitlist and password-reset requests.
- Native CRM products, notes, tasks, payments, entitlements, and activities.
- Referral codes, referrals, and the referral-credit ledger.
- Founding 100 reservation state and its protected reservation function.
- Site settings and inactive monthly/yearly test catalogue rows.
- RLS, policies, grants, indexes, checks, and update triggers.

## Option A: Supabase dashboard SQL editor

1. Create a new Supabase project for automated testing.
2. Wait until project provisioning has completed.
3. Open **SQL Editor** in the Supabase dashboard.
4. Open `00000000000000_q_test_bootstrap.sql` locally.
5. Copy the entire file into a new SQL query.
6. Select **Run** once.
7. Confirm the query commits without an error.
8. Open **Table Editor** and confirm the tables are visible.

The migration is wrapped in a transaction. A SQL error rolls back the complete
bootstrap instead of leaving a partially created test schema.

## Option B: Supabase CLI

From the Playwright test directory:

```powershell
Set-Location D:\Dev\Q\site-tests\q-playwright-tests
npx supabase login
npx supabase link --project-ref YOUR_TEST_PROJECT_REF
npx supabase db push --linked --include-all
```

Use only the project reference for the new test project. Check the linked
project before pushing:

```powershell
npx supabase projects list
```

## Create the test users

Auth passwords must not be embedded in a database migration. Supabase manages
the `auth` schema, including identities, password hashes, confirmation state,
and future internal columns. Direct SQL such as `insert into auth.users` is
therefore intentionally not supplied: it is not a supported way to create a
login user and can produce accounts that appear in SQL but cannot authenticate.

### Recommended automated creation

The included server-side script calls Supabase's supported Auth Admin API and
then uses the database API to assign profiles and seed the subscriber:

`scripts/create-supabase-test-users.ts`

Add these temporary values to the test-suite `.env`:

```dotenv
SUPABASE_URL=https://YOUR_TEST_PROJECT_REF.supabase.co
TEST_SUPABASE_SERVICE_ROLE_KEY=your-test-project-service-role-key
ALLOW_TEST_USER_SETUP=1
CONFIRM_TEST_PROJECT_REF=YOUR_TEST_PROJECT_REF

FREE_USER_EMAIL=playwright-free@your-test-domain.example
FREE_USER_PASSWORD=replace-with-strong-unique-password
SUBSCRIBER_EMAIL=playwright-subscriber@your-test-domain.example
SUBSCRIBER_PASSWORD=replace-with-strong-unique-password
ADMIN_EMAIL=playwright-admin@your-test-domain.example
ADMIN_PASSWORD=replace-with-strong-unique-password
```

The project-reference confirmation is a safety check. It must exactly match
the first hostname segment in `SUPABASE_URL`.

Run:

```powershell
Set-Location D:\Dev\Q\site-tests\q-playwright-tests
npm run setup:supabase-users
```

The script performs these operations:

1. Creates missing Auth users through `auth.admin.createUser()`.
2. Confirms their email addresses for deterministic login tests.
3. Keeps an existing Auth user instead of creating a duplicate.
4. Assigns `user` to the free user and subscriber.
5. Assigns `partner_admin` only to the admin user.
6. Seeds an active synthetic monthly subscription for the subscriber.

After setup, remove `TEST_SUPABASE_SERVICE_ROLE_KEY` from the test-suite
`.env`, or leave it blank. Playwright browser tests do not need it. Set
`ALLOW_TEST_USER_SETUP=0` again to prevent accidental reruns.

### Dashboard alternative

1. Open **Authentication > Users** in the Supabase dashboard.
2. Create the free user specified by `FREE_USER_EMAIL`.
3. Create the subscriber specified by `SUBSCRIBER_EMAIL`.
4. Create the administrator specified by `ADMIN_EMAIL`.
5. Mark emails as confirmed if the test project requires email confirmation.
6. Use dedicated test passwords and store them only in the local `.env` or
   encrypted GitHub Actions secrets.

The Auth trigger automatically creates a corresponding `public.profiles` row
for each user.

## SQL to configure and verify the created users

The following SQL is safe to run after the Auth Admin API or Dashboard has
created the login users. Replace all example email addresses before running it.

It does not store passwords and does not modify Supabase-managed Auth columns.

```sql
begin;

-- Fail instead of silently configuring an incomplete set of users.
do $$
declare
  matched_users integer;
begin
  select count(*)
  into matched_users
  from auth.users
  where lower(email) in (
    lower('playwright-free@your-test-domain.example'),
    lower('playwright-subscriber@your-test-domain.example'),
    lower('playwright-admin@your-test-domain.example')
  );

  if matched_users <> 3 then
    raise exception
      'Expected exactly 3 test Auth users, found %',
      matched_users;
  end if;
end $$;

-- Ensure every Auth user has a public profile. The migration trigger normally
-- creates these rows automatically.
insert into public.profiles (id, preferred_name, role)
select
  id,
  case lower(email)
    when lower('playwright-free@your-test-domain.example')
      then 'Playwright Free User'
    when lower('playwright-subscriber@your-test-domain.example')
      then 'Playwright Subscriber'
    when lower('playwright-admin@your-test-domain.example')
      then 'Playwright Admin'
  end,
  case
    when lower(email) = lower(
      'playwright-admin@your-test-domain.example'
    ) then 'partner_admin'
    else 'user'
  end
from auth.users
where lower(email) in (
  lower('playwright-free@your-test-domain.example'),
  lower('playwright-subscriber@your-test-domain.example'),
  lower('playwright-admin@your-test-domain.example')
)
on conflict (id) do update set
  preferred_name = excluded.preferred_name,
  role = excluded.role,
  updated_at = now();

-- Seed non-live subscription state for UI and entitlement checks. This does
-- not replace a real PayPal Sandbox subscription for webhook tests.
insert into public.subscriptions (
  user_id,
  paypal_subscription_id,
  paypal_plan_id,
  status,
  current_period_end
)
select
  id,
  'TEST-SUBSCRIPTION-MONTHLY',
  'TEST-PLAN-MONTHLY',
  'ACTIVE',
  now() + interval '30 days'
from auth.users
where lower(email) = lower(
  'playwright-subscriber@your-test-domain.example'
)
on conflict (user_id) do update set
  paypal_subscription_id = excluded.paypal_subscription_id,
  paypal_plan_id = excluded.paypal_plan_id,
  status = excluded.status,
  current_period_end = excluded.current_period_end,
  updated_at = now();

commit;
```

## Verify the administrator role

Replace the example email and run this in the SQL editor after creating the
admin Auth user:

```sql
update public.profiles
set role = 'partner_admin', updated_at = now()
where id = (
  select id
  from auth.users
  where lower(email) = lower('playwright-admin@example.test')
);
```

Confirm exactly one intended row was promoted:

```sql
select u.email, p.role
from auth.users u
join public.profiles p on p.id = u.id
order by u.email;
```

Normal browser users cannot update the `role` column. Role changes must go
through the trusted Q server using the Supabase service-role key.

## Configure Q and Playwright

Add the test project's URL, anonymous key, and service-role key to the parent
Q app's local environment at `D:\Dev\Q\.env`. Never expose the service-role
key through a `VITE_` variable.

Add the URL, anonymous key, and test-user credentials to:

`D:\Dev\Q\site-tests\q-playwright-tests\.env`

Use `.env.example` as the template. The Playwright suite does not need the
service-role key for browser tests.

## PayPal sandbox preparation

The migration seeds inactive Q Monthly and Q Annual catalogue entries. They
remain inactive so a fresh test project cannot accidentally advertise
unconfigured payment plans.

1. Create monthly and yearly products/plans in PayPal Sandbox.
2. Configure the parent Q app with sandbox credentials and sandbox plan IDs.
3. Configure the sandbox webhook to call the test Q server's
   `/api/billing/paypal/webhook` endpoint.
4. Set `PAYPAL_ENV=sandbox`.
5. Synchronize the products so `paypal_product_id`, `paypal_plan_id`, and the
   founder plan fields are populated.
6. Confirm `paypal_sync_status='synced'` before enabling a product.

The Founding 100 rule remains 50% off the first three monthly billing cycles or
the first annual cycle. Staff and `partner_admin` accounts are excluded.

## Verify RLS

After creating at least two ordinary users, use the API tests to confirm one
user cannot read or modify another user's private rows. At minimum run:

```powershell
npm run typecheck
npm run test:api -- --project=chromium
npx playwright test tests/security --project=chromium
```

Also review **Database > Policies** in Supabase. Every application table in
this bootstrap has RLS enabled. Server-only CRM, password-reset, webhook, and
payment operations rely on the Q server's service-role client, which bypasses
RLS and must never be exposed to browsers.

## Resetting the test project

For a disposable hosted test project, delete and recreate the project, then
apply this migration again. For local Supabase development with Docker:

```powershell
npx supabase start
npx supabase db reset
npx supabase db lint --local --level error
```

Resetting deletes test data. Never run reset commands against production.
