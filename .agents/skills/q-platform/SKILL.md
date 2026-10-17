---
name: q-platform
description: Use when implementing, debugging, validating, or preparing changes in the SHW Digital Services Q platform repository. Requires lint, typecheck, and the full Playwright suite to pass before committing or pushing.
---

# Q Platform

Use this skill for work in the Q platform repository. First inspect the current Git status and read any applicable `AGENTS.md` instructions. Identify which project a change belongs to: the repository root app, `it-hub`, or the separate Playwright project under `site-tests/q-playwright-tests`.

## Required checks before commit or push

Do not commit or push Q platform changes until every required check below has passed against the final working tree:

1. From the repository root, run `npm run lint`.
2. From the repository root, run `npm run typecheck`. Run both commands even though they currently invoke the same TypeScript compiler command; keep their results distinct in the report.
3. From `site-tests/q-playwright-tests`, run `npm test`. This runs the full Playwright suite across every browser project configured in `playwright.config.ts`, not just a smoke subset.

If a check fails, fix the cause and rerun all three checks. Do not describe a check as passing if it was skipped, blocked, or only partially run. If the Playwright project dependencies are missing, install its locked dependencies with `npm ci` in that project. Install required Playwright browsers when the runner reports they are missing.

The Playwright config defaults to a local Q test server and refuses remote targets unless explicitly enabled. Use a dedicated non-production test environment and test accounts for tests that need Supabase or payment integration credentials. Never point this suite at production or use production credentials. If a required secret or safe test environment is unavailable, report the affected check as blocked and do not commit or push until the user resolves that blocker or explicitly changes the gate.

## Project-specific checks

When a change touches another independently configured package, inspect its `package.json` and run its own lint/typecheck or test scripts too. In particular, the root `tsconfig.json` excludes `it-hub`; root checks do not validate that application. Keep dependency installs in their project directory and use its lockfile.

## Reporting

Report the exact commands, working directories, and outcomes for lint, typecheck, Playwright, and any additional project checks. State clearly if the full browser matrix did not run. Keep fixes and check results separate from commit/push status; only claim a commit or push occurred when Git confirms it.
