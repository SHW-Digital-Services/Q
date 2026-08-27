# Q Playwright test suite

This project contains Playwright end-to-end, API, authentication, mobile,
security, PayPal sandbox, and smoke tests for the Q application.

The expected local layout is:

```text
D:\Dev\Q\
├── package.json
├── server.ts
├── src\
└── site-tests\
    └── q-playwright-tests\
        ├── package.json
        ├── playwright.config.ts
        └── tests\
```

Playwright starts and tests the parent application in `D:\Dev\Q`. The test
suite remains a separate Node project in
`D:\Dev\Q\site-tests\q-playwright-tests`.

## Prerequisites

Install the following before continuing:

1. Git.
2. Node.js 22 or a compatible newer LTS release.
3. npm, which is installed with Node.js.
4. Access to the Q Supabase test project if authenticated tests will be run.
5. PayPal sandbox credentials if PayPal integration tests will be run.

Confirm Node.js and npm are available in PowerShell:

```powershell
node --version
npm --version
```

## 1. Install the parent Q application

Open PowerShell and move to the parent application:

```powershell
Set-Location D:\Dev\Q
npm ci
```

Use `npm install` instead of `npm ci` only when intentionally updating the
parent application's lockfile.

Confirm that the parent app can compile:

```powershell
npm run lint
```

## 2. Install the test-suite dependencies

Move into the Playwright project and install its locked dependencies:

```powershell
Set-Location D:\Dev\Q\site-tests\q-playwright-tests
npm ci
```

## 3. Install Playwright browsers

For normal local Chromium testing:

```powershell
npx playwright install chromium
```

To run the complete Chromium, Firefox, and WebKit matrix:

```powershell
npx playwright install
```

On a Linux CI host, install browsers and operating-system dependencies with:

```bash
npx playwright install --with-deps
```

## 4. Configure the test environment

The committed `.env.example` file documents all supported values. The local
`.env` file is ignored by Git and must never contain production credentials.

Open `.env` in
`D:\Dev\Q\site-tests\q-playwright-tests` and configure the values required by
the test groups you intend to run:

```dotenv
BASE_URL=http://127.0.0.1:3000

VITE_SUPABASE_URL=https://your-test-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-test-anon-key
SUPABASE_URL=https://your-test-project.supabase.co
SUPABASE_ANON_KEY=your-test-anon-key

FREE_USER_EMAIL=playwright-free@example.test
FREE_USER_PASSWORD=replace-with-test-password
SUBSCRIBER_EMAIL=playwright-subscriber@example.test
SUBSCRIBER_PASSWORD=replace-with-test-password
ADMIN_EMAIL=playwright-admin@example.test
ADMIN_PASSWORD=replace-with-test-password

PAYPAL_CLIENT_ID=your-sandbox-client-id
PAYPAL_CLIENT_SECRET=your-sandbox-client-secret
PAYPAL_WEBHOOK_ID=your-sandbox-webhook-id
```

Use dedicated test users and sandbox services. Do not point state-changing
tests at production.

The parent Q application also needs its own environment variables in
`D:\Dev\Q\.env`. The test suite does not replace or copy the parent app's
configuration.

For a brand-new dedicated Supabase test project, follow
[`supabase/README.md`](supabase/README.md). It uses the consolidated migration
at `supabase/migrations/00000000000000_q_test_bootstrap.sql`.

## 5. Prepare test accounts

Create these users only in the dedicated Supabase test project. Do not reuse
personal accounts, customer accounts, or production passwords.

### 5.1 Choose the test identities

Prepare three unique email addresses and strong passwords:

| Purpose | Environment variables | Database role |
| --- | --- | --- |
| Free user | `FREE_USER_EMAIL`, `FREE_USER_PASSWORD` | `user` |
| Paid test user | `SUBSCRIBER_EMAIL`, `SUBSCRIBER_PASSWORD` | `user` |
| Q administrator | `ADMIN_EMAIL`, `ADMIN_PASSWORD` | `partner_admin` |

Example addresses may look like
`playwright-free@your-test-domain.example`,
`playwright-subscriber@your-test-domain.example`, and
`playwright-admin@your-test-domain.example`. Use inboxes you control if you
intend to test email verification or password-reset delivery.

Generate a different password for each account. Passwords should meet the
Supabase project's configured password policy. Do not commit them to Git.

### 5.2 Apply the database migration first

Apply the consolidated test migration before creating users. This installs the
Auth trigger that automatically creates a matching `public.profiles` row:

```text
supabase/migrations/00000000000000_q_test_bootstrap.sql
```

Full migration instructions are in
[`supabase/README.md`](supabase/README.md).

### 5.3 Create each user in Supabase

Repeat these actions for the free user, subscriber, and administrator:

1. Sign in to the Supabase Dashboard.
2. Open the dedicated Q test project. Check the project name and reference
   carefully so you do not create users in production.
