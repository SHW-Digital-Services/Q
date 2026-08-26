---
title: Security Policy
description: Security Policy for Q Intelligence
version: 1.0.1
effective_date: 26/08/2026
last_updated: 26/08/2026
applies_to: https://q-ai.online
owner: Scott Harvey-Whittle trading as SHW Digital Services
product: Q Intelligence
---

# Security Policy

## 1. Purpose

This Security Policy describes the organisational and technical measures used to protect **Q Intelligence**, operated by **Scott Harvey-Whittle trading as SHW Digital Services** ("we", "our", or "us").

It applies to the Q Intelligence website, application, APIs, administrative systems, customer relationship management features, databases, source code, and supporting infrastructure.

Security is a shared responsibility. We maintain safeguards appropriate to the nature of the Service, while users must protect their accounts, devices, and credentials.

---

## 2. Security Principles

Our security programme is guided by the following principles:

- collect and retain only information reasonably required to provide the Service;
- restrict access according to role and operational need;
- keep authentication credentials and service secrets out of client-side code;
- separate public, authenticated, administrative, and service-level operations;
- use established providers for authentication, payment processing, infrastructure, and AI services;
- record and investigate significant security-relevant activity where appropriate;
- review security controls as the Service and its risks evolve;
- prioritise the confidentiality of private journal, chat, profile, and wellbeing information.

---

## 3. Platform Architecture

Q Intelligence uses separate systems for distinct security-sensitive functions:

| Function | System or control |
| --- | --- |
| Authentication and sessions | Supabase Authentication |
| Application data | Supabase PostgreSQL with Row Level Security |
| File and object storage | Supabase Storage where enabled |
| Subscription payments | PayPal |
| AI-assisted features | Configured AI service providers through server-controlled APIs |
| Administrative CRM | Q's role-restricted administrative interface |
| Source control and automated checks | GitHub and GitHub Actions |

Payment providers process payment credentials directly. Q Intelligence does not intentionally store complete payment card numbers, card security codes, or online banking credentials.

---

## 4. Identity and Access Management

Registered users authenticate through Supabase Authentication. Access to protected application data requires a valid authenticated session.

Administrative access requires:

- a valid Q Intelligence user account;
- successful authentication;
- an authorised administrative role stored in the protected profile system; and
- server-side verification of that role before an administrative API request is accepted.

Administrative service credentials must remain server-side and must not be placed in browser bundles, public repositories, support messages, or user-accessible logs.

Access should be removed or changed promptly when a staff member no longer requires it. Privileged access must not be shared between individuals.

---

## 5. Data Access Controls

Q Intelligence uses database Row Level Security and server-side authorisation controls to restrict access to protected records.

Where implemented, these controls are designed so that:

- users access only records associated with their authenticated account;
- administrative operations require an authorised administrative role;
- subscription records are updated through trusted server processes;
- service-role credentials are used only in protected backend environments;
- public or anonymous access is limited to information intended to be public; and
- sensitive user content is not included in the administrative CRM unless required for an authorised support purpose.

Authorisation controls are reviewed when new database tables, APIs, or administrative features are introduced.

---

## 6. Authentication Security

Users are responsible for choosing a strong, unique password and protecting access to their email account and devices.

Q Intelligence may provide password recovery or authorised support-assisted account recovery. Recovery links, temporary credentials, and authentication tokens must be treated as confidential and must not be stored in CRM notes or shared through unauthorised channels.

We may suspend, restrict, or terminate access where we reasonably believe an account has been compromised or presents a security risk.

---

## 7. Encryption and Transmission

Q Intelligence is intended to be delivered over HTTPS so information is encrypted in transit between supported browsers and the Service.

Infrastructure providers may also provide encryption at rest for databases, backups, and storage according to their respective service configurations and documentation.

No method of electronic transmission or storage is completely secure. We do not guarantee that unauthorised access or loss can never occur.

---

## 8. Secrets and Configuration

API keys, payment credentials, database service-role keys, webhook secrets, and similar credentials must be stored in protected environment or deployment-secret systems.

Secrets must not be:

- committed to source control;
- exposed through client-side environment variables;
- included in screenshots or support tickets;
- logged in full;
- shared with unauthorised staff or contractors; or
- reused where separate credentials are available.

Credentials should be rotated when compromise is suspected and periodically where appropriate to the provider and risk.

---

## 9. Payment Security

Subscription payments are processed by PayPal. Q Intelligence stores only the operational information needed to identify and manage a subscription, such as provider subscription identifiers, plan identifiers, status, and renewal information.

Payment-provider webhooks and server-to-server responses should be authenticated or verified before they are used to change subscription access. Payment secrets must be restricted to trusted server environments.

PayPal webhook events are verified before Q uses them to update products, subscriptions, payments, refunds, or access status. Duplicate event identifiers are recorded to prevent the same notification from being processed more than once.

