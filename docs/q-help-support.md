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

## Release 2: private suggestions and public roadmap

Verified accounts can submit improvements in **Help > Suggest an improvement** and follow their own suggestions. Original titles and details stay private. Guest support access cannot read feedback. Retries reuse a submission identifier, with one new suggestion per account per five minutes.

Staff use **Communications > Feedback & roadmap** to search, review, archive/restore and group up to 100 suggestions under separately written roadmap drafts. Grouping never copies or publishes original text. Existing `support.read` and `support.write` permissions apply.

Staff save an anonymous title, summary and stage, review the saved preview, then publish separately. Public `/roadmap` displays only publication snapshots in **Under review**, **Planned**, **In progress** or **Available**. Saved edits remain private until republished. Unpublishing or archiving removes public items; restoring keeps them unpublished. Revision checks reject stale saves and grouping batches without partial changes. Account-scoped drafts survive refresh and clear after successful submission or Q logout.

Apply `supabase/migrations/20261008120641_feedback_roadmap.sql` after the release-one migration and before deploying this code. Tables/functions remain service-role-only with RLS; public content uses a restricted API projection. Reviewed or archived suggestions qualify for the operator purge after 365 days without activity, with their audit events. Unreviewed inbox items remain pending review. Account deletion detaches ownership without transferring access. Roadmap summaries remain until staff remove them.

Run `npm run check:feedback` alongside the release-one checks. It verifies ownership, permissions, retries, limits, atomic grouping, snapshots, stale revisions, archive/restore, database restrictions and retention against local migrations. Before production release, verify the hosted migration and flows with two accounts and restricted staff access. No new email provider or secrets are required.

Voting, attachments, a public incident page and automated monitoring remain deferred.


## Hosted schema verification, 8 October 2026

Release-one migration `20261008001518_support_conversations.sql` is applied to Q's linked Supabase project (`brnhalxydcakutxiregp`). Its migration history matches the repository version. The ownership columns, four conversation/access/notification tables, RLS and service-only function permissions were verified. A service-role support-list query through hosted PostgREST returned 200, and unauthenticated `https://q-ai.online/api/support/requests` returned the expected 401. Authenticated browser submission, replies and Zoho delivery still require live verification. Release-two feedback migration `20261008120641_feedback_roadmap.sql` is now applied. Hosted service-role reads of all three feedback tables returned 200. A rolled-back hosted transaction verified draft creation, publication snapshots and stale revision rejection without leaving test data. RLS and service-only table/function permissions were verified; hosted browser flows remain to be checked after Release 2 deployment.


## Release 3: help centre and private attachments

Public `/help` and Q Help share searchable guides and FAQs, category/type filters and article links. Seed content: 46 existing guides and five support FAQs. Communications > Help centre provides saved drafts, preview, explicit review and publication snapshots. Editing a draft does not change published content. Revision checks protect concurrent edits. Archive/unpublish removes the public snapshot; restore does not republish.

Support files accept PNG/JPEG, PDF and plain text, up to 2 MB each and ten files per request. Server validation checks bytes rather than browser MIME. Downloads are forced attachments. Verified request owners and guest sessions access shared files; authorised staff also access internal files. Owners remove their own uploads; staff can remove any request attachment. Failed uploads retain selection for retry, but refreshing requires selecting the file again. Files are not included in email notices.

Private bucket `q-support-private` uses server request checks and restrictive client Storage policies. Metadata deletion/purge queues paths for Storage API deletion; failures remain queued. Communications > Support > Retry queued file cleanup processes up to 50 paths and removes incomplete uploads older than 24 hours. Run after an operational purge; repeat while queued files remain. No automatic cleanup scheduler is configured.

Migration `20261008125504_help_centre_support_attachments.sql` was applied and verified on the linked project on 8 October 2026. Better Stack remains the status provider; no public status page was added.

Validation: check:help-support-release3, check:public-trust, check:crm-drafts, lint and build. Local browser fixtures cover search/FAQ filters, publication review, draft recovery, upload failure/retry/removal, desktop/mobile layout and runtime errors. Production deployment and live authenticated uploads remain unverified.


## CRM revamp

Communications now opens Tickets, with assignment, priority, due dates and date/search filters. Customer emails from the shared office mailbox create tickets and communication history entries during automatic CRM sync. Open the original email link to reply by email, or use Q replies for a conversation inside Q. The CRM uses shared role-aware navigation and inline customer-record tabs; administrator controls appear only for administrator accounts. See `zoho-mail-comms.md` for sync scope and operational limits.
