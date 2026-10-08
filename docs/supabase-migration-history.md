# Supabase migration history recovery

On 1 October 2026, `supabase db push` failed because `premium_continuity`
already existed. The linked project was `brnhalxydcakutxiregp` (Q).
Its migration history stopped at `20260904000003`, although later schema
changes had already been made.

The live columns, constraints, indexes, functions, triggers, RLS and grants
were inspected before repairing these missing history entries:

```text
20260916160930 premium_continuity
20260916170403 crm_communications
20260916181444 crm_task_scheduling
20260921000000 password_reset_temp_password_status
20260921083000 content_publishing
20260923000000 life_guides_peer_knowledge_crm
20260929204319 news_item_updates
20260929204822 help_videos
20260929214155 incoming_webhooks
```

The CLI's `migration repair --status applied --linked` recorded those versions
without rerunning their SQL or deleting application data. Do not reuse this list
on another database without inspecting its schema first.

The genuinely pending migrations were then applied with `db push`:
the 50 MB help-video limit, Online Users Presence policies, profile access-field
protection, and Brevo event metrics. A final `db push --dry-run --linked`
reported that the remote database was up to date. Live checks confirmed the
upload limit, four Presence policies, profile trigger and metrics function.
The metrics function returned 125 notifications for the 30-day window and
was executable by `service_role` only.

For future duplicate-object errors, inspect the complete migration's effects
before marking it applied. A table's existence alone does not establish that
its constraints, policies, grants and supporting functions were applied.
Do not drop tables or reset the remote database to resolve history mismatches.

This database rollout does not deploy frontend/server code or change Realtime's
project-wide public-access setting. See [Online Users setup](online-users.md).

Reference: [Supabase migration repair](https://supabase.com/docs/reference/cli/supabase-migration-repair).


## 8 October 2026 release migrations

Applied the missing support-conversation migration (`20261008001518`) to Q, followed by community-newsletter storage (`20261005000000`) and feedback/roadmap storage (`20261008120641`) through the Supabase plugin. The plugin-generated versions for the new applications were aligned to the existing repository migration versions after success; SQL was not rerun. All local Q migration versions are now recorded remotely. The shared database also retains three Social Media Manager migration entries from its companion repository.

Hosted PostgREST reads returned 200 for support and all five new newsletter/feedback tables. RLS and service-only access were verified. Publication snapshot and stale revision checks passed in a rolled-back hosted transaction. No purge was run, test data committed, newsletters sent or prizes awarded. The security advisor reported informational no-policy notices for intentionally service-only tables, plus unrelated existing auth/function warnings; those require a separate review rather than broadening this migration rollout.
