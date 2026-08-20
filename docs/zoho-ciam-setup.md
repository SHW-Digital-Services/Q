# Zoho Bigin CIAM Workflow

This app keeps Supabase Auth as the CIAM identity system and syncs consenting B2C users into Zoho Bigin as Contacts. Zoho Bigin is the customer-management layer, not the login provider.

The sync sends only basic account-management fields to Bigin:

- email
- first name and last name derived from the display name
- mobile phone if Supabase Auth has one
- `Q website` tag
- a short operational description

Sensitive profile context such as pronouns, identity notes, saved goals, journal entries, mood logs, and chat content is not sent to Bigin.

## 1. Create the Zoho Bigin Account

1. Create or open your Zoho Bigin organization.
2. Open `Settings > Customization > Modules and Fields > Contacts`.
3. Confirm the standard `Email`, `First Name`, `Last Name`, `Mobile`, `Tag`, and `Description` fields are visible.
4. Optional: create or allow the tag value `Q website`.

## 2. Create a Zoho Self Client

1. Go to the Zoho API Console.
2. Create a `Self Client`.
3. Copy the generated `Client ID` and `Client Secret`.
4. In `Generate Code`, request these scopes:

```text
ZohoBigin.modules.contacts.ALL,ZohoSearch.securesearch.READ
```

5. Set the code expiry to a short duration, create the code, and copy it immediately.
6. Exchange the code for tokens using the accounts domain for your Zoho data centre.

For UK/EU accounts:

```powershell
Invoke-RestMethod -Method Post -Uri "https://accounts.zoho.eu/oauth/v2/token?grant_type=authorization_code&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&redirect_uri=https://www.zoho.com&code=YOUR_CODE"
```

Keep the returned `refresh_token`. Access tokens expire; the Supabase Edge Function uses the refresh token to request fresh access tokens.

## 3. Configure Supabase Secrets

Generate a long random webhook secret, then set the Edge Function secrets:

```powershell
npx supabase secrets set ZOHO_CLIENT_ID="YOUR_CLIENT_ID"
npx supabase secrets set ZOHO_CLIENT_SECRET="YOUR_CLIENT_SECRET"
npx supabase secrets set ZOHO_REFRESH_TOKEN="YOUR_REFRESH_TOKEN"
npx supabase secrets set ZOHO_WEBHOOK_SECRET="YOUR_LONG_RANDOM_SECRET"
npx supabase secrets set ZOHO_ACCOUNTS_URL="https://accounts.zoho.eu"
npx supabase secrets set ZOHO_API_BASE_URL="https://www.zohoapis.eu/bigin/v2"
```

Use the matching Zoho accounts/API domains if your Zoho account is not in the EU data centre.

## 4. Deploy the Supabase Changes

Run the migration and deploy the Edge Function:

```powershell
npx supabase db push
npx supabase functions deploy zoho-crm-sync
```

The function name remains `zoho-crm-sync` so existing Supabase webhook URLs can stay stable.

## 5. Wire the Supabase Webhook

1. Open the Supabase project dashboard.
2. Go to `Database > Webhooks`.
3. Create or update a webhook for the `auth.users` table.
4. Enable `INSERT`, `UPDATE`, and `DELETE`.
5. Set method to `POST`.
6. Set the URL to:

```text
https://YOUR_PROJECT_REF.functions.supabase.co/zoho-crm-sync
```

7. Add headers:

```text
Content-Type: application/json
x-q-zoho-secret: YOUR_LONG_RANDOM_SECRET
```

8. Save the webhook.

## 6. Validate the Workflow

1. Create a test account in Q with `Create a basic Zoho Bigin contact record` checked.
2. Confirm a Contact appears in Zoho Bigin with the `Q website` tag.
3. Open the Q profile screen and change the preferred name.
4. Save the profile and confirm the Bigin Contact updates after the webhook runs.
5. Turn off `Sync basic contact to Zoho Bigin`, save again, and confirm the matching Bigin Contact is deleted or no longer present.
6. Delete the test Supabase Auth user and confirm the Bigin Contact is removed.

## Notes

- Leave `verify_jwt = false` for the Edge Function because the database webhook is not a signed-in browser user. The shared `x-q-zoho-secret` header is the access control.
- Do not place Zoho client secrets or refresh tokens in Vite variables. They must stay in Supabase Edge Function secrets only.
- Do not use Zoho Bigin to authorize app access. Supabase Auth and RLS still own identity, session, and user data isolation.
