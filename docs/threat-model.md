# Q threat model and recovery controls

Q treats authenticated user content, staff actions, payment notifications, hosted AI prompts, browser storage, and CI/deployment credentials as separate trust boundaries.

## High-risk abuse cases

- stolen staff session used for role, billing, recovery, or export actions;
- concurrent or replayed PayPal events producing duplicate financial effects;
- prompt injection in user content or retrieved knowledge;
- XSS reading browser-held records;
- dependency or CI compromise introducing malicious code;
- failed deletion, backup, or restore leaving records in an unknown state.

## Required mitigations

Phases 0–3 provide canonical URLs, opaque errors, no-store responses, AAL2 and capability checks, atomic webhook claims, privacy receipts, retention rules, and server-side audit events. Phase 4 adds browser policy headers and a WebCrypto/IndexedDB storage foundation; the remaining synchronous localStorage consumers must be migrated before claiming all local records are encrypted. Phase 5 constrains trusted context and approved models while retaining a hosted-AI kill switch. Phase 6 adds dependency review, secret scanning, SBOM generation, and documented restore evidence.

## Recovery evidence

Operators must retain a recent database backup, test a restore in an isolated project at least quarterly, verify migration replay, confirm privacy and security-event integrity, and record the result. A backup file or provider dashboard status alone is not evidence of a successful restore.

## Control status and residual risk

Implemented controls must be verified in the deployed environment, not inferred from source code alone. The highest remaining Phase 4 risk is the synchronous localStorage migration: the secure-storage module is available, but existing consumers must be converted to asynchronous IndexedDB reads/writes and tested for migration, key loss, tab concurrency, quota exhaustion, and recovery before encrypted-at-rest claims are made. Phase 5 still requires adversarial prompt-injection and high-risk-response evaluation fixtures. Phase 6 still requires pinned action commit SHAs, documented dependency exceptions, and a witnessed restore test in an isolated Supabase project.

## Evidence register

| Area | Repository evidence | Operational evidence required |
| --- | --- | --- |
| Browser policy | `server/app.ts`, `vercel.json` | Inspect production response headers and CSP reports |
| AI safety | `server/routes/ai.ts`, `ai_safety_events` migration | Confirm kill-switch drill, model allowlist, and redacted event records |
| Supply chain | `.github/workflows/dependency-security.yml`, `dependabot.yml`, `scripts/generate-sbom.mjs` | Review CI runs, triage audit findings, retain SBOM artifact |
| Recovery | `docs/threat-model.md`, retention/purge migrations | Complete isolated backup restore and record RTO/RPO evidence |
