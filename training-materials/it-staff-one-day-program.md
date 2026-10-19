# Q IT Staff: One-Day Operational Training Programme

**Audience:** Q IT, platform, support and incident-response staff  
**Duration:** 09:00–17:00 (6 hours 30 minutes learning/practice plus breaks)  
**Format:** Instructor-led, hands-on, using a non-production environment and synthetic data  
**Version:** 1.0 — 19 October 2026

## Programme purpose

Prepare staff to operate Q’s production support workflows safely: recognize and triage service issues, use Vercel runtime and deployment evidence, investigate Supabase Auth/Postgres/storage and access-control symptoms, coordinate incidents through the Q IT Hub and BetterStack, and communicate a clear recovery and handover.

This programme is grounded in the Q repository. The root application uses React, TypeScript, Express and Supabase; it is deployed in a Vercel-compatible setup. The standalone `it-hub` package integrates BetterStack incidents/status pages, Supabase event logging, and signed Vercel deployment webhooks. The Q admin CRM exposes IT Hub event history and a Vercel runtime log panel. This is staff operational training, not developer onboarding or a substitute for approved security, privacy, or change-management policy.

## Learning outcomes

By the end of the day, each participant can:

1. Explain the Q service path and the operational roles of Vercel, Supabase, BetterStack, and the Q IT Hub.
2. Triage an alert using impact, scope, timing, recent changes, and corroborating evidence without exposing secrets or customer data.
3. Find and interpret relevant Vercel runtime logs and deployment context, and distinguish an application symptom from a hosting/deployment symptom.
4. Safely investigate Supabase Auth, Postgres, Row Level Security, Storage, migrations, and server-side integration failures using least privilege.
5. Create and update a BetterStack incident with a concise title, impact statement, responder notes, and suitable status-page communication.
6. Explain how the Vercel webhook signature is verified and how webhook events flow into the IT Hub event history.
7. Run an incident through mitigation, verification, communication, handover, and a blameless review.

## Preparation and safety

### Instructor preparation

- Confirm participants have the access required for their role; use individual accounts and MFA.
- Use a staging/non-production Q environment and synthetic incident data. Do not trigger production incidents or alter production records for training.
- Prepare read-only Vercel and Supabase views wherever possible. Demonstrate privileged actions with a trainer account only when necessary.
- Confirm the IT Hub integration is configured in the chosen environment. Required server-side settings documented by the repo include Supabase server credentials, BetterStack API key/requester email, Vercel webhook secret, and IT Hub API key. Never display or copy secret values into slides, chat, tickets, shell history, or screenshots.
- Have the incident scenario and answer key ready (below), plus a sample deployment timeline and sanitized logs.
- Check the current approved escalation contacts, severity definitions, incident communications channel, data handling rules, and recovery/rollback authority; insert them into the local runbook before delivery.

### Participant prerequisites

- Basic familiarity with Q and the staff/admin CRM.
- Familiarity with web applications, HTTP errors, and incident ticketing is helpful but not required.
- Participants must know how to use the approved password manager and MFA.

### Non-negotiable handling rules

- Never place credentials, access tokens, signing secrets, raw customer content, or unnecessary personal data in incident notes or screenshots.
- Keep Supabase service-role/secret credentials server-side. Client-visible keys are not a substitute for authorization; access must still be governed by authentication, role checks, and RLS.
- Do not use SQL, admin access, account deletion, or production configuration changes as exploratory troubleshooting.
- Preserve evidence and timestamps. Do not delete logs or repeatedly retry an operation that could create duplicate side effects.
- Verify environment and project identity before every action. Stop and escalate if the target is unclear.

## Timed agenda

