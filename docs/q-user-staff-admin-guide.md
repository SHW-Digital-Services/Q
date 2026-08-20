# Q Intelligence User, Staff, and Admin Guide

This guide explains how Q Intelligence is operated by three audiences:

- site users: people using Q for chat, guides, journaling, profile, security, backup, and subscription features
- staff: support or operational users who manage customer records and password support without Supabase access
- admins/owners: technical or business owners who configure Supabase, Zoho Bigin, access controls, billing, deployment, and incidents

## Core Operating Model

Q Intelligence separates identity, customer management, and private in-app content.

| Area | System of record | Who should access it |
| --- | --- | --- |
| Login, passwords, sessions, user IDs | Supabase Auth | app backend and owner/admin only |
| Staff admin permissions | Supabase `public.profiles.role` | owner/admin only |
| User support and password reset operations | Q website admin panel | authorised staff and admins |
| B2C/customer relationship records | Zoho Bigin Contacts | staff and admins |
| Journal, mood, chat, memory, guides | Q app and Supabase user-owned tables/local storage | the signed-in user |
| Billing subscriptions | PayPal integration | users for checkout, admins for configuration |
| Secrets and service keys | hosting provider and Supabase secrets | owner/admin only |

Staff should not access Supabase. Staff use the Q website admin panel and Zoho Bigin.

## Privacy Rules For Everyone

Q is a sensitive product. Treat user information with the highest practical care.

1. Never store a user's password, temporary password, reset link, journal content, chat content, mood logs, identity notes, saved goals, or sensitive support details in Zoho.
2. Never ask a user to send a password in plain text.
3. Never share Supabase dashboard access with routine support staff.
4. Never share `SUPABASE_SERVICE_ROLE_KEY`, Zoho client secrets, Zoho refresh tokens, PayPal secrets, or AI provider keys with staff.
5. Use Zoho Bigin for customer relationship notes only: contact status, follow-up tasks, owner, safe contact preferences, and non-sensitive operational notes.
6. Use the Q website admin panel for password support.
7. Use Supabase only for owner/admin technical administration.
8. If a user reports risk of harm, follow the crisis-support process rather than treating the issue as a normal support ticket.

## What Data Syncs To Zoho Bigin

When a user consents to CRM sync, Q sends a basic Contact record to Zoho Bigin.

Data sent to Zoho Bigin:

- email address
- first name and last name derived from display name
- mobile phone if available in Supabase Auth
- `Q website` tag
- short operational description, such as source, privacy level, CRM sync consent, and profile update time

Data not sent to Zoho Bigin:

- pronouns
- identity notes
- saved goals
- journal entries
- mood logs
- chat messages
- memory entries
- crisis/support-sensitive details
- passwords, temporary passwords, or recovery links

Users can turn off `Sync basic contact to Zoho Bigin` in their profile. When they do, the sync function attempts to remove the matching Bigin Contact.

# Site User Guide

This section is for people using the Q website.

## Creating An Account

1. Open the Q website.
2. Choose `Create Account`.
3. Enter an email address.
4. Enter a password.
5. Optionally enter a full name or display alias.
6. Choose whether to enable `Create a basic Zoho Bigin contact record for account support and service updates`.
7. Submit the form.
8. If email confirmation is enabled, check your email and confirm the account.
9. Sign in when prompted.

The Zoho Bigin checkbox only controls whether Q creates a basic customer-support record. It does not give Zoho Bigin access to private journal, chat, mood, or identity-note content.

## Signing In

1. Open the Q website.
2. Choose `Sign In`.
3. Enter the email address and password.
4. Submit the form.
5. Wait for the secure session to load.

If sign-in fails:

- check the email spelling
- check the password
- request a password reset if needed
- contact support if the account may not have been verified

## Forgotten Password

1. Open the sign-in screen.
2. Choose `Forgot password?`.
3. Enter the account email address.
4. Add a short message if useful.
5. Submit the request.
6. Staff will review the request through the Q admin panel.
7. Staff may provide a temporary password or a recovery link through the support channel.
8. Sign in and immediately change the password from the profile screen.

Do not send your current password to staff. Staff do not need it.

## Changing Your Password While Signed In

