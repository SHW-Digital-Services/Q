# Zoho Mail communications portal

Staff and Admins open **Communications** from `/crm` (the portal is `/crm/comms`). Q uses only the shared office@q-ai.online mailbox, authorised once in server hosting secrets. Staff/Admins use their individual Q logins; they do not sign into Zoho separately. The portal supports folders, paging, Zoho search, reading, compose, Cc/Bcc, replies, attachments, marking read/unread, archive and moving mail. An explicit **Save new draft in Zoho** action creates a new Zoho draft. Existing drafts can be read in Q; continue editing them in Zoho. Reply drafts remain open in Q until sent. Mailbox messages send only when an operator chooses Send. Support replies separately trigger a generic email notification linking back to the conversation. While Communications is open, it checks folder unread counts every minute.

## Data handling

Zoho is the mailbox system of record. Q relays requests over HTTPS through its backend to keep OAuth credentials private. Email content is not written to Supabase, Q object storage or application logs by this portal. Unsent recipients, subject, message body, uploaded attachment references and personalised template values are saved as plaintext in account-scoped browser session storage to recover work after a refresh. Email drafts are also separated by mailbox and account. Successful sending or saving a new draft in Zoho clears the local composer; Q logout clears the signed-in operator's recovery data. Closing the composer preserves its draft, and Compose reopens it. Closing the browser tab normally ends its session storage; this is not cross-device recovery. Uploaded attachment references expire after eight hours and expired attachments must be uploaded again. Downloading an attachment intentionally saves a copy on the operator's device.

Supabase still authenticates the Q account and supplies the current Staff/Admin role. The existing global rate limiter stores technical counters, without email content or search terms. Existing CRM contact-request/communication records and Brevo event records are separate features; the Zoho portal neither imports mail into them nor logs send activity there.

The shared refresh token is held only in the server hosting secrets (`ZOHO_MAIL_REFRESH_TOKEN`). Access tokens are refreshed and cached in server memory, with no token returned to the browser or stored in Supabase. Each mail request rechecks the current Q Staff/Admin role and verifies the office mailbox against Zoho. Other account IDs are rejected for reading, sending, attachments and message actions. Sender identity is fixed to office@q-ai.online. Attachment proofs remain encrypted and bound to the uploading Q user and office account.

Logging out ends that user's Q session without revoking the shared Zoho connection. To disconnect the platform, remove its refresh token from the hosting environment, redeploy all instances and revoke its authorisation in Zoho. Legacy per-user mail cookies are ignored and cleared by the compatibility disconnect route.

Mail HTML is sanitised with DOMPurify. Scripts, forms, styles and active elements are removed. HTTP/HTTPS, mailto and telephone links open separately with no opener or referrer. HTTPS remote images are displayed with no referrer; image hosts may still observe the load. Embedded PNG, JPEG, GIF and WebP images are relayed from Zoho, capped at ten images of 3 MB each per message. SVG and other active image types are excluded. Other attachments remain downloads.

## Set up the single office mailbox

