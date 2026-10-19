# Microsoft 365 Communications

Q's CRM Communications portal uses Microsoft Graph for the shared `cs@q-ai.online` mailbox and each signed-in staff member's own inbox. Every request checks the current Q Staff/Admin role. Staff connect their own Microsoft 365 account from the mailbox selector; Q requires the Microsoft account email to match the Q staff account email. The shared mailbox is the only mailbox used for support-ticket sync and generic support email notifications.

The provider switch changes how Q accesses mail; it does not move old messages or change Microsoft 365 mail routing, domains, MX records, or mailbox configuration. Complete any historical mailbox migration and delivery/DNS work separately in Microsoft 365. Q's portal reads the mailbox currently selected in the Entra environment configuration.

## Data and security

Microsoft 365 is the mailbox system of record. Q relays mail through its backend over HTTPS. Message bodies, attachments, folders and drafts are not written to Supabase or application logs. The composer recovers unsent text in account-scoped browser session storage. Attachments uploaded for a message are held temporarily in server memory until the message is sent or the temporary proof expires; they are not persisted. Downloaded attachments are saved on the operator's device. Email HTML is sanitised before display; active content is removed.

The shared mailbox refresh token and cookie encryption key are kept in server hosting secrets. Per-staff access and refresh tokens are encrypted with AES-GCM and stored in HttpOnly, Secure, SameSite cookies bound to that Q staff member; mailbox content and tokens are not written to Supabase or application logs. The Microsoft delegated scopes used by Q are `User.Read`, `Mail.ReadWrite`, `Mail.Send`, `Mail.ReadWrite.Shared`, `Mail.Send.Shared`, and `offline_access`. Q requests no application-level mailbox access, tenant-wide mail-read permission, user provisioning, or permanent mail deletion permission. Microsoft 365 permissions and the signed-in user's own mailbox access remain required.

The live customer history and ticket sync resolve customer addresses from verified Supabase Auth accounts. They store limited metadata in the CRM (sender/recipient, subject, time, provider IDs and ticket links); bodies and attachments remain in Microsoft 365. Personal staff inboxes are excluded from ticket sync and customer history. Generic support notifications contain only a link and a short notice, not ticket subjects, replies, or internal notes.

## One-time Microsoft Entra setup

1. Create `cs@q-ai.online` as a shared mailbox and confirm it is provisioned. Assign a licensed staff member **Full Access** and **Send As** rights in Exchange admin center. Staff will connect their own inboxes separately from Communications. This setup does not change DNS or import Zoho history.
2. In the Microsoft Entra admin center, register a single-tenant application for the Q tenant. Under **Authentication**, enable **Allow public client flows** so Q can use device-code sign-in. Do not create a client secret for this device-code flow.
3. Under **API permissions > Microsoft Graph > Delegated permissions**, add `User.Read`, `Mail.ReadWrite`, `Mail.Send`, `Mail.ReadWrite.Shared`, and `Mail.Send.Shared`. `User.Read` lets Q verify the Microsoft account; `Mail.ReadWrite` and `Mail.Send` cover a user's own inbox; the `.Shared` scopes permit delegated access to CS only where the authorizing operator already has Exchange mailbox rights. Grant tenant consent if your organization requires admin approval.
4. Confirm the shared mailbox's Entra user principal name is `cs@q-ai.online`, which Q uses for the Graph mailbox lookup. If its UPN differs, Q's mailbox lookup configuration must be updated to use the actual UPN.
5. From the Q repository, authorize the shared mailbox:

   ```powershell
   powershell -NoProfile -File .\scripts\setup-microsoft365-mail.ps1 -Mailbox cs@q-ai.online -TenantId '<TENANT-GUID>'
   ```

   Follow the Microsoft device-code prompt using an account that can access and send as the shared mailbox. The helper copies the resulting refresh token to the clipboard; it does not print the token or write a token file.
6. Add these **server-only** settings in the Q hosting environment. Do not use a `VITE_` prefix:

   ```text
   M365_MAIL_CLIENT_ID=<Entra application client ID>
   M365_MAIL_TENANT_ID=<tenant GUID>
   M365_MAIL_MAILBOX_ID=cs@q-ai.online
   M365_MAIL_REFRESH_TOKEN=<shared mailbox authorization refresh token>
   M365_MAIL_COOKIE_KEY=<64 hexadecimal characters>
   APP_URL=<canonical HTTPS Q origin>
   ```

   The shared refresh token must belong to an operator with access to and Send As rights for the CS mailbox. Generate the cookie key with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Use the same cookie key on every app instance. Never paste refresh tokens into chat or commit them.
8. Apply the pending database migration `20261014152029_migrate_office_email_to_microsoft365.sql` to the linked Supabase project through the normal reviewed migration workflow. It permits Microsoft Graph opaque IDs in the existing private CRM email metadata function and labels new records as `microsoft365_office`; it does not migrate or rewrite mailbox content.
8. Deploy Q with the server settings and database migration. Open **CRM > Communications** as Staff/Admin. Confirm the shared mailbox is returned as `cs@q-ai.online`; read a message, search, open an attachment, save a draft, and send a test message to an address you control. Select **Connect my inbox**, approve Microsoft access using the same email as the Q staff account, and confirm the mailbox selector offers both CS and **My inbox** for that member.
9. Verify support notifications, customer history, and ticket sync against the deployed tenant. Check Outlook Sent Items after any timeout before retrying a send. Then remove obsolete `ZOHO_MAIL_*` settings from Q hosting and revoke Q's old Zoho Mail authorization. Keep Zoho Bigin's separate `ZOHO_*` integration settings if that integration is still in use.

## Microsoft Graph details

Q's backend calls Microsoft Graph v1.0 for folders, message lists/search, message bodies, attachments, drafts, send/reply, read status, archive and folder moves. The UI combines Inbox, Notification(s), and Newsletter(s) into one Inbox presentation while preserving each message's original folder ID. Provider folders are not changed by that combined view.

Q limits uploads to ten files of up to 3 MB each, attachment downloads to 20 MB and message content to 50,000 characters. Microsoft 365 limits, tenant policy, licensing, delegated mailbox rights and throttling also apply. Q does not automatically retry an ambiguous send; check Outlook Sent Items first.

Customer/ticket sync runs while the CRM is open, not as an unattended background job. It matches verified account addresses to shared-mailbox sender/recipient metadata. Inbox messages can create CRM tickets; matching inbound and sent messages are added to the customer’s 360 communications history. Drafts, templates, trash and junk are excluded. Sent Items are scanned for outbound history and do not create new support tickets. It never imports staff personal inboxes. Historical Zoho messages are not copied automatically; use Microsoft's supported mailbox migration process if that history is required in Microsoft 365.

Local source checks do not verify the tenant app, deployed secrets, real mailbox permissions, delivered messages, or production rendering. Complete the live checks in step 9 after deployment.