1. Sign in to Q.
2. Open `Profile`.
3. Go to `Change password`.
4. Enter the new password.
5. Confirm the new password.
6. Submit `Update password`.
7. Sign out and sign back in if requested.

Use a unique password that is not used on other websites.

## Updating Profile Context

1. Sign in.
2. Open `Profile`.
3. Update preferred name, pronouns, location/region, life stage, identity notes, and goals as desired.
4. Choose whether `Allow Q context memory` is enabled.
5. Choose whether `Sync basic contact to Zoho Bigin` is enabled.
6. Choose `Save profile`.

Profile context is used to make Q more useful. Sensitive profile details should not be stored in Zoho Bigin.

## Q Context Memory

`Allow Q context memory` controls whether Q can use the saved profile context for a more tailored experience.

When enabled:

- Q can use saved profile context while responding.
- The app can remember selected user preferences and goals.

When disabled:

- Q should use less personal context.
- The user can still use the app, but responses may be less tailored.

## Zoho Bigin Contact Sync Consent

`Sync basic contact to Zoho Bigin` controls whether Q creates or updates a basic customer record in Zoho Bigin.

When enabled:

- Q can create/update a Bigin Contact using basic account information.
- Staff can find the user in Zoho Bigin by email for customer support and follow-up.

When disabled:

- Q attempts to remove the matching Bigin Contact.
- Staff should not create a new Zoho Bigin record unless there is another lawful and documented reason.

## Using Q Chat

1. Sign in.
2. Open the chat area.
3. Ask Q for support, guidance, planning help, or general information.
4. Avoid sharing information you do not want stored or processed.
5. Use crisis support resources if there is immediate risk of harm.

Q is not a replacement for emergency services, professional medical care, legal advice, or regulated financial advice.

## Life Guides

1. Open `Guides`.
2. Choose a guide relevant to the situation.
3. Work through the checklist items.
4. Mark steps complete as progress is made.
5. Save or revisit guides as needed.

## Lived Experiences

1. Open `Stories` or the lived-experiences area.
2. Read relevant user-style stories and takeaways.
3. Save useful stories for later if the feature is available.

Do not treat lived experiences as professional advice. They are practical perspectives.

## Journal And Mood Tracking

1. Open `Journal` or mood tracking.
2. Create a private entry or mood log.
3. Save the entry.
4. Delete entries when no longer wanted, where the app provides that control.

Journal and mood content must not be copied into Zoho Bigin by staff.

## Backup And Restore

1. Open `Profile`.
2. Choose `Backup and restore`.
3. Export a backup JSON file if needed.
4. Store the backup somewhere private and secure.
5. Use import only with a backup file you trust.

Backup files may contain sensitive personal content.

## Security Settings

1. Open `Profile`.
2. Choose `Security settings`.
3. Configure app lock or PIN options where available.
4. Keep any PIN private.

Security settings protect local app access but do not replace account password security.

## Subscription

1. Open `Subscription`.
2. Choose the desired plan.
3. Complete PayPal checkout.
4. Return to Q.
5. Confirm the subscription status updates.

Billing issues should be handled through the support channel and payment-provider records.

## Crisis Support

If there is immediate danger, use emergency services in the user's location. Q may show crisis-support links, but it is not an emergency response system.

Users should use crisis resources when:

- they may harm themselves or someone else
- they are in immediate physical danger
- they need urgent crisis counselling
- they are experiencing abuse, coercion, or imminent risk

# Staff Guide

This section is for non-technical staff who manage customer records and user support.

## Staff Access Boundaries

Staff can:

- sign in to the Q website admin panel
- view password reset requests
- issue temporary passwords or recovery links
- manage user/customer records in Zoho Bigin
- add safe, non-sensitive customer notes in Zoho Bigin
- create follow-up tasks and reminders in Zoho Bigin

Staff must not:

- access Supabase dashboard
- access service-role keys
- access database tables directly
- store passwords or reset links in Zoho Bigin
- store sensitive user content in Zoho Bigin
- ask users for their current password
- change technical configuration

## Staff Sign-in To The Admin Panel

