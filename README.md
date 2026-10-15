# IT Hub

An IT Hub service that:

- Integrates with BetterStack to create and update incidents and post status page updates.
- Stores logs and events in Supabase.
- Receives Vercel deployment webhooks and logs deployment/deploy-failures; creates incidents on failures.

Quick start:

1. Copy `.env.example` to `.env` and fill values.
2. Run `npm install`.
3. Start dev: `npm run dev` (uses `ts-node-dev`).
4. Configure Vercel webhook to POST to `/webhooks/vercel` (use the secret in `.env`).
5. Configure BetterStack API key and status-page IDs.

Security notes

- Keep secrets out of source control. Use environment variables or your platform's secret store.
- Use a Supabase `service_role` key only on a trusted server (never expose it in browser or client apps).

Files added

- README.md — this file
- package.json — dependencies and scripts
- .env.example — environment variables (placeholders)
- supabase/init.sql — SQL to create required tables in Supabase
- src/* — TypeScript source: server, webhooks, services, and utilities

If you want, I can open a PR from branch `it-hub` to your default branch after you review the changes.
