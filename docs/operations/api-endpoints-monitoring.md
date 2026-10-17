# Q platform API endpoint inventory and monitoring

Inventory checked against `server/app.ts` and `server/routes/*.ts` on 17 October 2026. Paths below are route templates; `:id`, `:user`, and similar segments are path parameters. This list describes the Express API and is not an OpenAPI contract. Recheck after route changes.

The app applies rate limiting to `/api`. Admin route aliases are `/api/v1/admin` and `/api/admin`; the latter is retained as a compatibility alias. Except where shown otherwise, the routes below are mounted under the listed prefix.

## Public health and AI

| Method | Endpoint | Notes / monitor approach |
|---|---|---|
| GET | `/api/health` | Primary availability check. Expect HTTP 200 and JSON `status: ok`, `services.api/database/auth: up`; 503 means unhealthy. |
| GET | `/api/health/supabase` | Detailed Supabase health check; same dependency checks, useful as a diagnostic monitor. |
| GET | `/api/q-ai/health`, `/api/ai/health` | AI provider/config status. Does not prove a model inference succeeds; pair with provider telemetry or a controlled staging canary. |
| POST | `/api/q-ai/chat`, `/api/ai/chat` | AI chat; staging synthetic only, avoid production content/cost. |
| POST | `/api/q-ai/generate-guide`, `/api/ai/generate-guide` | AI guide generation; staging synthetic only. |
| POST | `/api/q-ai/query`, `/api/ai/query` | AI query; staging synthetic only. |

## Billing and referrals

| Method | Endpoint | Notes / monitor approach |
|---|---|---|
| GET | `/api/billing/paypal/plans` | Safe read; check status and schema periodically. |
| GET | `/api/billing/paypal/status` | Authenticated user status; only probe with a dedicated test account in staging. |
| POST | `/api/billing/paypal/webhook` | Provider callback; monitor PayPal delivery outcomes and app processing/idempotency metrics. Never synthetic-post to production. |
| POST | `/api/billing/paypal/create-subscription` | Creates a subscription; sandbox only. |
| POST | `/api/billing/paypal/complete` | Completes subscription flow; sandbox only. |
| GET | `/api/referrals/me` | Authenticated; staging account journey. |
| POST | `/api/referrals/invite` | State-changing; staging only. |
| POST | `/api/referrals/claim` | State-changing; staging only. |

## Communications and Microsoft 365

All routes are under `/api/comms`. Communications routes are sensitive and use private/no-store response headers. Personal mailbox routes are nested under `/api/comms/personal`; the personal ticket-sync route is intentionally forbidden.

| Method | Endpoint | Notes / monitor approach |
|---|---|---|
| GET | `/api/comms/status` | Low-impact config/status probe; does not prove Graph mailbox reachability. |
| GET | `/api/comms/oauth/callback` | OAuth redirect callback; verify through a staging OAuth journey, not a ping. |
| POST | `/api/comms/oauth/start` | OAuth configuration flow; staging only. |
| POST | `/api/comms/disconnect` | Changes mailbox connection; staging only. |
| GET | `/api/comms/accounts` | Contacts Microsoft Graph; authorized low-frequency probe only. Check Graph status and request ID. |
| POST | `/api/comms/tickets/sync` | Imports mail into CRM tickets; no routine synthetic calls. Monitor actual sync success/failure and duration. |
| GET | `/api/comms/customers/:user/history` | Authenticated CRM read; staging synthetic journey. |
| GET | `/api/comms/accounts/:account/folders` | Graph mailbox read; authorized low-frequency probe. |
| GET | `/api/comms/accounts/:account/messages` | Graph mailbox read; use only a dedicated staging mailbox for synthetics. |
| GET | `/api/comms/accounts/:account/folders/:folder/messages/:message` | Graph message read; staging only. |
| GET | `/api/comms/accounts/:account/folders/:folder/messages/:message/attachments/:attachment` | Sensitive Graph attachment read; staging only. |
| POST | `/api/comms/accounts/:account/attachments` | Upload; staging only. |
| POST | `/api/comms/accounts/:account/send` | Sends mail; never probe production. Verify real sends through operational telemetry and Sent Items. |
| PATCH | `/api/comms/accounts/:account/messages` | Bulk message changes; staging only. |
| PATCH | `/api/comms/accounts/:account/messages/:message` | Message change; staging only. |
| GET | `/api/comms/personal/status` | Personal mailbox config/status; authorized user context only. |
| GET | `/api/comms/personal/accounts` | Personal Graph read; authorized, low-frequency only. |
| POST | `/api/comms/personal/tickets/sync` | Intentionally forbidden; monitor expected 403 only in a controlled access test. |
| Other methods | `/api/comms/personal/**` | Personal router mirrors the mailbox endpoints above; use the equivalent route under `/personal`. Restrict checks to the mailbox owner and staging. |

