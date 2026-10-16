# IT Hub (subpackage)

This is a self-contained subpackage that implements an IT Hub service integrating:

- BetterStack Incidents v3 API (create/update incidents, status-page incidents & updates)
- Supabase (server-side logging and lightweight incident mirror)
- Vercel webhook handling (HMAC-SHA1 x-vercel-signature verification over raw body)

Quick start (local):

1. cd it-hub
2. cp .env.example .env and populate secrets (SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY, BETTERSTACK_API_KEY, BETTERSTACK_REQUESTER_EMAIL, VERCEL_WEBHOOK_SECRET, IT_HUB_API_KEY)
3. npm install
4. npm run dev

Notes:
- Keep secrets out of source control. Use your platform's secret store in production.
- SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY must be kept server-side only and never exposed to client code. The SQL setup restricts table access to privileged server credentials.
- This subpackage runs independently from the root Q app; it does not modify root application files.

Files of interest:
- src/index.ts — loads dotenv before starting the server
- src/server.ts — Express server with raw-body capture for webhook verification
- src/webhooks/vercel.ts — verifies x-vercel-signature (HMAC-SHA1) and logs events
- src/services/betterstack.ts — BetterStack v3 integration
- src/services/supabase_server.ts — server-side Supabase logging
