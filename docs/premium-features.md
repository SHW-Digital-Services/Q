# Premium programmes, insights and continuity

Premium access follows the hosted-AI rule: an ACTIVE subscription with no expired billing period, or an authorised staff/partner-admin role. The server checks access for every request. Failed access checks fail closed.

## Guided programmes

Life Guides includes three four-session programmes: boundaries, connection and confidence. Users can move freely between sessions, save optional reflections, mark sessions complete and revisit them. Progress is stored under the signed-in account on the device. Programme progress is included in normal account backups, and optionally in continuity.

## Advanced journal insights

The journal offers 30-, 90- and 365-day summaries. Generating a report sends only dates, mood ratings and tags to Q for calculation; it does not send journal prose or call an AI provider. Daily mood check-ins take precedence over journal ratings for the same date. The headline average weights recorded days equally, missing days are excluded, and tags need three records. Patterns are descriptive, not diagnostic or causal. Reports are calculated on demand, not stored as a separate server record.

## Cross-device continuity

Profile provides opt-in selection of journal entries, moods, guides, chat, programme progress, and language/appearance preferences. Each browser opts in separately. The server stores one bounded snapshot per account. Local edits trigger a debounced sync; reconnect, focus and a 30-second timer retry. Revision checks reject stale uploads atomically. When both copies differ from the last accepted snapshot, the user explicitly selects a copy; neither wins automatically. Users can export both copies and a local recovery copy. This is snapshot conflict resolution, not automatic per-entry merging.

Cloud copies use account-authorised APIs and are inaccessible through direct browser database grants. They are not end-to-end encrypted. Local browser copies and backups remain plaintext. Device locks, credentials and AI-provider preferences are not synced. Deselecting a category pauses its sync on that device and preserves previously uploaded data. Uploads preserve other categories to avoid deleting data selected on another device. Pause other devices before deleting a cloud copy to avoid re-upload. Export and deletion remain available after subscription expiry; account deletion cascades to the cloud snapshot.

Older unscoped guides/chat are never automatically attributed to a new account. Profile offers an explicit import of those older device records, preserving current account records. The original device records remain intact.

## Premium everyday tools

The Premium tools tab adds three features: a goal and habit planner with chosen practice days and weekly check-ins; scripted conversation rehearsal for boundaries, privacy, support and misunderstandings; and saved weekly reflections with a next-week priority. The rehearsal is a writing exercise with fixed practice prompts, not AI roleplay or a prediction of real responses. Weekly activity counts use device-local calendar weeks starting Monday and do not interpret moods or journal prose.

The server authorises the tools catalogue with the existing Premium entitlement. Editing is available only after that check succeeds. Goals, drafts and reflections are saved per account in this browser, with explicit storage errors; they are included in account backup export/import and local-data clearing. They do not use AI providers or cloud continuity. Reading and exporting existing work remain available after expiry. Goal archiving preserves check-in history. No database migration or new provider configuration is required for these tools.

Verify add/check/archive/restore, refresh persistence, changing rehearsal scenarios, selecting earlier reflection weeks, free/expired access, backup restoration, account switching and mobile navigation. `npm run check:premium` covers the catalogue access checks, workspace validation, local calendar boundaries, account separation and backup round-trip.

The journal privacy lock also protects the Premium workspace.

## Deployment and verification

Apply the generated `20260916160930_premium_continuity.sql` migration before enabling this release. It adds a service-only table and an invoker RPC with atomic optimistic concurrency. The migration can be tested without touching production by running `npm run check:premium`, which uses an isolated PGlite database and HTTP route tests. Also run `npm run lint` and `npm run build`.

Production verification should cover two real devices, paid/free/expired accounts, reconnect after offline edits, subscription renewal, account switching, cloud conflicts, export and deletion. Local automated results do not prove hosted migration deployment or browser behaviour.
