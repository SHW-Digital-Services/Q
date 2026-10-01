# Website trust remediation and monitoring

Baseline: the Website Trust Score Optimization Report supplied in the conversation.
Audit date: 1 October 2026. Domain: `q-ai.online`; current canonical host:
`https://www.q-ai.online`. The supplied report is a checklist, not a numeric
score measurement. No increase in a third-party score is claimed.

## Sequential action register

| Order | Report task | Evidence and work completed | Remaining work |
| --- | --- | --- | --- |
| 1 | WHOIS transparency | Queried IANA's RDAP bootstrap and authoritative registry; registrar is Mesh Digital Limited, IANA 1390. Registrant data is redacted. | Owner must update and consent to publication through the actual registrar account. No registry settings were changed. |
| 2 | Address and phone | Reviewed existing legal documents; they name Scott Harvey-Whittle trading as SHW Digital Services, United Kingdom, with office@q-ai.online. Added this identity to the global footer, About, Contact and legal-page footer. | No business address or phone is supplied in those documents. Supply verified public details; do not use the registrar's address or phone. |
| 3 | About/team/registration | Implemented server-rendered `/about`, operator identity, service scope and accountability links. Shared identity data supports team bios, credentials, registration and social links. | Verify team details and applicable business registration. Do not invent qualifications, corporate status or a company number. |
| 4 | HTTPS | Live TLS verification succeeded for apex and www. Let's Encrypt YR1 certificate covers both, valid 20 August–18 November 2026. HTTP apex → HTTPS apex → HTTPS www; HTTP www → HTTPS www. No redirect loop or downgrade was observed. | Hosting controls certificate renewal. Daily monitor checks verification and alerts below 15 days remaining. This does not establish end-to-end encryption of stored customer data. |
| 5 | Compliance URLs | Existing `/legal/terms` and `/legal/privacy` returned readable HTML. Added `/legal/refund` and linked it from Terms and footers. Separated Subscription Terms from the incorrectly labelled Accessibility page. | New code/policies need deployment and operator review against the actual business/checkout practices. Statutory rights are not waived by using Q. |
| 6 | Script/link/crawl audit | Removed unconditional chat-widget loading; chat is requested by the visitor. Analytics still requires consent. Added readable initial landing HTML, server-rendered identity pages, crawl files, canonical URLs, public-document allowlist and real production 404 responses. `npm audit --omit=dev` reported zero vulnerabilities. | Recheck deployed pages/assets and actual browser network traffic. Dependency audit is not a malware clearance or a Google Safe Browsing determination. Review hosted WAF/bot rules if a scanner still cannot retrieve content. |
| 7 | Official social profiles | Prepared consistent brand copy and a verified-URL list in shared identity configuration. | No official LinkedIn, Facebook or X URL was found in the legal sources. Owner sign-in and account/email verification are needed before profiles can be created, linked or declared active. |
| 8 | Independent reviews | Prepared Trustpilot claim/verification procedure. Checked Google's Business Profile eligibility. | Trustpilot account creation and verification remain pending. Do not create Google Business Profile for an online-only service; confirm genuine in-person eligibility first. |
| 9 | Backlinks | Prepared editorial, relevant-directory and partner outreach plan below. | Secure real editorial acceptance. No listings, paid links or partnership endorsements have been fabricated or submitted. |
| 10 | ScamAdviser review | Drafted an evidence-led message for the official contact portal. | Deploy and verify first, fill evidence details, then submit. Draft only; no message has been sent. Free reassessment is requested, not guaranteed. |
| 11 | Prohibited paid removal | **Do not purchase third-party trust-score removal, guaranteed score increases, review deletion or fake reviews.** | Reject such offers. A genuine provider's optional advertising/verification product is not required by this plan. |
| 12 | Search Console monitoring | Added daily GitHub public technical checks and defined the Search Console routine below. | Workflow starts once committed to the default branch. Search Console ownership, alerts and private reports require owner access; not configured or inspected in this session. |

## Identity completion and WHOIS publication

The source identity is in `docs/terms.md` and `docs/privacy.md`. Update
`src/shared/businessIdentity.ts` once the following evidence is supplied:

- a legitimate business correspondence address, approved for public use;
- a business phone that the operator controls and can answer;
- confirmed legal form and any applicable company/VAT/other public registration;
- official profiles controlled by the business;
- team members' consented names, roles, factual bios and verifiable credentials.

The wording "trading as" does not establish limited-company incorporation.
If the operator is a sole trader, a Companies House number may not apply.
Do not publish National Insurance numbers, tax-account references or login details
as business-registration evidence. Address and phone fields are omitted while
unknown; the public pages do not display fake details or editorial placeholders.

In the registrar account for this domain:

1. Confirm that the registrant name is correct and the trading-name/organisation
   field is accurate for the actual legal form.