## Support and CRM notifications

| Method | Endpoint | Notes / monitor approach |
|---|---|---|
| GET | `/api/crm/notifications` | Authenticated read; staging account journey. |
| POST | `/api/support/access`, `/api/support/access/exchange`, `/api/support/access/logout` | Access/session lifecycle; staging only. |
| GET/POST | `/api/support/requests` | User ticket list/create; synthetic create only in staging. |
| GET | `/api/support/requests/:id` | User ticket read; staging only. |
| POST | `/api/support/requests/:id/messages` | Creates a message; staging only. |
| PATCH | `/api/support/requests/:id` | Changes ticket; staging only. |
| GET | `/api/support/requests/:id/attachments` | User attachment list; staging only. |
| POST | `/api/support/requests/:id/attachments` | Upload; staging only. |
| GET | `/api/support/requests/:id/attachments/:attachment` | Downloads potentially private content; staging only. |
| DELETE | `/api/support/requests/:id/attachments/:attachment` | Deletes; staging only. |
| GET | `/api/support/staff/assignees`, `/api/support/staff/requests`, `/api/support/staff/requests/:id` | Staff-only reads; staging staff journey. |
| POST | `/api/support/staff/requests/:id/messages` | Staff message/notification; staging only. |
| PATCH | `/api/support/staff/requests/:id` | Staff ticket update; staging only. |
| POST | `/api/support/staff/requests/:id/notifications/:message/retry` | Retries a notification; staging only. |
| GET/POST | `/api/support/staff/requests/:id/attachments` | Staff attachment list/upload; staging only. |
| GET/DELETE | `/api/support/staff/requests/:id/attachments/:attachment` | Staff attachment read/delete; staging only. |
| POST | `/api/support/staff/attachments/cleanup` | Cleanup action; do not probe production synthetically. |

## Feedback, help, presence, and user activity

| Method | Endpoint | Notes / monitor approach |
|---|---|---|
| GET | `/api/feedback/roadmap`, `/api/feedback/suggestions` | Public/authenticated reads as configured; safe read check. |
| POST | `/api/feedback/suggestions` | Creates a suggestion; staging only. |
| GET | `/api/feedback/staff/suggestions`, `/api/feedback/staff/roadmap`, `/api/feedback/staff/roadmap/:id` | Staff reads; staging staff journey. |
| POST | `/api/feedback/staff/suggestions/review`, `/api/feedback/staff/roadmap` | Writes; staging only. |
| PATCH | `/api/feedback/staff/roadmap/:id` | Write; staging only. |
| GET | `/api/help-centre/articles` | Public read; safe availability check. |
| GET | `/api/help-centre/staff/articles` | Staff read; staging staff journey. |
| POST | `/api/help-centre/staff/articles/:id` | Staff write; staging only. |
| GET | `/api/help-videos` | Public read; safe availability check. |
| GET | `/api/v1/admin/help-videos`, `/api/admin/help-videos` | Admin read. |
| POST | `/api/v1/admin/help-videos`, `/api/admin/help-videos`, `/api/v1/admin/help-videos/upload`, `/api/admin/help-videos/upload` | Admin writes/upload; staging only. |
| PUT/PATCH | `/api/v1/admin/help-videos/:id`, `/api/admin/help-videos/:id` | Admin write; staging only. |
| GET | `/api/presence/me` | Authenticated; staging account journey. |
| POST | `/api/presence/resolve` | State/identity resolution; staging only. |
| POST | `/api/activity/events` | Event ingestion; monitor actual rejection/error rates, not synthetic production writes. |
| GET | `/api/activity/audit-log` | Authorized audit read; staging or operator checks. |
| POST | `/api/v1/admin/events` | Same activity router mounted under admin prefix. |
| GET | `/api/v1/admin/audit-log` | Same activity router mounted under admin prefix. |

## Premium, privacy, and content

| Method | Endpoint | Notes / monitor approach |
|---|---|---|
| GET | `/api/premium/access`, `/api/premium/continuity`, `/api/premium/programmes`, `/api/premium/tools` | Authenticated reads; staging user journey. |
| PUT/DELETE | `/api/premium/continuity` | User data changes; staging only. |
| POST | `/api/premium/insights` | May process sensitive input; staging synthetic data only. |
| GET | `/api/privacy/requests` | Authenticated privacy request status; staging only. |
| POST | `/api/privacy/export`, `/api/privacy/deletion-requests` | Sensitive and stateful; never synthetic in production. Test in staging with disposable accounts. |
| GET | `/api/content`, `/api/content/:slug` | Public content read; safe checks. |
| GET | `/api/content/publisher/status` | Operational read; monitor availability and expected status. |
| POST | `/api/content/media`, `/api/content/publish` | Upload/publish actions; staging only. |
| GET | `/api/peer-knowledge`, `/api/life-guides` | Public reads; safe checks. |
| POST | `/api/peer-knowledge` | Creates content; staging only. |