1. Open the Q website.
2. Open the admin access control on the landing page.
3. Enter the authorised staff email.
4. Enter the staff password.
5. Submit.
6. The backend checks whether the staff account has `profiles.role = 'partner_admin'`.
7. If authorised, the admin panel opens.

If access is denied:

- confirm the staff account email is correct
- ask an owner/admin to check the staff role
- do not request Supabase access as a workaround

## Handling A Password Reset Request

1. Open the Q website admin panel.
2. Go to `Password reset requests`.
3. Review the user's email and message.
4. Check Zoho Bigin for the user by email if customer context is needed.
5. Click `Reset password`.
6. Copy the temporary password or recovery link.
7. Send it to the user using the approved support channel.
8. Tell the user to sign in and change the password immediately.
9. Do not paste the temporary password or recovery link into Zoho Bigin notes.

Suggested user message:

```text
Your Q account password has been reset. Please sign in using the temporary password provided through this secure support channel, then open Profile > Change password and set a new private password immediately.
```

## Direct Password Reset

Use direct reset when a user contacts support but did not submit the in-app request.

1. Open the Q website admin panel.
2. Go to `Direct password reset`.
3. Enter the user's email address.
4. Click `Issue temp password`.
5. If the email exists, the app returns a temporary password and may return a recovery link.
6. Send the user the reset details through the approved support channel.
7. Ask the user to change the password immediately after signing in.

If the email is not found:

1. Check spelling.
2. Search Zoho Bigin by email.
3. Ask the user to confirm the email they used to register.
4. Do not create a new account without the user's instruction.

## Managing Users In Zoho Bigin

Zoho Bigin is used for customer management, not login management.

1. Open Zoho Bigin.
2. Go to `Contacts`.
3. Search by the user's email.
4. Open the Contact.
5. Update appropriate fields:
   - contact status
   - owner
   - safe contact preference
   - support category
   - follow-up date
   - non-sensitive notes
6. Create tasks for follow-up where useful.
7. Close or update tasks after action is complete.

Appropriate Zoho Bigin note examples:

```text
User requested password support. Temporary reset issued through approved support channel. User advised to change password after login.
```

```text
User asked about subscription status. Follow-up scheduled after payment-provider check.
```

Inappropriate Zoho Bigin note examples:

```text
Temporary password is Example123.
```

```text
User shared journal content about...
```

```text
User's identity notes/goals are...
```

## Zoho Bigin Contact Status Guidance

Use a simple status model unless the owner/admin configures a different one.

Suggested statuses:

- `New`: synced from Q or newly created
- `Contacted`: staff have responded
- `Support in progress`: waiting on action
- `Resolved`: issue handled
- `Do not contact`: user opted out or contact is not appropriate

## Handling CRM Sync Opt-out

If a user turns off `Sync basic contact to Zoho Bigin`, the app attempts to remove their matching Bigin Contact.

If staff see a user who has opted out:

1. Do not recreate the Contact for normal support.
2. Do not add marketing or follow-up tasks.
3. Ask an admin before retaining any record.
4. Keep only records required for legal, billing, fraud-prevention, or safety reasons.

## Account Closure Or Deletion Requests

When a user asks to close/delete an account:

1. Confirm the request came from the account email or an approved verification route.
2. Do not delete anything from Supabase yourself.
3. Escalate to an owner/admin.
4. Update Zoho Bigin with a non-sensitive note, for example:

```text
Account closure request received and escalated to owner/admin for identity-data handling.
```

5. Set follow-up task if needed.

## Subscription Support

For billing issues:

1. Search the user in Zoho Bigin by email.
2. Ask the user for non-sensitive billing context, such as approximate payment date and plan.
3. Do not ask for card details or PayPal password.
4. Escalate payment-provider checks to an admin if staff do not have billing access.
5. Record only non-sensitive support notes in Zoho Bigin.

## Crisis Or Safety Escalation

If a user indicates immediate danger:

1. Encourage them to contact emergency services in their location.
2. Point them to the crisis support resources visible in Q.
3. Keep responses brief, direct, and safety-focused.
4. Do not diagnose or promise emergency intervention.
5. Escalate internally according to the organization's safeguarding process.
6. Record only the minimum necessary operational note in Zoho Bigin.

## Staff Security Rules

