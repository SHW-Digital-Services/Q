# Microsoft SAML sign-in for the CRM

Microsoft SSO is offered only on the CRM access page. It returns to `/crm`; public-site sign-in is unchanged, and email/password sign-in remains available.

## Access control and account provisioning

SAML authentication does not grant CRM access. The CRM still checks `GET /api/v1/admin/me`, and only an existing `staff` or `partner_admin` profile is admitted. New Supabase SAML users receive the normal default `user` role. An existing Admin must explicitly assign the appropriate CRM role to the SSO account before it can enter. Do not promote accounts automatically based on email or SAML claims.

Supabase SAML creates a separate Auth user from an existing password or OAuth account even when the email matches. Do not assume identity linking or profile UUID continuity. Preserve existing staff roles and records; explicitly provision the new SSO UUID through the existing Admin role-management workflow.

## Supabase setup

1. In Supabase Auth Providers, enable **SAML 2.0** for project `brnhalxydcakutxiregp`.
2. Register the Entra identity provider using the **Entra App Federation Metadata URL** from the `Q-Intelligence-SSO` enterprise application's SAML Signing Certificate section:

   ```text
   https://login.microsoftonline.com/51ca04ab-672a-4491-a110-0c69c41441fd/federationmetadata/2007-06/federationmetadata.xml?appid=43047eba-c55c-419a-98ba-c749001dbcbf
   ```

   The configured SSO lookup domain in the CRM code is `q-ai.online`. Include any additional staff sign-in domains when registering the provider if they need to initiate SSO too.

3. Allow these redirect URLs in Supabase Auth URL Configuration:

   ```text
   https://q-ai.online/crm
   https://www.q-ai.online/crm
   http://localhost:5173/crm
   ```

   Keep only production hosts that Q actually serves and the local URL needed for development.

## Entra SAML settings

The `Q-Intelligence-SSO` enterprise application should use:

```text
Identifier (Entity ID): https://brnhalxydcakutxiregp.supabase.co/auth/v1/sso/saml/metadata
Reply URL (ACS):        https://brnhalxydcakutxiregp.supabase.co/auth/v1/sso/saml/acs
```

The email claim must be present in the assertion. Entra's current `emailaddress` claim uses `user.mail`; verify that it is populated for assigned users. The signing certificate is active. Assertion encryption is not required unless both sides are configured for it.

## Verification boundaries

The CRM button calls Supabase `signInWithSSO` for `q-ai.online`. The Supabase provider connection, redirect allowlist, deployed frontend, and each SSO user's explicit CRM role still need to be configured and checked. Test with an existing Admin, an existing staff account, and a normal user; normal users must remain denied.
