# Copilot knowledge and configuration plan

Use this checklist when a human administrator configures **QA Intelligence – Customer Services** in Microsoft Copilot Studio or another Microsoft Copilot surface. This is a design handoff, not evidence that any Microsoft tenant, bot, connector or deployment has been configured.

## Knowledge to include

Use current, approved customer-facing sources:

- Q public Help centre articles and FAQs (`https://q-ai.online/help`).
- Current Terms of Service, Subscription Terms, Refund & Cancellation Policy, Privacy Policy and AI Disclaimer.
- The customer-facing sections of the Q user guide and the Q Help & Support documentation.
- Current public product pages for features, plans and prices when the agent is expected to answer those questions.
- `customer-service-playbook.md` and `brand-guide.md` in this skill as response and brand references.

Review knowledge whenever Q publishes a policy or product change. Remove outdated copies instead of leaving conflicting policy versions available. When policy pages conflict, prefer the current published policy and refer unresolved interpretation to Q support.

## Keep out of customer-facing knowledge

Do not ingest or expose:

- Customer account exports, private tickets, private journal or mood content, AI conversation histories, support attachments, or personal email.
- Staff-only CRM notes, audit logs, admin guides, internal security incident details, staff chat, credentials, environment files, tokens or database/service-role material.
- Raw mailbox content or personal staff inboxes. Q's shared CS mailbox and the customer's support conversation are distinct; mailbox access is not needed for a knowledge-only customer assistant.
- Internal workflow descriptions that reveal security-sensitive controls or permit the bot to imply it completed an action.

If a separate staff copilot is later required, create a distinct agent with its own audience, identity checks, connector permissions, data-loss controls and staff-only knowledge. Do not reuse this customer-facing agent's broad access for convenience.

## Tools and permissions

- Start with a knowledge-only agent. Do not connect a CRM, Microsoft 365 mailbox, payment system or customer database unless a specific task requires it and the data owner approves the exact permissions and purpose.
- If an approved connector is added, scope it to the minimum records and actions required, require authenticated identity and row-level authorization, and prevent cross-customer search or disclosure.
- Keep read operations separate from actions such as sending email, changing a ticket, altering an account, processing a refund or deleting data. Require human review for customer-visible or consequential actions.
- Do not configure the bot to use staff credentials, shared personal accounts, service keys or unaudited workarounds.
- Add data-loss prevention and retention settings consistent with Q's privacy commitments and Microsoft tenant policy. Do not send health or wellbeing content to an unapproved AI/model endpoint.

## Test before release

Use fictional records and test identities. Verify the agent:

1. Gives the right Q Help and account-recovery route without asking for secrets.
2. Explains cancellation and refund policy without promising an outcome or removing statutory rights.
3. Does not expose internal notes or claim a ticket/email action succeeded.
4. Handles an immediate-danger message by directing the person to local emergency help without implying Q is monitored.
5. Says it cannot confirm current prices, account status, outages or delivery when no live approved source/tool is connected.
6. Refuses requests for another customer's information, passwords, recovery links, private journal content or internal records.
7. Provides a useful human-support route without inventing an SLA.

Do not test with production customer records or send real customer communications during configuration. Confirm the knowledge sources, connectors, data retention, audience and handoff behavior with the Q data owner before enabling the agent for customers.

## Repository source map

The agent playbook is grounded in these repository sources (verify their latest versions before import):

- `docs/q-help-support.md` — customer request flows, staff ticket workflow, notifications, permissions, retention and Help centre.
- `docs/refund.md` and `docs/subscription_terms.md` — cancellation, renewal and refund boundaries.
- `docs/privacy.md`, `docs/security.md`, `docs/terms.md` and `docs/ai_disclaimer.md` — privacy, security, product limitations, legal and crisis language.
- `docs/q-user-staff-admin-guide.md` — customer support channels and staff privacy/security boundaries; use staff-only material only in an approved internal agent.
- `docs/microsoft365-mail-comms.md` — shared customer-support mailbox behavior and sync limitations; operational, not a public customer knowledge source.
- `src/shared/support.ts` and `src/components/SupportRequests.tsx` — current support status/category labels and CRM ticket interface.
- `docs/website-trust-remediation.md`, `README.md`, `src/components/QLogo.tsx`, `src/index.css` and `public/logo.png` — brand description, identity and visual references.

The repository does not establish a customer-service SLA, live incident integration, automatic bot-to-human transfer, or authority for a bot to access CRM, Microsoft 365 or PayPal. Configure such capabilities only through separate approved processes.