Staff-assisted card payments use PayPal-hosted payment tools. Raw card numbers and card security codes must never be entered into Q CRM fields, notes, logs, or APIs.

Users should report unrecognised payments directly to PayPal and to Q Intelligence support.

---

## 10. AI and Sensitive Information

AI-assisted features may transmit user-provided content to configured AI providers to generate a response. Users should avoid submitting information they are not authorised to disclose.

Because Q Intelligence may be used for personal wellbeing, identity, journal, or LGBTQ+ related content, access to private content must be kept separate from ordinary CRM and customer-support records wherever practicable.

Private journal, chat, mood, or identity information must not be copied into CRM notes merely for convenience.

---

## 11. Secure Development and Change Management

Source code changes are maintained through version control. Automated checks may include:

- TypeScript validation;
- production build verification;
- CodeQL security analysis;
- database migration application and schema linting; and
- legal-document presence checks.

Security-sensitive changes should be reviewed before release. Database changes should be delivered through ordered migrations and tested against a clean database where practicable.

Dependencies and platform components should be updated in response to material security issues, compatibility requirements, and supported-runtime changes.

---

## 12. Logging and Monitoring

Q Intelligence and its infrastructure providers may collect authentication events, application errors, security events, audit records, and limited request metadata for operational and security purposes.

Logs should avoid unnecessary sensitive content. Access to logs must be limited to authorised personnel and retained only for an appropriate operational, security, or legal period.

Monitoring may be used to identify:

- repeated failed authentication attempts;
- unauthorised administrative access;
- abuse or automated attacks;
- unusual API or payment activity;
- application failures; and
- suspected data loss or disclosure.

---

## 13. Backups, Availability, and Recovery

Infrastructure providers may maintain backups and recovery capabilities according to the applicable service plan and configuration.

We take reasonable steps to support service recovery, but do not guarantee uninterrupted availability or recovery of every item of data. Users should retain their own copies of information where the Service provides an export or backup feature and the information is important to them.

---

## 14. Security Incident Response

When a suspected security incident is identified, we may:

1. assess and contain the incident;
2. preserve relevant evidence and logs;
3. restrict accounts, credentials, integrations, or affected services;
4. investigate the cause and affected systems;
5. remediate vulnerabilities and rotate exposed credentials;
6. restore affected services safely;
7. notify affected users, providers, insurers, or authorities where required; and
8. document lessons and improve relevant controls.

Personal data breaches will be handled in accordance with applicable data-protection law and the Q Intelligence Privacy Policy.

---

## 15. Vulnerability Reporting

If you believe you have found a security vulnerability affecting Q Intelligence, contact:

**support@q-ai.online**

Please include:

- a clear description of the issue;
- the affected page, API, or feature;
- steps required to reproduce it;
- the potential impact;
- relevant logs or screenshots with secrets and personal data removed; and
- a safe way to contact you.

Do not include passwords, access tokens, private user content, or unnecessary personal information in a report.

We ask security researchers to act in good faith and avoid:

- accessing, changing, downloading, or deleting another person's data;
- disrupting the Service;
- social engineering, phishing, or physical attacks;
- automated testing that materially degrades availability;
- public disclosure before we have had a reasonable opportunity to investigate; or
- using a vulnerability for financial gain or unauthorised access.

This policy does not create a bug-bounty programme or promise payment for reports.

---

## 16. User Responsibilities

Users must:

- use a strong and unique password;
- keep passwords, recovery links, and sessions confidential;
- keep browsers and devices reasonably up to date;
- sign out on shared devices;
- verify unexpected payment or account messages before acting;
- notify us promptly of suspected account compromise; and
- comply with the Acceptable Use Policy.

We will never ask users to send their password by email or place it in a support request.

---

## 17. Third-Party Services

Q Intelligence depends on third-party infrastructure and service providers. Those providers maintain their own security programmes and are responsible for the security of systems they control.

We assess providers proportionately to their purpose, the information processed, and the practical options available to the Service. Further information is available in the Privacy Policy and Processor Register.

---

## 18. Policy Review

This policy may be updated when:

- the Service architecture changes;
- new security controls or providers are introduced;
- material threats or incidents require changes;
- applicable law or regulatory guidance changes; or
- our operational practices evolve.

The latest version will be published with the Q Intelligence legal documentation.

---

## 19. Contact

Q Intelligence is operated by:

**Scott Harvey-Whittle**  
Trading as **SHW Digital Services**

Website: https://q-ai.online  
Security and support enquiries: support@q-ai.online  
Privacy enquiries: privacy@q-ai.online

---

## 20. Version History

| Version | Date | Summary |
| --- | --- | --- |
| 1.0.0 | 26/08/2026 | Initial Security Policy. |
| 1.0.1 | 26/08/2026 | Added native CRM roles, PayPal synchronisation, webhook verification, and staff-assisted payment safeguards. |

© Scott Harvey-Whittle trading as SHW Digital Services. All rights reserved.