2. Set valid business contact details and complete any email confirmation.
3. Review privacy/proxy settings and the consent-to-publish options for business
   fields. Privacy redaction can persist under registry/ICANN rules even after
   changing a proxy setting; ask registrar support rather than assuming it failed.
4. Publish only the verified business fields authorised for this purpose. Keep
   account security, transfer lock and private credentials protected.
5. Recheck the registry and registrar RDAP responses; record the date, visible
   organisation/contact fields and evidence of website/domain control.

Sources: [authoritative registry RDAP](https://rdap.radix.host/rdap/domain/q-ai.online)
and [ICANN registration-data publication and consent rules](https://www.icann.org/en/contracted-parties/consensus-policies/registration-data-policy).
The registry registration date is 1 August 2026 and expiry is 1 August 2027.
Domain age and low traffic are not defects that can be corrected by code.

## About Us editorial framework

The live-ready page already includes purpose, the named operator, service limits,
privacy choices and contact/accountability. Complete these sections only from evidence:

1. **Operator/business:** legal and trading name, legal form, registered/business
   correspondence address, relevant public registration authority and number.
2. **Core team:** each real name, role, short factual biography, qualifications
   with awarding body and year where relevant, and optional approved profile link.
3. **Accountability:** who handles support, privacy and security concerns; contact
   route; policy links; an accurate last-reviewed date.
4. **Evidence:** link to an actual public registration or professional register
   when applicable. Do not imply accreditation, clinical expertise, endorsements,
   awards or independent security certification without evidence.

## Social profiles: consistent publication pack

Use **Q Intelligence** as the brand, **https://www.q-ai.online** as the website,
and **office@q-ai.online** as the contact. Legal operator attribution must remain
**Scott Harvey-Whittle trading as SHW Digital Services**.

Suggested factual short bio:

> Affirming tools for LGBTQ+ wellbeing, private reflection and everyday guidance.
> Operated by Scott Harvey-Whittle trading as SHW Digital Services, UK.
> Self-help and guidance; not clinical treatment or an emergency service.

Create/claim the official LinkedIn page, Facebook page and X profile through the
operator's accounts. Use the existing Q logo, equivalent bios, the same approved
business contact details, two-factor authentication and named owners. Check each
profile publicly and publish genuine product updates before calling it active.
Add verified URLs to `socialProfiles`; these will appear in the footers and
public-page structured data. Do not link guessed handles or claim a verification badge.

## Review profiles

### Trustpilot

1. Open [Trustpilot's free business signup](https://business.trustpilot.com/signup)
   with the owner-controlled business email and correct domain.
2. Claim an existing domain profile if present; avoid duplicate profiles.
3. Complete the verification offered by Trustpilot using the real account,
   email or domain evidence. Do not add guessed verification tokens to the site.
4. Populate factual business information and link About, Contact, Refund and
   Privacy pages. Confirm the public profile URL before linking it from Q.
5. Invite genuine customers consistently, without incentivised reviews, fake
   identities, filtering out dissatisfied users or revealing their private data.

Sources: [Trustpilot signup](https://business.trustpilot.com/signup) and
[claiming a business profile](https://help.trustpilot.com/s/article/Claim-your-business-profile?language=en_US).

### Google Business Profile

Google excludes online-only businesses and remote mailboxes from Business Profile.
Q appears to be an online software service; in-person eligibility has not been
established. A website correspondence address alone is not proof of eligibility.
Do not create a listing with a fabricated storefront, borrowed address or
service-area claim. If the actual business genuinely serves customers in person,
the owner can review the rules and complete Google's verification with real evidence.
Otherwise use Search Console and the website's factual organisation information.

Source: [Google Business Profile eligibility](https://support.google.com/business/answer/13763036).

## Editorial backlink strategy

Prioritise useful references and referral traffic over a promised algorithmic score.

| Priority | Opportunity | Material to prepare | Acceptance criteria |
| --- | --- | --- | --- |
| 1 | Actual LGBTQ+ community, accessibility or wellbeing partners | A factual product overview, privacy choices, safety limits and tutorial demo | Their editor independently decides whether Q is useful; no invented partnership or clinical endorsement |
| 2 | Relevant LGBTQ+ business networks, such as OutBritain's Pride Guide | Operator-approved business profile and any evidence required by the network | Verify actual eligibility and listing terms; do not claim LGBTQ+ ownership/certification from Q's audience alone |
| 3 | Software/product discovery, such as Product Hunt | Working demo, screenshots, founder/operator details, honest feature and limitation copy | Follow launch rules using an actual maker account; no company account or paid vote manipulation |
| 4 | Specialist digital-wellbeing or privacy publications | Original tutorials explaining local vs hosted AI and practical privacy limitations | Useful original material and editorial review; no paid ranking-link package |

Maintain an outreach log: organisation, relevance, contact, date, evidence sent,
outcome and published URL. Start with a small number of qualified prospects and
check accepted links monthly. Do not bulk-submit to low-quality directories,
purchase private-blog-network links or demand keyword-rich anchors. Qualify real
sponsorship links with `rel="sponsored"` or `nofollow` as appropriate.

Sources: [OutBritain](https://outbritain.co.uk/), [Product Hunt's launch rules](https://www.producthunt.com/launch),
[Google link-spam policy](https://developers.google.com/search/docs/essentials/spam-policies)
and [qualifying paid/outbound links](https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links).

## Review submission sequence

1. Deploy the reviewed code. Run `npm run audit:public-trust` against production.
2. Verify public pages without login and in a browser with JavaScript disabled.
3. Fill identity gaps and confirm registry/social/review details that will be cited.
4. Preserve dated HTTP/TLS, screenshot and page evidence. Check the hosting WAF
   logs for scanner blocks; do not disable protections globally to raise a score.
5. Use `docs/scamadviser-review-request.md` in the
   [official ScamAdviser contact form](https://www.scamadviser.com/contact), selecting
   Company. Request a free manual reassessment and correction of stale facts.
6. Record submission date, reference and response. Recheck after their response;
   do not promise a response time, score, removal or search-ranking change.

The retrieved [ScamAdviser page](https://www.scamadviser.com/check-website/q-ai.online)
displayed score 0, young-domain/low-traffic flags and an inability to analyse
content. Its snapshot also used a two-week age and a GoDaddy certificate issuer.
The live registry/TLS checks show an August registration and Let's Encrypt YR1.
These differences support asking for refreshed evidence, not claiming that the
scanner's current internal verdict has already changed.

## Search Console and technical monitoring routine

Owner: Scott Harvey-Whittle (confirm any delegated administrator).

**Initial setup:** sign into [Google Search Console](https://search.google.com/search-console),
add the `q-ai.online` Domain property, and publish the exact DNS TXT token Google
provides through the domain's DNS account. Keep the token, verify ownership,
enable owner emails and submit `https://www.q-ai.online/sitemap.xml` after deployment.
No token was supplied and no Google account verification was performed here.
Source: [Google ownership verification](https://support.google.com/webmasters/answer/9008080).

**Daily:** review Search Console messages and any security/manual-action email;
investigate active security issues promptly. GitHub's `public-trust-monitor.yml`
is scheduled for 07:15 UTC (08:15 BST / 07:15 GMT) and can be run manually. It
checks readable public pages, initial assets, mixed HTTP resource references in
HTML, TLS validity/expiry, redirect chains, sitemap/robots and unknown-page 404s.
The JSON artifact is retained for 30 days. Configure GitHub's native workflow
failure notifications for the owner. The workflow is not active until it is on
the default branch, and it does not access private Search Console reports.

**Weekly, Monday:** check Search Console Page indexing, sitemap processing,
HTTPS report, Crawl stats, Security issues and Manual actions. Compare new
not-indexed URLs with the previous week. Separate expected private pages from
public errors, redirect failures, unintended noindex, blocked important resources
and soft 404s. Record count, example URL, first-seen date, owner, fix and recheck.

**After every deployment:** run the public audit, inspect About/Contact/Refund
with URL Inspection and Live Test, and request indexing only where appropriate.
Request a security or manual-action review only after an actual issue is fixed;
routine indexing warnings are not necessarily security incidents.

**Monthly:** check identity consistency, social/review links, accepted directory
links, domain renewal, policy accuracy and access ownership. Record any public
trust score with its scan date and source; do not compare undated cached values.

Sources: [Security issues report](https://support.google.com/webmasters/answer/9044101),
[Manual actions](https://support.google.com/webmasters/answer/9044175),
[HTTPS report](https://support.google.com/webmasters/answer/11396518).

## Technical scope and rollout limits

The source scan found no hardcoded HTTP network resource in the app shell;
local development URLs and SVG namespace strings are not mixed-content findings.
The existing AI runtime uses browser workers and dynamic evaluation permissions;
these were not removed without compatibility evidence. Browser-loaded assets,
external services, uploaded files and dynamically published links require
continued checks. A clean npm audit does not prove absence of malware.

The bounded outbound-link check covered 17 external URLs referenced by the
reviewed public legal pages. Nine returned HTTP 200; eight rejected automated
HEAD requests with HTTP 403 but their official pages were readable through a
separate web fetch. No broken destination was established in that sample.
This does not cover every dynamically published link or guarantee future uptime.

Robots rules manage crawling and are not access control. Existing server-side
authentication and permissions still protect private APIs. The public legal route
now uses an explicit allowlist so operational notes and review drafts are not
served as public legal documents. The sitemap lists only approved public pages.

All website changes are local until deployed. External account actions, registry
publication, review submissions and Search Console monitoring setup remain open
where owner verification or missing factual details are required.
