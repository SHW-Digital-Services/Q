# Brevo website tracking

Q uses the supplied public client key `2v6dwksxycatar2dj3vmcuqd` with Brevo's
version 2 loader. `VITE_BREVO_CLIENT_KEY` can override that public identifier;
it is not a server API credential.

The shared cookie-preferences component is mounted at the app root so public
landing and news pages can request consent. The SDK loads only after a saved
**Allow analytics** choice, on `/`, `/news`, `/updates` and `/developer`.
It does not load on the private app, CRM, Communications, account-recovery routes
or the legacy `?view=app`/`?open=q` app routes. Conversations is a separate
integration: the chat widget has been removed and no longer loads for new support conversations.

The loader queues `init` with `do_not_track_page: true` to disable its automatic
full-URL event, followed by an explicit sanitised `page` event. It supplies all
reserved page context fields: URL without query/fragment, path, generic title
and referrer origin only. Q does not call identify or send account/profile,
journal, mood, chat or CRM content to this tracker. The vendor still receives
normal connection metadata and can associate visits with its browser identifiers.

The CSP allows scripts from `cdn.brevo.com` and `sibautomation.com`, the vendor's
frame at `sibautomation.com`, and tracking requests to `in-automate.brevo.com`.
The loader's secondary host was verified against its current JavaScript source.

Use **Cookie preferences** in the footer to change the saved choice. Rejecting
after startup reloads the page so the SDK is no longer running. This does not
delete cookies or tracking data previously stored by the vendor.

Run `npm run check:brevo-tracking` to verify consent gating, page scope,
sanitisation and duplicate prevention without sending test visits to Brevo.
Browser extensions and network filters can prevent the SDK from loading.
Confirm production visits in the Brevo account after deployment and consent.
Website visits do not automatically become stored webhook inbox events.

References: [Brevo JavaScript implementation](https://developers.brevo.com/docs/getting-started-with-js-implementation)
and [page tracking properties](https://developers.brevo.com/docs/track-page-views-js).
