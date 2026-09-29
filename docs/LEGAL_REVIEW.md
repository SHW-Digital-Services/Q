Use this file to record legal reviews and approvals for the policies in docs/.

Reviewer:
Organization:
Date:
Notes / Requested changes:

## 28 September 2026: Brevo Conversations disclosure update

Added the operator-supplied Brevo Conversations snippet to the application entry page and permitted its script and frame host in the Content Security Policy. Updated Privacy, Cookie, Terms and Processor Register disclosures for support chat, loading before interaction, visitor metadata, browser storage, support-message handling, marketing separation and provider privacy requests. This records an implementation and documentation change, not legal approval.

The Brevo account settings, accepted DPA, actual storage lifetimes, visitor-tracking options and support retention schedule were not inspected. The supplied snippet loads automatically and is not gated by a consent mechanism. Before release, verify the actual widget behaviour and disable non-essential storage/tracking or place it behind any required prior consent. A policy notice does not supply consent. Do not classify all widget storage as strictly necessary merely because the widget provides support.

Q's existing account export and deletion do not demonstrate automatic export or deletion of Brevo conversation records. Handle those requests separately with the provider. No fixed retention period, automatic deletion, local-only chat processing or PII masking is promised for Brevo support messages.

References checked:

- Brevo visitor data: https://help.brevo.com/hc/en-us/articles/4608779872018-Understand-the-Visitors-online-page
- Brevo widget integration: https://developers.brevo.com/docs/customize-the-widget
- Brevo privacy information: https://www.brevo.com/legal/privacypolicy/
- ICO storage/access exceptions: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/

## 16 September 2026: Brevo disclosure update

The operator confirmed Brevo (formerly Sendinblue) is used for marketing and community-update emails. The Privacy Policy, Processor Register, Cookie Policy and Terms now disclose that use, consent boundaries, unsubscribe/suppression handling and conditional email-tracking behaviour. This entry records a documentation change, not legal approval or verification of the Brevo account.

The account's contracting entity, accepted DPA, tracking configuration, retention settings and campaign unsubscribe behaviour were not inspected. The tracking disclosure therefore remains conditional. Brevo's published guidance describes open/click tracking and separate tracking-consent controls; the live campaign settings must match the notice before relying on it. Existing waitlist permission is limited to the launch updates described on the signup form; it must not be treated as general newsletter consent.

Mailing-list privacy requests require handling in Brevo as well as Q. The current app deletion workflow does not demonstrate automatic Brevo deletion or suppression. Do not promise automatic cross-provider deletion; maintain the minimum suppression record needed to honour an opt-out and handle relevant provider requests through the privacy contact.

References checked for this update:

- Brevo DPA guidance: https://help.brevo.com/hc/en-us/articles/15403782599570-Where-can-I-find-the-Data-Processing-Agreement-DPA
- Brevo storage information: https://help.brevo.com/hc/en-us/articles/360001005510-Data-storage-location
- Brevo email tracking guidance: https://help.brevo.com/hc/en-us/articles/37114679474706-About-email-tracking-pixels-and-the-CNIL-recommendation-in-Brevo
- ICO electronic-mail marketing rules: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/how-do-we-comply-with-the-pecr-electronic-mail-marketing-rules/
- ICO data protection and email tracking guidance: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/what-else-do-we-need-to-consider/
## 28 September 2026: Opt-in Brevo website tracker

Added the Brevo website tracker using the current JavaScript SDK loader. The tracker is configured with the public `VITE_BREVO_CLIENT_KEY` build-time setting and remains unloaded unless the visitor allows analytics. Added a persistent choice and footer control to reopen cookie preferences; page events contain only the path and omit query strings. Updated the Privacy Policy, Cookie Policy and Processor Register to describe this optional processing. This records an implementation and documentation change, not legal approval or verification of the Brevo account configuration.

The tracker client key must be copied from the Brevo account's Automation > Settings and configured in the production build environment before tracking can activate. The account's data settings, tracker retention, contracting entity and exact cookies were not inspected. Verify the live configuration and applicable consent requirements before relying on analytics data.

Reference: https://developers.brevo.com/docs/getting-started-with-js-implementation
