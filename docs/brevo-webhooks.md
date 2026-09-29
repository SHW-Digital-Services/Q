# Incoming Brevo events

Admins open `/crm` → **Admin Only** → **Brevo Webhooks**. Staff do not have access to endpoint setup, event payloads or review actions. Apply `supabase/migrations/20260929214155_incoming_webhooks.sql` to the same Supabase project used by the deployed Q backend before use. No migration is needed for Zoho mailbox content.

Create a named endpoint and choose transactional, marketing or other. Q displays its receiving URL and a bearer token once. Copy both into Brevo's webhook configuration and enable [bearer webhook authentication](https://developers.brevo.com/docs/secured-webhooks). Requests go to `POST <APP_URL>/api/webhooks/brevo/<endpoint-id>` with `Authorization: Bearer <token>` and `Content-Type: application/json`. Production `APP_URL` must be the HTTPS canonical origin. The endpoint accepts one event or a batch of 1–100 events; each needs a string `event` name. Requests are limited to 256 KB, individual events to 32 KB and nesting to 20 levels.

Q also creates a unique random `<letters-and-numbers>@q-ai.online` **integration identifier**. It is not a mailbox, forwarding address or substitute for the HTTPS webhook URL. Q does not change MX/DNS records or receive email at that identifier.

Only token hashes/prefixes are stored. Secret rotation invalidates the previous token; update Brevo after rotation. Disable an endpoint to stop accepting events. Receipt checks the active state and current secret again inside a database transaction, stores the batch and acknowledges after success. Canonical full-payload hashing prevents exact duplicate retries from adding another row. Brevo's `id` may identify the webhook itself, so it is not used alone as a delivery-event identifier. Semantically similar events with different payloads are kept separately. Q stores events for review; it does not automate billing, customer updates, marketing consent or unsubscribe actions.

The inbox displays receipt time, event type, email where supplied and received/reviewed status. Filter by endpoint or review state, page older records, inspect a payload and mark reviewed. Known credential fields are redacted recursively; other event data may contain personal information. Do not deliberately send email bodies, credentials, journal content or chat content in webhook events. Tables are inaccessible to anonymous and authenticated Supabase clients; only the server service role uses them. Review and retention remain operator tasks; there is no automatic archive/purge job. Existing endpoint/event records are retained when receiving is disabled.

For a setup check, send a permitted test event through Brevo and verify it appears once, then retry the identical payload and verify the duplicate count. Confirm Staff cannot list endpoints or view event details. Keep tokens and payloads out of screenshots, support requests and logs.

Reference: [Brevo transactional payloads](https://developers.brevo.com/docs/transactional-webhooks).
