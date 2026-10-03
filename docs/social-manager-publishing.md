# Social Media Manager publishing

The Q Social Media Manager can publish public news through the existing content API. No database migration is needed for the new publisher-status endpoint; the existing content publishing schema and authorised API clients must already be configured.

In the CRM's News & Updates section, create an **Authorised publishing API** client named **Social Media Manager**. Copy the one-time `qcp_...` token and enter it through **Official Website → Connect** in the manager. Do not paste it into chat or commit it. Revoke the client in the CRM to stop its publishing access.

`GET /api/content/publisher/status` accepts the same Bearer token or `x-q-content-api-key` as the existing publisher. It checks the token's SHA-256 hash against an active client and returns only the client ID/name, publication path and public News path. It creates no draft, updates no client state and returns no token/hash. Responses are not cached. Missing credentials return 401, revoked/unknown clients 403, and unavailable service/schema 503.

`POST /api/content/publish` retains its existing validation and token checks. Manager publications use `contentType: news` and appear on `/news`; titles, summaries, bodies, tags and optional hero images follow the existing contract. The new endpoint does not alter CRM roles, public content policies or service-role key handling.

Deploy this change before connecting the manager. Verify locally with `npx tsx scripts/check-content-publisher.ts`, `npm run lint` and `npm run build`. The check uses a simulated database and writes no live records. The existing public `/api/content` can be checked read-only after deployment; real publisher verification requires the administrator-created token.