1. Use a unique password for the staff Q account.
2. Do not share staff login details.
3. Lock the computer when away.
4. Do not download user data unless explicitly authorised.
5. Do not export Zoho Bigin data casually.
6. Report suspected account compromise immediately.
7. Do not bypass the Q admin panel by requesting Supabase access.

# Admin And Owner Guide

This section is for technical owners and administrators.

## Admin Responsibilities

Admins/owners are responsible for:

- Supabase project configuration
- Supabase migrations
- Supabase Edge Function deployment
- service-role key handling
- staff account creation and removal
- Zoho Bigin OAuth client setup
- Zoho Bigin webhook secret setup
- PayPal billing configuration
- deployment environment variables
- incident response
- audit and legal-data handling

## Creating A Staff Admin

1. Create the staff user's Q account.
2. Confirm the account exists in Supabase Auth.
3. Run this SQL in Supabase SQL editor:

```sql
update public.profiles
set role = 'partner_admin'
where id = (
  select id
  from auth.users
  where email = 'staff@example.com'
);
```

4. Ask the staff member to sign in through the Q admin panel.
5. Confirm they can open the panel.
6. Confirm they cannot access Supabase dashboard.

## Removing Staff Access

1. Run:

```sql
update public.profiles
set role = 'user'
where id = (
  select id
  from auth.users
  where email = 'staff@example.com'
);
```

2. If the staff member is leaving the organization, disable or delete their Supabase Auth account.
3. Remove their Zoho Bigin user access.
4. Rotate shared operational passwords if any existed.
5. Review recent support activity if there is risk.

## Why Staff Must Not Use Supabase

Supabase contains:

- authentication records
- protected user IDs
- service-level API controls
- private user-owned data tables
- security policies
- integrations and secrets

Routine staff work does not require this access. Giving staff Supabase access increases the risk of accidental data exposure, unsafe password handling, and configuration damage.

## Required Environment Variables

