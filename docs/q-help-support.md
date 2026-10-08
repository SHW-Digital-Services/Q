# Q Help & Support

The first release extends Q's existing CRM and uses existing Q accounts.

## Users

Open **Help → My requests** to submit a topic, subject and message, follow replies, close or reopen a request. Ownership and email come from the verified account. Existing Help articles and videos remain searchable above support.

Signed-out submissions display a reference after saving. Open `/support`, enter the reference and its email address, and request an email link. The response does not reveal whether details matched. Links expire after 24 hours and exchange once for a request-specific HttpOnly session. The fragment token is removed immediately. Closing support access revokes the session on that device.

A matching account email does not claim old guest requests. Account requests remain account-only after owner deletion. Guest sessions cannot open another request.

## Staff

Open **Communications → Support**. Filter by status, topic, assignment or archive view. Assign a request to staff with support access, reply in Q or save a separate internal note. Notes and activity are excluded from user responses. Templates insert editable text.

Staff replies set **Waiting for user**. User replies set **In progress** and restore archived requests, including resolved or closed conversations. Staff can resolve, close, archive and restore without deleting history.

The legacy single-response update endpoint returns `SUPPORT_CONVERSATION_REQUIRED`; it no longer records drafts as delivered email. Historical responses show that delivery was not verified. Older unsent CRM reply drafts remain available in the composer.

## Email notifications

The existing server-configured `office@q-ai.online` Zoho mailbox sends a generic notice and link. Subjects, conversation text and internal notes remain in Q. Account links use `/app?tab=help&request=<id>`; guest links use `/support#access=<token>`.

Use the existing server-only `ZOHO_MAIL_CLIENT_ID`, `ZOHO_MAIL_CLIENT_SECRET`, `ZOHO_MAIL_REFRESH_TOKEN`, `ZOHO_MAIL_REGION`, `ZOHO_MAIL_COOKIE_KEY` and `APP_URL` configuration documented in `zoho-mail-comms.md`. The shared connection needs its existing message-create scope. No new provider or browser secret is required.

Replies commit before notification attempts. Email failures cannot discard them. Staff see pending, accepted, unavailable or failed/uncertain notification states. Acceptance does not prove inbox delivery. After checking the office Sent mailbox, staff can retry without duplicating a reply. Processing attempts older than five minutes can be recovered the same way. No scheduled retry worker is included.

## Access, drafts and retention

- APIs verify ownership or a guest session and check staff roles and `support.read`/`support.write` on every request.
- Tables and RPC functions are service-role-only, with RLS enabled. No direct anonymous/authenticated DB access or automatic private-app content imports.
- Transactions and row locks preserve history under concurrent changes. Unchanged create/message submissions have retry identifiers.
- Account/staff drafts use account-scoped plaintext browser session storage; guest drafts use the verified request scope. Successful submission clears its draft. Q logout or closing guest access clears relevant recovery data. Closing a form keeps its draft. Storage failure displays a warning.
- Resolved/closed requests become eligible for the existing operational purge after 365 days without activity. Messages, events, notifications, guest grants and linked legacy CRM copies cascade with the request. Open/recent requests remain. The operator purge must be run; this release installs no schedule. Zoho email and backups follow separate retention arrangements.
- `/support` is excluded from public indexing and analytics. Credentials do not enter query strings or ordinary audit metadata.
- This is product/account support, not an emergency service. No response deadline is promised.

## Release and validation

Apply `supabase/migrations/20261008001518_support_conversations.sql` before deploying the app. It preserves saved legacy replies, converts **Answered** to **Resolved** and updates retention. Deploying only the UI leaves the flow unavailable.

Run `npm run check:support`, `npm run check:support-archive`, `npm run check:crm-drafts`, `npm run lint`, `npm run build` and `git diff --check`. The support suite runs the migration/functions in PGlite and exercises the Express API against those records. It checks ownership, permissions, links, notes, assignment, retries and retention without hosted-data changes or real email.

Before production release, verify with two real accounts and restricted staff access; confirm migration application, Zoho acceptance and receipt, and guest links over deployed HTTPS. Local fixtures do not establish these live results.

Feedback roadmaps, attachments, a public incident page and automated monitoring are later releases.
