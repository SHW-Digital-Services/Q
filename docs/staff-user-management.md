# Staff User Management

Staff should not need Supabase dashboard access. Supabase remains the identity database, but staff user operations happen through the Q admin panel.

## Owner-only Setup

The owner or technical admin does this once.

1. Create the staff user in the Q app using the normal sign-up flow, or invite them through Supabase Auth.
2. Mark the staff user as an app admin in the protected `profiles` table:

```sql
update public.profiles
set role = 'partner_admin'
where id = (
  select id
  from auth.users
  where email = 'staff@example.com'
);
```

3. Confirm the server environment has `SUPABASE_SERVICE_ROLE_KEY` set.
4. Do not give staff the Supabase service-role key.
5. Do not give staff direct Supabase dashboard access unless they are technical owners.

## Staff Password Reset Flow

1. Open the Q site.
2. Open the hidden/admin access button on the landing page.
3. Sign in with the staff account.
4. In `Direct password reset`, enter the user's email address.
5. Click `Issue temp password`.
6. Give the temporary password or recovery link to the user using your normal secure support channel.
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
5. Do not store Q passwords, temporary passwords, recovery links, journal content, chat content, mood logs, identity notes, or sensitive support details in Zoho.

## Access Model

- Q login/session/passwords: Supabase Auth
- Staff admin permissions: `public.profiles.role = 'partner_admin'`
- Staff operational screen: Q admin panel
- Customer relationship management: Zoho Bigin Contacts
- Owner-only technical access: Supabase dashboard and service-role key
