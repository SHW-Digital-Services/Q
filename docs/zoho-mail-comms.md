# Zoho Mail communications portal

Staff and Admins open **Communications** from `/crm` (the portal is `/crm/comms`). Each Q account authorises its own Zoho account. The portal supports mailbox selection, folders, paging, Zoho search, reading, compose, Cc/Bcc, replies, attachments, marking read/unread, archive and moving mail. An explicit **Save new draft in Zoho** action creates a new Zoho draft. Existing drafts can be read in Q; continue editing them in Zoho. Reply drafts remain open in Q until sent. Q does not automatically send emails or monitor incoming mail in the background.

## Data handling

Zoho is the mailbox system of record. Q relays requests over HTTPS through its backend to keep OAuth credentials private. Email bodies, subjects, recipients, folders, attachments, search terms, personalised template previews and drafts are **not written to Supabase, Q object storage, browser local/session storage or application logs** by this portal. Request and response content exists temporarily in server/browser memory while used. Downloading an attachment intentionally saves a copy on the operator's device.

Supabase still authenticates the Q account and supplies the current Staff/Admin role. The existing global rate limiter stores technical counters, without email content or search terms. Existing CRM contact-request/communication records and Brevo event records are separate features; the Zoho portal neither imports mail into them nor logs send activity there.

OAuth access/refresh tokens are AES-256-GCM encrypted into an HttpOnly, SameSite=Lax cookie (`q_zoho_mail`, path `/api/comms`, up to eight hours). A separate encrypted state cookie (`q_zoho_state`) expires after ten minutes. Both use Secure on the configured HTTPS origin. Sessions are bound to a Q user ID, and every mail API operation rechecks the current Q role. Tokens are never returned to page JavaScript or stored in Supabase. The same cookie key must be available on every server instance; rotating it invalidates connections. Disconnect clears the cookies and attempts Zoho token revocation. Q logout attempts the same before signing out. If revocation fails, remove Q under Zoho's connected applications. Close the page or sign out on shared devices. No email retention scheduler is needed in Q for this portal; Zoho retention is governed by the mailbox configuration.

Mail HTML is sanitised with DOMPurify using a small formatting-only allowlist. Scripts, forms, styles, links, remote images and active elements are removed. Attachments are delivered as downloads, never served inline. Open Zoho Mail for the original formatting and links.

## Register the Zoho application

1. Confirm the Zoho data centre for the mailboxes. `q-ai.online` currently uses Zoho EU MX records; the default region is `eu`. DNS does not need to change for this portal.
2. Sign into the [EU Zoho API Console](https://api-console.zoho.eu/) as the operator and create a **Server-based Application** named Q Communications.
3. Set its homepage to Q's canonical public origin, for example `https://www.q-ai.online`.
4. Register the exact redirect URI `<APP_URL>/api/comms/oauth/callback`, for example `https://www.q-ai.online/api/comms/oauth/callback`. The hostname must match `APP_URL` and the URL used to open Q. Register `http://localhost:3000/api/comms/oauth/callback` separately for local development if permitted by the console.
5. Configure server environment variables `ZOHO_MAIL_CLIENT_ID`, `ZOHO_MAIL_CLIENT_SECRET`, `ZOHO_MAIL_REGION=eu`, and `ZOHO_MAIL_COOKIE_KEY`. Generate the cookie key with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Put the result in the hosting secrets manager; do not commit it, paste it in chat, or prefix these variables with `VITE_`.
6. Deploy/restart Q. The portal then offers **Connect Zoho Mail**. Each Staff/Admin signs into their own Zoho account and accepts the requested permissions. Q does not need a shared mailbox password.
7. Verify one account can list folders, read a test email, send to an address you control, reply, save a new draft and use an attachment. Repeat with Staff and Admin, and confirm a normal site user receives 403. These are setup checks, not actions performed automatically by the implementation.

Scopes: `ZohoMail.accounts.READ`, `ZohoMail.folders.READ`, `ZohoMail.messages.READ`, `ZohoMail.messages.CREATE`, `ZohoMail.messages.UPDATE`. No organisation-wide administration, user provisioning or permanent mail deletion scope is requested. Region settings select fixed Zoho hosts; callback query parameters cannot select an arbitrary token/API server.

The five-user Forever Free package excludes IMAP/POP/ActiveSync; this integration uses Zoho's REST API. Public documentation does not establish that every mail API action is enabled for every free-plan account. Test your account after registration. A Zoho denial is shown in Q rather than silently switching to another mail service. Provider limits still apply. Q limits uploads to ten files of 3 MB each, downloads to 20 MB and messages to 50,000 characters; use Zoho directly for larger items. Q never automatically retries a send after a timeout or ambiguous failure: check Zoho Sent before retrying.

## Email templates

**Email templates** contains 30 generic starters in six categories: Support, Account access, Using Q, Subscriptions, Community and Updates. Copy follows the brand guide: welcoming, clear, affirming, protective, non-presumptive and non-pushy. Staff fill the labelled placeholders, choose **Use template**, then edit the subject/message and enter recipients. Sending requires a confirmation and rejects unresolved `{{placeholders}}` on the server too. Templates do not trigger campaigns or imply marketing consent. Check permission, facts, links, dates, subscription details and the intended audience before sending. Generic template copy is shipped in `src/data/emailTemplates.ts`; personalised content remains in memory until explicitly sent or saved to Zoho.

## API surface

All paths are under `/api/comms`. Except the state-bound OAuth callback, every route requires a valid Q bearer session and a current Staff/Admin role. Responses use `Cache-Control: no-store, private`. Mail routes do not receive a database client for content writes.

| Method/path | Purpose |
| --- | --- |
| GET `/status` | Configuration/connection status, never tokens |
| POST `/oauth/start` | Returns Zoho consent URL and sets state cookie |
| GET `/oauth/callback` | Exchanges authorised code server-side, returns to portal |
| POST `/disconnect` | Clears mail cookies and attempts revocation |
| GET `/accounts` | Connected user's mailboxes |
| GET `/accounts/:account/folders` | Folder list |
| GET `/accounts/:account/messages?folder=…&start=1&search=…` | 30-message pages; search uses Zoho syntax |
| GET `/accounts/:account/folders/:folder/messages/:message` | Content and attachment metadata |
| GET `/accounts/:account/folders/:folder/messages/:message/attachments/:attachment` | Download bytes |
| POST `/accounts/:account/attachments?name=…` | Raw binary upload to Zoho; returns encrypted ownership-bound reference |
| POST `/accounts/:account/send` | Send, reply, or save new Zoho draft |
| PATCH `/accounts/:account/messages/:message` | Read/unread/archive/move in Zoho |

References: [Zoho OAuth](https://www.zoho.com/mail/help/api/using-oauth-2.html), [Mail API index](https://www.zoho.com/mail/help/api/), [Free-plan pricing](https://www.zoho.com/mail/zohomail-pricing.html).

## Local verification

Run `npm run check:comms`, `npm run check:webhooks`, `npx tsx scripts/check-admin-content.ts`, `npm run lint` and `npm run build`. API checks use a fake Zoho provider and deletion adapter; webhook checks use in-memory Postgres and do not change a hosted project. For browser QA, build first then run `npx tsx scripts/comms-ui-fixture.ts` and open `http://127.0.0.1:3107/crm/comms`. This isolated fixture contains invented mail and account data and cannot access Zoho/Supabase. `/crm`, `/crm/admin`, and `/crm/admin?role=staff` exercise navigation and access presentation. Do not deploy or mount this fixture in production. Live Zoho OAuth and free-plan permissions require the operator's registered application and separate account validation.