## Billing webhooks, Brevo, and internal jobs

| Method | Endpoint | Notes / monitor approach |
|---|---|---|
| POST | `/api/webhooks/brevo/:id` | Inbound provider webhook; monitor provider delivery, signature/auth failures, deduplication and processing lag. Never replay production samples. |
| GET | `/api/v1/admin/brevo-webhooks/endpoints`, `/api/admin/brevo-webhooks/endpoints` | Admin read. |
| POST | `/api/v1/admin/brevo-webhooks/endpoints`, `/api/admin/brevo-webhooks/endpoints` | Admin write; staging only. |
| PATCH | `/api/v1/admin/brevo-webhooks/endpoints/:id`, `/api/admin/brevo-webhooks/endpoints/:id` | Admin write; staging only. |
| POST | `/api/v1/admin/brevo-webhooks/endpoints/:id/rotate`, `/api/admin/brevo-webhooks/endpoints/:id/rotate` | Secret rotation; never synthetic. |
| GET | `/api/v1/admin/brevo-webhooks/dashboard`, `/api/admin/brevo-webhooks/dashboard` | Admin read/metrics. |
| GET | `/api/v1/admin/brevo-webhooks/events`, `/api/admin/brevo-webhooks/events`, `/api/v1/admin/brevo-webhooks/events/:id`, `/api/admin/brevo-webhooks/events/:id` | Admin event reads. |
| GET | `/api/v1/admin/brevo-webhooks/metrics`, `/api/admin/brevo-webhooks/metrics` | Admin metrics read. |
| PATCH | `/api/v1/admin/brevo-webhooks/events/review`, `/api/admin/brevo-webhooks/events/review`, `/api/v1/admin/brevo-webhooks/events/:id`, `/api/admin/brevo-webhooks/events/:id` | Admin write; staging only. |
| POST | `/api/internal/community-newsletter/run` | Internal scheduled job; never invoke as a monitor. Alert on scheduler run outcome. |

## Admin, IT Hub, archive, and deletion

Admin routes below are available under both `/api/v1/admin` and `/api/admin`, unless noted.

| Method | Endpoint suffix | Monitor approach |
|---|---|---|
| GET/PATCH | `/site-settings/launch` | Admin read/write; staging only for writes. |
| GET | `/vercel-logs`, `/me`, `/content`, `/content/api-clients`, `/staff`, `/crm/users`, `/crm/users/:id`, `/crm/products`, `/contact-requests`, `/peer-knowledge`, `/life-guides`, `/communications`, `/password-reset-requests`, `/provider-insights`, `/data-moat-export` | Admin-only reads; staging staff auth journey; never monitor/export customer datasets in production. |
| POST/PATCH/DELETE | `/content`, `/content/:id`, `/content/:id/publish`, `/content/:id/unpublish`, `/content/api-clients`, `/content/api-clients/:id` | Admin writes; staging only. |
| PATCH | `/users/:id/role`, `/users/:id/permissions` | Privileged changes; never synthetic in production. |
| POST/PATCH | `/crm/users`, `/crm/users/:id`, `/crm/users/:id/email-change`, `/crm/users/:id/referral-credits`, `/crm/users/:id/notes`, `/crm/users/:id/tasks`, `/crm/users/:id/tasks/:taskId`, `/crm/users/:id/entitlements`, `/crm/users/:id/paypal-subscriptions`, `/crm/users/:id/payments` | Customer/payment state changes; staging only. |
| POST/PATCH/DELETE | `/crm/products`, `/crm/products/:id`, `/crm/products/:id/sync` | Product configuration/sync; staging only. |
| POST/PATCH | `/contact-requests`, `/contact-requests/:id`, `/contact-requests/:id/archive`, `/communications`, `/password-reset-requests`, `/password-reset-requests/:id/reset`, `/direct-password-reset`, `/crm/users/:id/temporary-password` | Sensitive writes; never synthetic in production. |
| PATCH/DELETE | `/peer-knowledge/:id`, `/life-guides/:id` | Content writes; staging only. |
| DELETE | `/api/v1/admin/delete-users/:id`, `/api/admin/delete-users/:id` | Destructive; never synthetic. |
| GET/POST | `/api/v1/admin/customer-archive/customers`, `/api/v1/admin/customer-archive/candidates`, `/api/v1/admin/customer-archive/export` | Sensitive customer data; never synthetic in production. |
| GET | `/api/v1/admin/it-hub/events`, `/api/v1/admin/it-hub/status-page` | Admin operational reads. |
| POST | `/api/v1/admin/it-hub/incidents` | Incident creation; never a synthetic check. |

