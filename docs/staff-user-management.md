# Staff User Management

Staff should not need Supabase dashboard access. Supabase remains the identity database, but staff user operations happen through the Q admin panel.

## Owner-only Setup

The owner or technical admin does this once.

1. Create the staff user in the Q app using the normal sign-up flow, or invite them through Supabase Auth.
2. Assign the Staff role in the protected `profiles` table. Use `partner_admin` only for an operator who should have Admin-only controls:

```sql
update public.profiles
set role = 'staff'
where id = (
  select id
  from auth.users
  where email = 'staff@example.com'
);
```

3. Confirm the server environment has `SUPABASE_SERVICE_ROLE_KEY` set.
4. Do not give staff the Supabase service-role key.
5. Do not give staff direct Supabase dashboard access unless they are technical owners.

Staff and Admins can connect their own Zoho mailbox through **Communications** in the CRM. Mailbox content is not saved to Supabase. Follow [Zoho setup](zoho-mail-comms.md). Only Admins see **Admin Only**; this page groups publishing, launch settings, webhook receiving and user deletion. Open a customer record there to delete a non-Admin account with exact-email confirmation. Subscriptions must be resolved first, and deletion does not cancel PayPal payments or erase Zoho mail. See [Admin functions](admin-functions.md).

## Staff Password Reset Flow

1. Open the Q site.
2. Open the hidden/admin access button on the landing page.
3. Sign in with the staff account.
4. In `Send account recovery`, enter the user's email address.
5. Click `Send recovery email`.
6. Tell the user to use the single-use link delivered directly to their email address. Staff must never ask for or handle the resulting password.
7. Ask the user to sign in and immediately change their password from their profile screen.

## Staff CRM Flow

1. Open Zoho Bigin.
2. Go to `Contacts`.
3. Search by the user's email address.
4. Manage the customer relationship details there, such as:
   - lead status
   - notes
   - tasks
   - follow-up reminders
   - owner
5. Do not store Q passwords, recovery links, journal content, chat content, mood logs, identity notes, or sensitive support details in CRM records.

## Access Model

- Q login/session/passwords: Supabase Auth
- Staff admin permissions: `public.profiles.role = 'partner_admin'`
- Staff operational screen: Q admin panel
- Customer relationship management: Zoho Bigin Contacts
- Owner-only technical access: Supabase dashboard and service-role key

## 29 September 2026: News, Help Videos and site preview

Staff and Admin may use Preview Site after signing in again with the same CRM account. The live/waitlist switch and Help Video management remain Admin-only. Previewing does not change public launch status.