3. Select **Authentication** in the left navigation.
4. Open **Users**.
5. Select **Add user**, followed by **Create new user** if that second option is
   displayed.
6. Enter the test email address.
7. Enter the dedicated password for that account.
8. Enable **Auto Confirm User** or **Email confirmed** for tests that need to
   sign in immediately.
9. Select **Create user**.
10. Copy the user's UUID from the user details page if you want to verify it
    directly in SQL.

If the test is specifically checking the email-verification journey, leave a
separate disposable account unconfirmed. The three main automation accounts
should normally be confirmed so unrelated login tests are deterministic.

Do not create users by inserting directly into `auth.users`. Supabase Auth must
create them so password hashes, identities, confirmation state, and metadata
are valid.

### 5.4 Verify profile creation

Open **SQL Editor**, create a new query, and run:

```sql
select
  u.id,
  u.email,
  u.email_confirmed_at,
  p.role,
  p.created_at
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) in (
  lower('playwright-free@your-test-domain.example'),
  lower('playwright-subscriber@your-test-domain.example'),
  lower('playwright-admin@your-test-domain.example')
)
order by u.email;
```

Replace all three example addresses. The query should return three rows, each
with a non-null profile and an initial role of `user`.

If a profile is missing, do not manually promote or configure that user yet.
Confirm the consolidated migration completed and that the
`on_auth_user_created_profile` trigger exists, then recreate the test user.

### 5.5 Promote only the administrator

The Q server authorizes administrator operations from
`public.profiles.role`. Supabase user metadata and client-side state are not
sufficient.

Replace the example email and run this query:

```sql
update public.profiles
set
  role = 'partner_admin',
  updated_at = now()
where id = (
  select id
  from auth.users
  where lower(email) = lower('playwright-admin@your-test-domain.example')
);
```

The SQL editor should report one affected row. Verify all roles afterward:

```sql
select u.email, p.role
from auth.users u
join public.profiles p on p.id = u.id
where lower(u.email) like 'playwright-%'
order by u.email;
```

The free user and subscriber must remain `user`; only the administrator should
be `partner_admin`. Do not make the subscriber an admin merely to simplify a
test.

### 5.6 Give the subscriber test access

For real checkout and webhook coverage, create the subscription through the
PayPal Sandbox flow. This is the preferred approach because it tests the same
server and webhook behavior as Q without charging real money.

For UI tests that only require an existing active subscription, you may seed a
clearly synthetic subscription in the test project:

```sql
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
```

Use synthetic IDs only in the dedicated test project. They do not make PayPal
webhook tests valid; those tests still require actual PayPal Sandbox plans,
subscriptions, credentials, and webhook signatures.

### 5.7 Add credentials to the local test environment

Open `D:\Dev\Q\site-tests\q-playwright-tests\.env` and add the exact values
used above:

```dotenv
FREE_USER_EMAIL=playwright-free@your-test-domain.example
FREE_USER_PASSWORD=replace-with-free-user-password

SUBSCRIBER_EMAIL=playwright-subscriber@your-test-domain.example
SUBSCRIBER_PASSWORD=replace-with-subscriber-password

ADMIN_EMAIL=playwright-admin@your-test-domain.example
ADMIN_PASSWORD=replace-with-admin-password
```

Also confirm this `.env` points to the same Supabase project configured in
`D:\Dev\Q\.env`. A common setup failure is creating users in one Supabase
project while the locally running Q app connects to another.

The browser test environment needs only the project URL and anonymous key.
Never add `SUPABASE_SERVICE_ROLE_KEY` to a `VITE_` variable or expose it to a
browser.

### 5.8 Add credentials to GitHub Actions

In the GitHub repository, open **Settings > Secrets and variables > Actions**.
Create these repository or protected test-environment secrets:

- `TEST_SUPABASE_URL`
- `TEST_SUPABASE_ANON_KEY`
- `TEST_FREE_USER_EMAIL`
- `TEST_FREE_USER_PASSWORD`
- `TEST_SUBSCRIBER_EMAIL`
- `TEST_SUBSCRIBER_PASSWORD`
- `TEST_ADMIN_EMAIL`
- `TEST_ADMIN_PASSWORD`

Use test-project values only. The supplied workflows map these secrets to the
environment-variable names expected by Playwright.

### 5.9 Verify each login manually

Start the parent Q app:

```powershell
Set-Location D:\Dev\Q
npm run dev
```

Open `http://127.0.0.1:3000/app` and sign in once with each account:

1. The free user should enter the normal Q app and have no admin access.
2. The subscriber should enter the Q app and show the seeded or sandbox-backed
   subscription state.
3. The administrator should be able to authenticate through the admin access
   flow and load protected admin data.

Sign out between accounts or use separate private browser windows so an old
Supabase session is not mistaken for a successful login.

