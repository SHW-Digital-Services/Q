# Q administrator periodic checklist

This checklist is for authorised Q operators. Record the date, operator, environment, result, and evidence link for every completed item. Never paste passwords, MFA secrets, service-role keys, access tokens, prompts, journal text, or payment details into the evidence record.

## Daily or on each production change

- [ ] Check the production health endpoint: `GET https://www.q-ai.online/api/health/supabase` returns `200` and reports database and authentication as up.
- [ ] Review deployment status and error-rate alerts. Investigate unexplained 5xx responses, authentication failures, payment failures, or privacy-job failures.
- [ ] Review recent `security_events` entries for unexpected administrator actions, repeated denials, AAL2 failures, or rate-limit spikes.
- [ ] Review PayPal webhook events for `failed` or stale `processing` records. Retry only after checking the provider event and idempotency state.
- [ ] If hosted AI is degraded or unsafe, set `AI_HOSTED_ENABLED=false`, confirm local AI remains available, and open an incident record.
- [ ] After every deployment, verify HTTPS redirect, CSP, HSTS, COOP, CORP, and `no-store` headers on sensitive API responses.

## Weekly

- [ ] Review staff and partner-admin accounts. Remove leavers, stale accounts, and permissions that are no longer needed.
- [ ] Confirm every privileged operator has TOTP MFA enrolled and can complete an AAL2 challenge.
- [ ] Review the previous week's security and AI-safety events without exporting message content.
- [ ] Review rate-limit activity and adjust thresholds only through a documented change.
- [ ] Check the dependency-security workflow for failures, high-severity findings, leaked-secret alerts, and uploaded SBOM artifacts.
- [ ] Check Dependabot pull requests and action-update notices; review changes before merging.
- [ ] Verify the retention cron job is active and that recent runs completed successfully.

## Monthly

- [ ] Re-run the focused production smoke checks: staff capabilities, AAL2-required actions, anonymous privacy endpoints, privacy export/deletion, duplicate webhooks, failed webhook retry, and rate limiting.
- [ ] Run the deterministic prompt-boundary regression suite from the repository:

  ```powershell
  npm.cmd run check:ai-safety
  ```

- [ ] Review the approved model list (`AI_ALLOWED_MODELS`) and confirm only intended models are enabled.
- [ ] Review hosted-AI usage, provider errors, crisis interceptions, model rejections, and kill-switch events for unusual patterns.
- [ ] Review open security findings, dependency exceptions, and action-SHA changes.
- [ ] Confirm production and backup access are limited to named operators and that no secrets appear in logs, tickets, or CI output.
- [ ] Review the public security, privacy, and threat-model documentation for changes in providers, retention, or data flows.

## Quarterly

- [ ] Perform an isolated Supabase restore drill. Verify schema, migrations, RLS, retention functions, security-event integrity, and privacy controls. Record restore time and result; do not connect production to the restored project.
- [ ] Re-test account deletion holds for active subscriptions and successful deletion for an account without an active subscription.
- [ ] Review all privileged staff permissions with the business owner and re-authorise only the minimum required capabilities.
- [ ] Rotate credentials according to provider policy and immediately rotate any credential that may have appeared in logs, screenshots, chat, or a pull request.
- [ ] Review CSP reports, browser-security exceptions, reverse-proxy configuration, and TLS certificate expiry.
- [ ] Review the remaining plaintext `localStorage` consumers and track the encrypted WebCrypto/IndexedDB migration until complete.
- [ ] Run a live-model adversarial and high-risk-response evaluation in a non-production environment, in addition to the deterministic fixtures.

## Incident-triggered tasks

- [ ] Preserve request IDs, timestamps, affected endpoint, deployment commit, and relevant security-event IDs.
- [ ] Do not copy user content, prompts, passwords, tokens, or payment details into the incident record.
- [ ] Disable hosted AI with `AI_HOSTED_ENABLED=false` if provider compromise, prompt leakage, or unsafe output is suspected.
- [ ] Revoke affected staff sessions and rotate affected credentials.
- [ ] Check webhook idempotency and payment records before replaying any provider event.
- [ ] Notify the security/privacy contact when personal data, payment data, credentials, or privileged access may be involved.
- [ ] Document containment, root cause, corrective action, user notification decision, and closure approval.

## Evidence record template

```text
Date/time (UTC):
Operator:
Environment/commit:
Checklist frequency:
Checks completed:
Result (pass/fail/ not applicable):
Evidence links or query IDs:
Exceptions and follow-up owner:
Due date:
```