1. Ensure office@q-ai.online is an actual Zoho mailbox and you can sign into it. This integration does not create a mailbox or change DNS. An alias of a different primary mailbox is not accepted.
2. Sign into [Zoho EU API Console](https://api-console.zoho.eu/) as the office mailbox account, not your personal account. If the mailbox belongs to another Zoho data centre, use its matching console and region instead.
3. Choose **Add Client > Self Client** and create it. Keep its Client ID and Client Secret. This replaces the previous per-user Server-based Application setup; no callback URI is needed for Self Client.
4. Open **Generate Code**, enter the scopes listed below, choose an available expiry (for example ten minutes), and describe the purpose as `Q shared office mailbox`. Generate the code. It is a short-lived grant, not the refresh token.
5. From the Q repository, run `powershell -NoProfile -File .\scripts\setup-zoho-office.ps1 -Region eu`. Enter the Self Client ID, secret and fresh grant when prompted. The helper sends them only to the matching Zoho token endpoint and copies the returned refresh token to your clipboard. Paste it into your hosting provider's secret setting `ZOHO_MAIL_REFRESH_TOKEN`, then clear the clipboard with `Set-Clipboard -Value ""`. Do not paste secrets into chat or commit them. If the grant expires, generate a new one and repeat.
6. Configure these **server** hosting variables:

```text
ZOHO_MAIL_CLIENT_ID=<Self Client ID>
ZOHO_MAIL_CLIENT_SECRET=<Self Client secret>
ZOHO_MAIL_REFRESH_TOKEN=<refresh token from step 5>
ZOHO_MAIL_REGION=eu
ZOHO_MAIL_COOKIE_KEY=<64 hexadecimal characters>
APP_URL=<your actual HTTPS Q origin>
```

Generate the encryption key for attachment proofs with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Use the same key on all instances. Never prefix the secrets with `VITE_`.

7. Deploy/restart Q. Open **CRM > Communications** as Staff or Admin. The mailbox opens without a separate Zoho connection step; only office@q-ai.online is shown and used as sender. Test reading and sending an email to an address you control, replying and using an attachment.
8. If Q says the connection must belong to office@q-ai.online, regenerate the grant under the office Zoho identity. If Zoho denies an operation, check OAuth scopes and your plan's mail API permissions. A normal Q user must not access this portal.

References: [Zoho Self Client authorisation](https://www.zoho.com/developer/oauth/self-client/authorization-code-flow.html), [Zoho Mail OAuth](https://www.zoho.com/mail/help/api/using-oauth-2.html).

Scopes: `ZohoMail.accounts.READ`, `ZohoMail.folders.READ`, `ZohoMail.messages.READ`, `ZohoMail.messages.CREATE`, `ZohoMail.messages.UPDATE`. No organisation-wide administration, user provisioning or permanent mail deletion scope is requested. Region settings select fixed Zoho hosts; callback query parameters cannot select an arbitrary token/API server.

The five-user Forever Free package excludes IMAP/POP/ActiveSync; this integration uses Zoho's REST API. Public documentation does not establish that every mail API action is enabled for every free-plan account. Test your account after registration. A Zoho denial is shown in Q rather than silently switching to another mail service. Provider limits still apply. Q limits uploads to ten files of 3 MB each, downloads to 20 MB and messages to 50,000 characters; use Zoho directly for larger items. Q never automatically retries a send after a timeout or ambiguous failure: check Zoho Sent before retrying.

## Email templates

Communications also includes a **Support inbox** tab for existing Q contact-form requests. The CRM links directly to this tab. It supports complete conversations, staff assignment, status filters, internal notes, archiving and draft recovery. Replies are saved in Q; the office mailbox sends a separate generic notification when configured. Support is available even before Zoho is configured. See [Q Help & Support](q-help-support.md). These existing website support records are separate from the Zoho mailbox; moving their interface does not import or save Zoho email data.

The mailbox opens the system Inbox using its path/name, because Zoho also labels custom folders with the type `Inbox`. Folder pages request all read/unread messages, newest first. Refresh returns to page one of the current folder or search. Folder badges show Zoho unread counts and refresh every minute while Communications is open, including while reading, searching or composing. Returning to the browser tab also refreshes counts. Enable sound notifications to hear a ping when a folder unread count increases after the initial check; the sound button also plays a test ping. Sounds last only for the current portal session and can be muted with the same control. Background browser throttling can delay checks. The visible first message page refreshes when no search, selected email, composer or action is active. Use Refresh to check immediately and return to the message list. Messages remain in Zoho; these checks do not store mail in Supabase. If mail appears in Zoho Inbox but not Q, clear the search, select Inbox, refresh and check for a displayed connection error. If mail is absent from Zoho too, check Zoho Spam and delivery settings.

**Email templates** contains 30 generic starters in six categories: Support, Account access, Using Q, Subscriptions, Community and Updates. Copy follows the brand guide: welcoming, clear, affirming, protective, non-presumptive and non-pushy. Staff fill the labelled placeholders, choose **Use template**, then edit the subject/message and enter recipients. Sending requires a confirmation and rejects unresolved `{{placeholders}}` on the server too. Templates do not trigger campaigns or imply marketing consent. Check permission, facts, links, dates, subscription details and the intended audience before sending. Generic template copy is shipped in `src/data/emailTemplates.ts`; personalised content remains in memory until explicitly sent or saved to Zoho.

## API surface

The 360° customer Communication history combines existing CRM activity with live Zoho email history. Staff/Admin requests resolve the customer's current registered email using the server's Auth admin lookup and search the single office mailbox for sender, To and Cc matches. Results are checked against exact addresses, deduplicated by Zoho message ID, and exclude Drafts, Outbox and Templates. Emails display automatically when the record opens, refresh every minute while visible on the first page, and include an Open email in Communications link and older-page control. No email records, subjects, bodies, attachments or message references are persisted to Supabase by this feature. It is a live history, so deleted emails, changed customer email addresses, missing provider permissions and Zoho search indexing affect what is available. Bcc-only recipients are not covered by the documented sender/To/Cc search. Historical emails already held in Zoho are included, even if sent outside Q. No migration is required.

All paths are under `/api/comms`. Every mailbox route requires a valid Q bearer session and a current Staff/Admin role. Responses use `Cache-Control: no-store, private`. Mail routes do not receive a database client for content writes.

| Method/path | Purpose |
| --- | --- |
| GET `/status` | Configuration/connection status, never tokens |
| POST `/oauth/start` | Compatibility route: rejects individual connections (409) |
| GET `/oauth/callback` | Compatibility route: returns to setup; does not exchange codes |
| POST `/disconnect` | Clears legacy cookies; does not revoke shared authorisation |
| GET `/accounts` | Connected user's mailboxes |
| GET `/customers/:user/history?start=1` | Registered customer's live Zoho email history; server resolves their email, no database writes |
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

## Authentication troubleshooting

If a reply or send reports “Open the communications portal on Q’s configured site address”, Q rejected the browser origin before contacting Zoho. Communications accepts both `https://q-ai.online` and `https://www.q-ai.online` when either is the configured production origin. Other origins must match `APP_URL` exactly; HTTP, unrelated subdomains and unexpected ports remain blocked. This error does not require regenerating the Zoho token.

If a folder request returns an empty array, Q retries Zoho's basic folder view without the sent/archive options. If that is also empty, it tries the documented `in:"folder name"` search with the current received-time cutoff and checks every result against the exact folder ID. Pagination remains available and messages from other folders are excluded. Responses identify the retrieval source (`folder`, `basic-folder` or `folder-search`) without logging mail content. If all retrieval methods return no messages while Zoho webmail contains mail, Q still needs a live account/API investigation; a successful token exchange alone does not verify mailbox message access.

If authorisation fails, confirm the deployed Client ID, Client Secret and refresh token all belong to the same Zoho application and data centre. `ZOHO_MAIL_REFRESH_TOKEN` is the long-lived token returned by the setup helper, not the short-lived Generate Code grant or an access token. `invalid_client` points to the client credentials or data centre; `invalid_code` during refresh points to a missing/invalid/revoked refresh token. Q shows recognised provider error names with its own safe explanations and omits raw provider descriptions. Redeploy after changing hosting settings. Revoked tokens need to be regenerated as the office account. Never paste credentials into chat or support logs.


## Combined Inbox and CRM notifications

Q combines Zoho Inbox, Notification(s) and Newsletter(s) into one Inbox with a summed unread badge. The backend uses Zoho's paginated folder-search syntax and keeps each message's original folder ID for opening, attachments and actions. Other folders and mailbox-wide search remain available. Provider folders and rules are not moved or changed.

Staff/admin CRM pages share in-app toast notifications across sections. The authenticated `/api/crm/notifications` endpoint checks capabilities and exposes only timestamps for new customers, CRM activity/tasks/communications, support, feedback, payments and authorised security activity. Accessible shared/personal mailboxes use the existing authenticated mail API. Polling runs every 30 seconds while CRM is mounted and refreshes when the page becomes visible. Initial loads establish a baseline; account-scoped session recovery prevents repeats when navigating or refreshing.

**Enable device notifications** requests browser permission from a user click. Native alerts contain generic activity text without names, addresses, subjects or message bodies. Preferences apply to the current account/browser session. In-app toasts work without device permission. Alerts stop when CRM closes, the user logs out or camouflage replaces the page. This is not background push while the app is closed; native availability depends on browser/OS support.

Local checks: `npm run check:comms`, `npm run check:crm-notifications`, `npm run check:crm-drafts`, `npm run lint`, `npm run build`. Browser fixtures verified merged messages/counts, original-folder opening, toast delivery while viewing Tasks, opt-in native alerts through a stub, no initial/duplicate alerts and mobile layout. Real Zoho search responses and OS notification delivery need deployed verification.

Provider reference: [Zoho search syntax](https://www.zoho.com/mail/help/search-syntax.html).