Leave optional credentials blank only when you intentionally want the related
tests to be skipped.

## 6. Validate the suite before running browsers

Run the TypeScript check:

```powershell
npm run typecheck
```

Confirm Playwright can collect every test without starting the Q server:

```powershell
$env:PLAYWRIGHT_SKIP_WEBSERVER = '1'
npx playwright test --list
Remove-Item Env:PLAYWRIGHT_SKIP_WEBSERVER
```

## 7. Run the tests

The default configuration starts the parent Q app automatically by executing
`npm run dev --prefix ../..` from the test-suite directory.

Run the full browser matrix:

```powershell
npm test
```

Run only Chromium for faster local feedback:

```powershell
npx playwright test --project=chromium
```

Run the public smoke tests:

```powershell
npm run test:smoke -- --project=chromium
```

Run API tests:

```powershell
npm run test:api -- --project=chromium
```

Run an individual coverage category:

```powershell
npm run test:functional -- --project=chromium
npm run test:ui -- --project=chromium
npm run test:mobile -- --project=chromium
npm run test:accessibility -- --project=chromium
npm run test:security -- --project=chromium
npm run test:database -- --project=chromium
npm run test:seo -- --project=chromium
npm run test:billing -- --project=chromium
npm run test:ai -- --project=chromium
npm run test:performance -- --project=chromium
npm run test:regression -- --project=chromium
npm run test:uat -- --project=chromium
```

Run a directory or one file:

```powershell
npx playwright test tests/security --project=chromium
npx playwright test tests/auth/login.spec.ts --project=chromium
```

Run with a visible browser:

```powershell
npm run test:headed -- --project=chromium
```

Run Playwright's interactive UI:

```powershell
npm run test:runner-ui
```

## 8. Test an already running or deployed Q environment

To use an approved non-production app that is already running, set the target
URL, explicitly allow the remote target, and prevent Playwright from starting
the local parent server:

```powershell
$env:BASE_URL = 'https://test.example.com'
$env:ALLOW_REMOTE_TESTS = '1'
$env:PLAYWRIGHT_SKIP_WEBSERVER = '1'
npx playwright test --project=chromium
```

Remove the temporary PowerShell variables afterward:

```powershell
Remove-Item Env:BASE_URL
Remove-Item Env:ALLOW_REMOTE_TESTS
Remove-Item Env:PLAYWRIGHT_SKIP_WEBSERVER
```

The remote-target guard intentionally rejects every non-local URL unless
`ALLOW_REMOTE_TESTS=1` is set. Never set that variable for the live Vercel
domain. The parent repository's `.vercelignore` also excludes the entire
`site-tests/` directory from Vercel uploads while leaving it available in
GitHub.

## 9. Read test results

Terminal output shows each test result. Failed runs may also create:

- `playwright-report/` for the HTML report.
- `test-results/` for traces, screenshots, videos, and error context.

Open the latest HTML report with:

```powershell
npm run report
```

Open a trace directly with:

```powershell
npx playwright show-trace test-results\path-to-test\trace.zip
```

These output directories are ignored by Git.

## 10. CI setup

The workflow files in `.github/workflows` install Node.js dependencies,
install Playwright browsers, run the requested suite, and upload reports even
when tests fail.

Add test-only values as encrypted repository or environment secrets. Never put
Supabase service-role keys, account passwords, or PayPal secrets directly in a
workflow file.

## Selector maintenance

The manual release and exploratory catalogue is available at
[`manual-tests/MANUAL_TEST_SCENARIOS.md`](manual-tests/MANUAL_TEST_SCENARIOS.md).

The suite prefers accessible selectors such as labels, roles, and visible
names. Selectors using `data-testid` are placeholders where the parent Q app
does not yet expose a stable accessible selector. Add the matching test ID in
`D:\Dev\Q` or replace the placeholder when a stable application selector is
available.

## Troubleshooting

### Browser executable does not exist

Install the requested browser version:

```powershell
npx playwright install chromium
```

### The parent server does not start

Run it manually to see the application error:

```powershell
Set-Location D:\Dev\Q
npm run dev
```

Then open `http://127.0.0.1:3000`. Check the parent app's `.env` if API or
Supabase initialization fails.

### Port 3000 is already in use

Either stop the existing process or keep it running. Locally, Playwright uses
the existing server because `reuseExistingServer` is enabled outside CI.

### Authenticated tests are skipped

Populate the relevant account variables in the test suite's `.env`. Also
confirm the same Supabase test project is configured in the parent Q app.

### Supabase API tests are skipped

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, or their `SUPABASE_URL`
and `SUPABASE_ANON_KEY` equivalents, in the test-suite `.env`.

### A placeholder selector fails

Inspect the matching component under `D:\Dev\Q\src`, add a stable accessible
name or `data-testid`, and update the corresponding page object or spec.