| Time | Session | Method | Evidence of learning |
|---|---|---|---|
| 09:00–09:20 | Welcome, objectives, baseline check | Discussion and short diagnostic | Each person names their role and one escalation route |
| 09:20–10:00 | Q service map and ownership | Instructor walkthrough | Team labels the service path and evidence sources |
| 10:00–10:10 | Break |  |  |
| 10:10–11:00 | Vercel deployments, runtime logs, and first triage | Guided console exercise | Completed triage worksheet with evidence and next step |
| 11:00–11:50 | Supabase operations and data protection | Demonstration plus case discussion | Correctly classifies Auth, database/RLS, Storage, and migration symptoms |
| 11:50–12:30 | IT Hub, BetterStack, webhook and incident workflow | Walkthrough and paired practice | Draft incident record and verified event timeline |
| 12:30–13:15 | Lunch |  |  |
| 13:15–14:00 | Incident communications, prioritization, and coordination | Role play | Initial update and stakeholder/responder assignments |
| 14:00–14:10 | Break |  |  |
| 14:10–15:25 | Capstone: Q service degradation tabletop | Team simulation | Live incident timeline, decisions, updates, and recovery checks |
| 15:25–15:35 | Break |  |  |
| 15:35–16:15 | Recovery verification, handover, and post-incident review | Facilitated debrief | Completed handover and blameless review outline |
| 16:15–16:45 | Skills check and individual action plan | Practical assessment | Scored checklist and one development action per person |
| 16:45–17:00 | Close and feedback | Round-robin | Confidence rating and course feedback |

## Facilitator guide and content

### 1. Welcome and baseline (09:00–09:20)

Set expectations: this is an operational simulation, and safe escalation is a successful outcome. Ask participants to write down what they would check first if staff report that Q is unavailable. Establish a shared vocabulary for incident, symptom, impact, evidence, mitigation, and resolution. Do not assume that the first visible error identifies the root cause.

### 2. Q service map (09:20–10:00)

Walk the team through the repository-backed shape of the service:

```text
Staff/customer browser
  ├─ Q web app (React/TypeScript; Vercel-compatible deployment/runtime)
  ├─ Supabase client: Auth and user-scoped data under RLS
  └─ Q API routes / server integrations
        ├─ Supabase server-side operations and IT Hub event mirror
        ├─ BetterStack incident and status-page APIs
        └─ Vercel deployment webhook → signature check → event handling

Q staff/admin CRM
  ├─ IT Hub: BetterStack status, incident creation, recent IT Hub events
  └─ Vercel Logs: recent production runtime logs (admin-gated)
```

Explain that the diagram is a practical support map, not a claim that every request uses every service. Ask participants which system is authoritative for (a) deployment/runtime evidence, (b) identity and data access, (c) incident/status communication, and (d) Q’s integration event history. Reinforce that a dashboard signal should be correlated with user impact and a second evidence source before drawing conclusions.

### 3. Vercel deployment and runtime triage (10:10–11:00)

Demonstrate the approved Vercel project and environment selector. Show how to locate the deployment corresponding to the incident window, inspect deployment state and runtime logs, narrow by time/request/error, and capture a sanitized finding. In Q, the CRM includes a Vercel Logs admin panel described as recent production runtime logs; access is session-protected. Use the provider console for deployment-level context when the CRM view is insufficient.

Teach a repeatable sequence:

1. Confirm the affected route, user group, start time, and whether the issue is ongoing.
2. Confirm the correct Vercel project and environment; inspect the last known-good and current deployment timestamps.
3. Filter runtime evidence to the affected interval. Look for repeated error classes, route patterns, dependency timeouts, and correlation/request IDs.
4. Compare to recent deployment or configuration changes; do not infer causation from timing alone.
5. Record only sanitized evidence and the next safe diagnostic step. Escalate deployment rollback or configuration changes to the authorized owner.

Practice: learners receive three sanitized log snippets (a route-level 500, an upstream timeout, and a missing-environment-configuration message) and identify what each supports, what it does not prove, and who should take the next action.

### 4. Supabase operations and protection (11:00–11:50)

Explain Q’s use of Supabase Auth, PostgreSQL, Storage, and Row Level Security. Relevant repository guidance emphasizes that user memory and journal data is protected with RLS, and server-side credentials must remain server-side. Staff diagnose by category before changing anything:

- **Auth:** login/session, provider, redirect, or token symptoms. Check scope, timing, and approved Auth diagnostics; never ask for a user’s password or token.
- **Postgres/API:** query failures, connection/pool pressure, migration mismatch, or unavailable API. Correlate app errors with service health and migration/deployment timing.
- **RLS/authorization:** distinguish “not authorized” from “not found.” Do not disable RLS to test a hypothesis; verify the user/role path and escalate policy changes for review.
- **Storage:** upload/download path, size/type constraints, access policies, and object availability. Avoid opening or copying customer files during triage unless necessary and authorized.
- **Migrations:** compare the deployed application expectation with applied migration state. Never run ad hoc schema changes against production during an incident without the established approval and recovery plan.

Practice: give four short symptom cards and have groups map each to the likely subsystem, safe read-only evidence, risk of a wrong fix, and escalation owner. Emphasize that root-cause confidence should be stated explicitly.

### 5. Q IT Hub, BetterStack, and Vercel webhook (11:50–12:30)

Repository facts for the walkthrough:

- The Q CRM IT Hub panel displays BetterStack status-page data, supports incident creation, and shows recent IT Hub event history.
- The standalone `it-hub` service integrates BetterStack Incidents v3 and status-page v2, records a lightweight incident/event mirror in Supabase, and accepts Vercel webhooks.
- The Vercel webhook handler verifies `x-vercel-signature` using HMAC-SHA1 over the raw request body before processing. A signature failure must be treated as untrusted input and investigated; do not bypass verification.
- Incident creation is an external side effect. In practice, use the IT Hub interface in the approved environment, check for an existing incident first, and avoid duplicate creation.

Show the incident form with synthetic information. Practice writing a concise title, impact/affected service, known start time, and factual description. Show how the event history helps establish what the IT Hub observed; do not treat its mirror as the only incident record. For a missing event, check whether delivery, signature verification, handler processing, and logging each succeeded before changing configuration.

### 6. Communication and coordination (13:15–14:00)

Assign incident roles for the exercise: incident lead, technical investigator, communications owner, and scribe. The incident lead maintains priorities and decisions; investigators report observations and confidence; communications owner sends approved updates; scribe preserves timestamps, actions, owners, and outcomes.

Use this update structure:

> **Impact:** Who/what is affected, and how broadly?  
> **Status:** What is confirmed and what remains uncertain?  
> **Action:** What is being done, by whom?  
> **Next update:** When and where will the next update appear?

Write in plain language. Avoid speculation, blame, sensitive details, and promises unsupported by evidence. Use the approved channel and cadence for the incident’s severity. Status-page updates must be appropriate for external readers and must not expose internal systems or personal information.

## Capstone exercise: Q service degradation tabletop (14:10–15:25)

### Scenario

At 14:10, several staff report intermittent failures in a Q staff workflow. Some requests return a server error, while others succeed. A new deployment completed shortly before reports began. The Q admin’s Vercel log view shows a rise in sanitized upstream errors. Supabase health is not yet known. BetterStack has no incident open. The Vercel webhook event appears in neither the expected event timeline nor the IT Hub history.

The instructor releases injects every 10–15 minutes. Teams should not use production systems or perform real changes.

### Injects

1. **14:20:** Reports are limited to one workflow; public sign-in still succeeds. Two log entries show timeouts but no customer identifiers.
2. **14:32:** A teammate says, “Just disable RLS and see if it works.” Participants must reject that unsafe diagnostic and propose safe alternatives.
3. **14:45:** The team finds the webhook request reached the IT Hub endpoint, but the signature does not validate against the configured training secret. The group must treat it as unverified, preserve metadata, and follow secret/configuration escalation; no one reveals or pastes the secret.
4. **15:00:** A second evidence source shows Supabase Auth remains healthy, while a server-side dependency is intermittently slow. A prior known-good deployment is available, but rollback authority belongs to the release owner.
5. **15:10:** The authorized owner mitigates in the simulation. Error rate falls. Teams must define verification checks and decide when the incident can be resolved.

### Required team outputs