## Public non-API routes

| Method | Endpoint | Monitor approach |
|---|---|---|
| GET | `/robots.txt`, `/sitemap.xml`, `/about`, `/contact` | Public lightweight checks; expect 200 and valid content type. |
| GET | `/legal/:page` | Public read; check a small set of known pages. |

## Monitor setup

### Availability monitors

1. **Primary HTTP uptime monitor:** `GET https://www.q-ai.online/api/health`, every 1 minute, 10-second timeout. Assert HTTP 200, JSON `status == "ok"`, and all `services` values equal `up`. Alert after 2 failed checks in a 3-check window; clear after 2 successful checks.
2. **Supabase diagnostic monitor:** `GET https://www.q-ai.online/api/health/supabase`, every 5 minutes. Expect 200 and `status == "ok"`; use it to identify whether database or auth is down. Since `/api` is rate-limited, do not poll more frequently without checking the configured limits.
3. **Public journey monitor:** Every 5–15 minutes, check one or two low-cost public GET routes such as `/api/content` and `/api/help-centre/articles`; assert the expected JSON shape, not merely a 200. Keep each endpoint in its own check so failures are diagnosable.
4. **Authenticated synthetic journeys:** Run every 15–30 minutes against staging with dedicated accounts. Cover sign-in/session, a representative read from CRM/support, and a controlled write/read/delete cycle using disposable records. Do not run production writes, emails, payments, privacy exports/deletions, or incident creation.
5. **Dependency monitors:** Use Supabase dashboard/telemetry, Vercel function logs, Microsoft 365/Graph request outcomes, PayPal webhook delivery, and Brevo webhook delivery. Avoid issuing unapproved requests against customer mailboxes or provider webhooks.

### Metrics to capture

- Request volume and response counts grouped by **method + normalized route template + status class**.
- Error rate and timeout rate; separate expected 4xx responses from 5xx and dependency failures.
- p50, p95 and p99 latency for total request time and key dependency calls.
- Dependency outcome/latency for Supabase Auth, Supabase REST/Storage, Microsoft Graph, PayPal, Brevo, and AI providers where applicable.
- Webhook delivery, accepted/rejected, duplicate, failed-processing counts and processing delay.
- Vercel function duration, cold starts, memory/timeout failures, and deployment/commit SHA.
- Correlation/request ID, deployment ID, region, and sanitized error category. Preserve upstream request IDs (for example Microsoft Graph `request-id`) where available.

### Data and alert hygiene

- Normalize parameterized paths (for example `/api/support/requests/:id`) before aggregating. Never use raw IDs, email addresses, query strings, tokens or message subjects as metric labels.
- Do not log request bodies, mailbox content, prompts, attachment names, access tokens, cookies, webhook secrets or payment details. Keep logs to operational metadata and sanitized error codes.
- Alert on sustained symptoms, not one transient probe: health 2-of-3, sustained 5xx/timeout increase, p95 latency above the service objective, dependency failure, and webhook backlog/processing delay.
- Keep separate alerts for availability, user-facing latency, and provider delivery so the on-call operator can identify the failing layer.
- Verify monitors with a staging failure simulation and confirm alert, recovery, and runbook behavior. Do not intentionally degrade production to test an alert.

### Recommended starting objectives

Use these as initial targets and adjust from a 2–4 week baseline: monthly API availability >= 99.9%; public read p95 <= 800 ms; authenticated CRUD p95 <= 1.5 s excluding external provider time; 5xx rate < 1% over 5 minutes; provider/webhook processing lag < 5 minutes for normal traffic. Set provider-specific objectives separately and exclude planned maintenance only under the published policy.

## Current implementation notes

- `/api/health` and `/api/health/supabase` check Supabase Auth and a small PostgREST read with a 5-second timeout; they do not exercise every route or third-party service.
- `/api/q-ai/health` reports provider/configuration state and is not a full inference test.
- The application has Better Stack telemetry/incident integration, but this inventory does not assume uptime monitors are already configured. Confirm monitor IDs, alert destinations, and thresholds in the Better Stack dashboard.
- Route inventory can drift. For complete future coverage, generate an OpenAPI spec from the server route definitions and compare it in CI whenever route registration changes.
