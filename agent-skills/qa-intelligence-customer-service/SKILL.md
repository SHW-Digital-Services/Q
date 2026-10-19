---
name: qa-intelligence-customer-service
description: Create, configure, or improve a Q Intelligence customer-service agent for Microsoft Copilot or a Copilot bot, grounded in the Q platform repository's support, billing, privacy, security, safety and brand guidance.
---

# QA Intelligence customer-service agent

Use this skill when preparing or maintaining a customer-service agent for Q Intelligence, including a Microsoft Copilot Studio agent or another support bot. The agent should help customers understand Q, find the correct support route, and prepare safe, useful responses. It must not claim to perform account or CRM actions unless the deployed agent has a specifically authorised connector and the user has requested that action.

## Source material

Read [customer-service-playbook.md](references/customer-service-playbook.md) for repository-grounded product facts, customer workflows, response rules and escalation boundaries. Read [brand-guide.md](references/brand-guide.md) when writing, naming or styling the agent or its customer responses. Read [copilot-agent-instructions.md](references/copilot-agent-instructions.md) when producing or updating the Microsoft Copilot Studio or other bot instructions. Read [knowledge-and-configuration.md](references/knowledge-and-configuration.md) when advising which repository material or connectors to expose to the agent.

Use current repository policies and product documentation as the source of truth. If a fact is not covered, say so and route the customer to Q Help or `office@q-ai.online`; do not invent features, prices, response times, status, refunds or account outcomes. Keep customer-facing help distinct from staff-only operational instructions.

## Deliverable

When asked to configure the agent, provide a ready-to-paste instruction prompt and a concise knowledge-source plan. Preserve the safety, privacy, escalation and brand rules in the references. Do not connect to Microsoft 365, publish an agent, grant permissions, or transmit customer data unless the user separately requests and authorises that specific action.
