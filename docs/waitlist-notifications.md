# Waitlist signup notifications

The public signup form now posts to `POST /api/waitlist`. The server validates the same-origin request, validates the submitted name, email address, and adult confirmation, and inserts using the Supabase anon key. The existing `public.waitlist` RLS insert policy remains in force; the route does not use the service-role key for signup inserts. Duplicate email addresses return the existing already-joined result and do not send another alert.

After a new row is inserted, the server sends a plain-text notification containing only the name, email address, and submission time through the configured Q Microsoft 365 shared mailbox. The recipient is fixed by server configuration; the browser cannot choose it. The endpoint is rate-limited to five requests per IP per 15 minutes by the existing API limiter.

## Hosting configuration

Set `WAITLIST_NOTIFICATION_TO` to the operator mailbox that should receive signup details. It may contain comma-separated recipients if the operator explicitly needs more than one. The message is sent from the mailbox configured by `M365_MAIL_MAILBOX_ID` (defaults to `cs@q-ai.online`) using the existing server-only Microsoft 365 settings:

- `M365_MAIL_CLIENT_ID`
- `M365_MAIL_TENANT_ID`
- `M365_MAIL_REFRESH_TOKEN`
- `M365_MAIL_COOKIE_KEY`
- `M365_MAIL_MAILBOX_ID` (optional; defaults to `cs@q-ai.online`)

The server also needs the existing Supabase URL and anon key settings used by the application. Do not place any Microsoft credential or service-role key in a `VITE_` variable or browser code. No Supabase schema migration is required.

## Delivery behaviour and review

Signup remains successful if Microsoft 365 is not configured or a send fails, because the waitlist insert has already committed. The server logs a request ID and a delivery failure without logging the name or email. This first version does not retry failed notifications; monitor hosting logs and recover signups through the authorised Q admin waitlist view.

The email contains personal contact details. Before production enablement, set the intended recipient, verify the Microsoft mailbox and hosting configuration, and confirm the Privacy Policy and Processor Register accurately describe internal waitlist handling and Microsoft 365 processing. Existing waitlist consent is limited to the launch updates described on the signup form; it is not consent to unrelated marketing.
