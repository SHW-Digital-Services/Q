# Microsoft SAML sign-in for the CRM

Microsoft SSO is offered only on the CRM access page. It returns to `/crm`; public-site sign-in is unchanged, and email/password sign-in remains available.

## Access control and account provisioning

The CRM checks `GET /api/v1/admin/me`, and only `staff` or `partner_admin` profiles are admitted. On that server-side check, a user is automatically assigned `staff` when all of these are true: Supabase confirms the email, the email ends in `@q-ai.online`, and the authenticated identity belongs to the configured Q Microsoft SAML provider (`93a0e3f6-6e12-43bc-a682-8e65d7405611`). This does not grant staff to password, Google, or other SSO sign-ins based only on their email address. Role promotions are recorded in `security_events`.

Existing `staff` and `partner_admin` roles are preserved. An eligible `user` or `beta_tester` account is promoted to `staff`; the flow never assigns `partner_admin`. Other accounts still need an explicit role assignment through the existing Admin role-management workflow.

Supabase SAML creates a separate Auth user from an existing password or OAuth account even when the email matches. Do not assume identity linking or profile UUID continuity. An eligible SSO identity receives the role on its own UUID; any pre-existing password or OAuth account and its role are left unchanged.

## Supabase setup

1. In Supabase Auth Providers, enable **SAML 2.0** for project `brnhalxydcakutxiregp`.
2. Register the Entra identity provider using the **Entra App Federation Metadata URL** from the `Q-Intelligence-SSO` enterprise application's SAML Signing Certificate section:

   ```text
   https://login.microsoftonline.com/51ca04ab-672a-4491-a110-0c69c41441fd/federationmetadata/2007-06/federationmetadata.xml?appid=43047eba-c55c-419a-98ba-c749001dbcbf
   ```

   The configured SSO lookup domain in the CRM code is `q-ai.online`. The role auto-assignment is intentionally limited to the Q provider ID above and this domain.

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

The CRM button calls Supabase `signInWithSSO` for `q-ai.online`. Verify the Supabase provider connection and redirect allowlist, then test with an eligible `@q-ai.online` SAML identity, a non-Q-domain identity, and password/Google sign-in for a Q-domain address. Only the eligible Microsoft SAML identity should be auto-assigned `staff`; an existing Admin remains `partner_admin`.