Set app/server variables in the hosting environment:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VITE_APP_ACCESS_ENABLED=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENV=
PAYPAL_PLAN_ID_MONTHLY=
PAYPAL_PLAN_ID_YEARLY=
PAYPAL_WEBHOOK_ID=
```

Set Supabase Edge Function secrets:

```text
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=
ZOHO_WEBHOOK_SECRET=
ZOHO_ACCOUNTS_URL=https://accounts.zoho.eu
ZOHO_API_BASE_URL=https://www.zohoapis.eu/bigin/v2
```

Do not expose server-only values as Vite variables. Anything prefixed with `VITE_` can be bundled into the browser.

## Zoho Bigin Setup Summary

Use Zoho Bigin for B2C customer records. It should not be the identity provider.

1. Create or keep a Zoho Bigin organization.
2. Confirm the `Contacts` module is enabled.
3. Confirm these fields exist:
   - `Email`
   - `First Name`
   - `Last Name`
   - `Mobile`
   - `Tag`
   - `Description`
4. Add or allow `Q website` as a tag value if needed.
5. Create a Zoho API Console `Self Client`.
6. Generate an auth code with:

```text
ZohoBigin.modules.contacts.ALL,ZohoSearch.securesearch.READ
```

7. Exchange it for a refresh token.
8. Store Zoho credentials as Supabase Edge Function secrets.

Full setup is in `docs/zoho-ciam-setup.md`.

## Supabase Webhook To Zoho Bigin

The webhook connects Supabase Auth user changes to Zoho Bigin Contact sync.

1. Deploy the migration:

```powershell
npx supabase db push
```

2. Deploy the function:

```powershell
npx supabase functions deploy zoho-crm-sync
```

3. In Supabase dashboard, open `Database > Webhooks`.
4. Create a webhook on `auth.users`.
5. Enable:
   - `INSERT`
   - `UPDATE`
   - `DELETE`
6. Method: `POST`
7. URL:

```text
https://YOUR_PROJECT_REF.functions.supabase.co/zoho-crm-sync
```

8. Headers:

```text
Content-Type: application/json
x-q-zoho-secret: YOUR_LONG_RANDOM_SECRET
```

The Edge Function has `verify_jwt = false` because it is called by a database webhook, not by a logged-in browser user. The shared webhook header controls access.

## Password Reset Architecture

Password resets are done from the Q website admin panel.

Technical flow:

1. Staff sign in with Supabase Auth through the Q website.
2. The browser sends the Supabase access token to `/api/v1/admin/me`.
3. The backend validates the user token.
4. The backend uses the service-role client to check `public.profiles.role`.
5. Only `partner_admin` users can access admin operations.
6. The backend uses `SUPABASE_SERVICE_ROLE_KEY` server-side to call Supabase Admin Auth methods.
7. Temporary passwords and recovery links are returned to the staff screen.
8. Staff communicate the reset details through the approved support channel.

The service-role key is never sent to the browser.

## Deployment Checks

Run these before deployment:

```powershell
npm run lint
npm run build
git diff --check
```

Expected result:

- TypeScript passes
- production build passes
- no trailing whitespace or conflict markers

The Vite build may warn about large chunks. That is not the same as a failed build.

## Testing Staff Password Reset

1. Create a normal test user.
2. Create a staff user.
3. Set the staff user role to `partner_admin`.
4. Sign in as staff through the Q admin panel.
5. Use `Direct password reset` for the test user.
6. Confirm a temporary password is returned.
7. Sign out.
8. Sign in as the test user with the temporary password.
9. Change the test user's password in `Profile`.
10. Confirm the old password no longer works.

## Testing Zoho Bigin Sync

1. Create a test user with CRM sync consent enabled.
2. Confirm the Bigin Contact appears.
3. Update preferred name in Q profile.
4. Confirm the Bigin Contact updates.
5. Disable `Sync basic contact to Zoho Bigin`.
6. Confirm the Contact is deleted or no longer present.
7. Delete the test user from Supabase Auth as an owner/admin.
8. Confirm no stale Bigin Contact remains.

## Incident Response

Use this when something goes wrong.

### Staff account compromised

1. Disable the staff account.
2. Change `profiles.role` to `user`.
3. Remove Zoho access.
4. Review recent password resets.
5. Rotate any exposed support-channel credentials.
6. Notify affected users if required.

### Supabase service-role key exposed

1. Rotate the service-role key in Supabase.
2. Update hosting environment variables.
3. Redeploy/restart the app.
4. Review logs for unusual admin actions.
5. Treat this as a high-severity incident.

### Zoho refresh token exposed

1. Revoke the Zoho OAuth client/token.
2. Generate a new refresh token.
3. Update Supabase Edge Function secrets.
4. Redeploy the function if needed.
5. Review Zoho Bigin audit/activity records.

### Webhook secret exposed

1. Generate a new `ZOHO_WEBHOOK_SECRET`.
2. Update Supabase Edge Function secret.
3. Update the Supabase database webhook header.
4. Test with a new user update.

### User says their data is wrong in Zoho Bigin

1. Search Zoho Bigin by email.
2. Compare only basic contact details.
3. Ask the user to update their Q profile if the source data is wrong.
4. Save the Q profile.
5. Confirm the Bigin Contact updates.
6. Avoid manually adding sensitive data in Zoho Bigin.

## Routine Maintenance

Weekly:

- review staff access
- check failed password reset reports
- check Zoho Bigin sync health with one test update
- review deployment logs for repeated admin errors

Monthly:

- review who has Zoho Bigin access
- review who has Supabase access
- rotate shared operational passwords if any exist
- check legal processor documentation remains accurate
- test password reset end to end

After staff changes:

- remove staff Q admin role
- remove Zoho Bigin access
- confirm no Supabase access exists
- rotate support-channel credentials if needed

## Quick Reference

For users:

- Passwords are managed in Q/Supabase Auth.
- Zoho Bigin is only for basic customer support records.
- Private journal/chat/mood content is not sent to Zoho Bigin.

For staff:

- Use Q website admin panel for password resets.
- Use Zoho Bigin for customer follow-up.
- Do not use Supabase.
- Do not store passwords or sensitive content in Zoho Bigin.

For admins:

- Keep Supabase and secrets owner-only.
- Grant staff access with `profiles.role = 'partner_admin'`.
- Keep Zoho Bigin credentials in Edge Function secrets.
- Verify migrations, function deploys, and webhooks after changes.