- Impact statement and severity rationale using the organization’s actual severity matrix.
- Time-stamped event/decision log with evidence source and confidence.
- A draft BetterStack incident description and a suitable internal or external update.
- Safe investigation plan across Vercel, Supabase, and IT Hub/BetterStack.
- Explicit mitigation owner/approval and rollback criteria; no unauthorized change.
- Recovery verification and resolution criteria.
- Handover note and two blameless follow-up actions.

### Instructor answer guide

Strong teams establish scope and impact, check the right Vercel deployment and runtime window, corroborate rather than overstate Supabase health, and preserve a distinction between confirmed facts and hypotheses. They create one incident after checking for duplicates, communicate uncertainty clearly, and keep customer data and secrets out of notes. They do not disable RLS or bypass webhook signature checks. They route rollback to the authorized release owner, then verify the impacted workflow, error trend, and relevant service signals before resolution. They document the missing/unverified webhook as a separate evidence gap and assign a follow-up to examine delivery, raw-body handling, signature configuration/rotation, and event persistence safely.

## Practical assessment (16:15–16:45)

Score each criterion **0 = missed/unsafe, 1 = partial, 2 = correct and clear**. Passing recommendation: at least 12/14, with no zero for safe data/secret handling, environment verification, or change authorization. A fail on a critical safety criterion requires coaching and reassessment.

| Criterion | Score |
|---|---:|
| Confirms impact, scope, start time, and environment | /2 |
| Selects relevant Vercel evidence and records it safely | /2 |
| Differentiates Supabase Auth, data/RLS, Storage, and migration paths | /2 |
| Uses IT Hub/BetterStack without creating duplicate or misleading records | /2 |
| Treats failed webhook signature as untrusted and does not bypass verification | /2 |
| Protects secrets and customer data; avoids unsafe production probing | /2 |
| Escalates authorized changes and verifies recovery before resolution | /2 |

## Handover and post-incident review template

**Incident/reference:**  
**Current impact and affected workflows:**  
**Start time / latest update (include timezone):**  
**Confirmed facts and evidence links:**  
**Open hypotheses (with confidence):**  
**Mitigation applied, by whom, and approval:**  
**Recovery checks completed / outstanding:**  
**Next owner and next update due:**  
**Data or security considerations:**  
**Follow-up actions (owner and due date):**

The review asks: What happened? What was the impact? What signals helped or were missing? Which decisions reduced impact? What made response harder? What specific system or process changes will reduce recurrence or recovery time? Keep the discussion blameless and action-focused.

## Materials and setup checklist

- Projector and whiteboard/shared timeline.
- Sanitized Vercel log/deployment examples and Supabase symptom cards.
- Training IT Hub/BetterStack environment or screenshots; never production credentials.
- Scenario inject cards, role cards, triage worksheet, assessment checklist, and handover template.
- Current Q service ownership/escalation list, severity matrix, change/rollback policy, communication channels, and data handling policy.

## After the day

- Store attendance and assessment outcomes in the approved staff learning record, with access limited to training owners.
- Assign coaching/reassessment for any critical safety miss.
- Review participant feedback and refresh screenshots/runbooks when Q integrations or repository workflows change.
- Schedule a short tabletop within 60–90 days and a refresher after significant changes to Vercel logging, Supabase security/data design, or IT Hub/BetterStack integration.

## Source map

- Root architecture and deployment overview: `README.md`.
- IT Hub integration and server credential guidance: `it-hub/README.md`.
- BetterStack, Vercel webhook, signature verification, and Supabase logging: `it-hub/src/services/betterstack.ts`, `it-hub/src/services/vercel.ts`, `it-hub/src/webhooks/vercel.ts`, `it-hub/src/services/supabase_server.ts`, `it-hub/src/utils/signature.ts`.
- Staff/admin IT Hub interface and event history: `src/components/ItHubAdmin.tsx`.
- Admin Vercel runtime log panel: `src/components/VercelLogsPanel.tsx`.
- IT Hub event schema/migration and setup: `supabase/migrations/20261016000000_it_hub_events.sql`, `it-hub/supabase/init.sql`.

**Delivery note:** No Q Training staff learning document session was connected when this program was prepared. This repository copy is ready to upload or paste into that learning space; the course itself does not assert unverified connector access or organization-specific escalation details.
