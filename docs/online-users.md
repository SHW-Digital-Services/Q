# CRM Online Users

Open **Online Users** from the Staff CRM header, or visit `/crm/online`.
Staff can see connected customers (`user` and `beta_tester`) only. Admins can
see customers, Staff and Admins, and filter by category. Customer accounts cannot
open the CRM page or read the online list.

The app publishes presence whenever a signed-in Q session is open, including
customer pages, CRM and Communications. Each account is counted once across
tabs and devices. Online indicates a connected session, not attention or activity.
No journal, chat content, email address, page URL or browsing history is published.
The list uses the preferred profile name, with a generic fallback.

## Setup

Deploy both migrations with the application's normal migration workflow:

- `20261001094314_online_users_presence.sql`
- `20261001094510_protect_profile_access_fields.sql`

In Supabase **Realtime Settings**, disable **Allow public access**. This app uses
private channels only. RLS cannot protect a client that joins a public channel;
requiring private channels is part of the setup, not an optional privacy setting.
Check other applications using the same project before changing that project-wide
setting. No publication or database change stream needs enabling for Presence.

The app's security policy permits Supabase secure WebSocket connections (`wss`).
Presence uses HTTPS/WSS APIs, so PostgreSQL SSL enforcement needs no extra CA file.
The existing server-only Supabase service key derives the ticket signing key;
there is no additional environment variable. All server instances must use the same
key. Rotating it invalidates old tickets until sessions refresh.

## Access and integrity

| Topic | Publishers | Readers |
| --- | --- | --- |
| `online-users` | Customers | Staff and Admins |
| `online-staff` | Staff | Admins |
| `online-admins` | Admins | Admins |

Both permissive policies and restrictive guards protect these reserved topics,
including against unrelated broad policies. Profile role, organisation and Staff
permission fields are protected from self-service changes; existing Admin routes
manage them through the server service client.

`GET /api/presence/me` checks the current database role and issues a short-lived
signed presence ticket. Realtime transports only that ticket. It grants no login
or account access and contains no display name or email. Customer publishers do
not receive other customers' presence.

`POST /api/presence/resolve` requires Staff/Admin authentication, verifies each
ticket, rechecks current database roles, and returns only permitted profile names.
Staff cannot obtain Admin or Staff identities through modified requests. Modified,
expired and old-role tickets are discarded. The browser renews tickets every
minute and rechecks list access every 20 seconds while the page is open.

Presence tracks connections rather than creating a stored activity log. Normal
disconnects remove presence; abrupt network loss may take time to appear. Tickets
expire after 150 seconds if renewal stops. Like other presence systems, this is
not an attendance or auditing system: authorised viewers could replay a captured
ticket briefly, but cannot change its signed identity or extend its lifetime.

## Validation

Run `npm run check:online-users`, `npm run lint`, `npm run build`, and
`git diff --check`. The feature check covers API authorisation, role changes,
ticket tampering/expiry, duplicate accounts, real PostgreSQL RLS semantics and
profile privilege protection in an isolated PGlite database.

Hosted verification requires separate customer, Staff and Admin sessions. Confirm
customer join/leave updates; verify Staff cannot read the Staff/Admin topics;
confirm Admin filters; test multiple tabs, reconnect, sign out, role demotion and
mobile layout. Also verify that public channel joins are rejected in the hosted
project. Local tests do not prove those hosted settings.

Reference: [Supabase Realtime authorization](https://supabase.com/docs/guides/realtime/authorization).
