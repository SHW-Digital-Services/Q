# News, updates and Help Videos

Apply `20260929204319_news_item_updates.sql` and `20260929204822_help_videos.sql` before deploying this feature. The Help Videos migration creates its private Storage bucket with permitted MIME types and a 100 MB file limit. No Storage write policy is granted to public or signed-in users; uploads require an Admin-issued signed token.

## News and related updates

Open `/crm` → **Admin Only** to manage news, updates and Help Videos. Staff/Admin preview remains on the CRM. The Admin-only webhook inbox and Staff/Admin communications portal are documented separately in [Brevo webhooks](brevo-webhooks.md) and [Zoho Mail communications](zoho-mail-comms.md).

The CRM list shows published and draft news/updates by default. Select **View Archived** to inspect archived records, and **View Published & Drafts** to return. Both lists have **Load more news & updates** when older records remain. The admin list API defaults to active records; use `archived=true` for archives and `offset`/`limit` for pagination. Status filtering happens before pagination so archives cannot crowd out older active news. Existing records remain readable if the related-news column has not yet been installed; relationship controls require that migration.

Create news using `contentType: "news"` (also the default). To create an update, use `contentType: "update"` and `parentNewsId` containing the news UUID. CRM drafts and the external publishing API both use this field. Updates cannot be parents. The composite foreign key prevents linking to an update or changing a referenced news item's type. Existing unlinked updates are preserved and hidden; administrators must associate them before editing/publishing, or archive them. The relationship check uses NOT VALID to avoid guessing relationships for old records. After all legacy records are corrected, validate `content_posts_news_relationship_check`.

`GET /api/content` returns news records with an `updates` array of published child records, newest first. `limit` (1–50) limits news, not children. `q` searches news text. `type=update` filters the selected news batch to items with published updates; it never returns standalone updates. `GET /api/content/:slug` accepts published news slugs and returns the same nested structure; update slugs return 404. Unpublishing/archiving news hides all its updates without changing their stored status. Direct anonymous Supabase table reads expose published news only; use Q's API for grouped updates. Public content responses may be cached for 60 seconds with stale revalidation for 300 seconds.

## Help Video endpoints

| Endpoint | Permission | Behaviour |
| --- | --- | --- |
| GET /api/help-videos | Public | Published video records with signed playback URLs for uploads |
| GET /api/v1/admin/help-videos | Admin | Current drafts and published videos |
| POST /api/v1/admin/help-videos/upload | Admin | Accepts contentType and size; returns path and signed upload token |
| POST /api/v1/admin/help-videos | Admin | Creates a draft or published tutorial |
| PATCH /api/v1/admin/help-videos/:id | Admin | Sets status to draft, published or archived |

Creation fields: `title` (3–180 characters), `steps` (1–50 non-empty strings, at most 2,000 characters each), `status` (`draft` or `published`) and exactly one of `videoUrl` (HTTPS, at most 2,000 characters, no credentials) or `videoPath` (uploaded Storage path). File uploads use `uploadToSignedUrl` directly to Supabase, avoiding application-server request size limits. Supported formats are MP4, WebM and Ogg, up to 100 MB. Saving checks that an uploaded object exists.

Uploaded playback uses native video controls with preload disabled. Signed URLs expire after one hour; refresh Help Videos to obtain a new link. Hosted links open the provider's site on selection. Unpublishing stops new playback links; previously issued links can remain valid until expiry. Archiving retains records and files. Review abandoned uploads and archived media under the operator's retention procedure; no automated cleanup is implemented. Add captions through the uploaded media or external host, and supply useful written steps. Upload only demonstration data and material the operator has permission to publish.

## Preview and AI display

Staff and Admin may preview after reauthentication using the same CRM account. Preview remains in the current page's memory; reload/sign-out ends it. Only Admin can change launch status or manage videos. AI messages render Markdown with GFM lists, tables and code; raw HTML is skipped, unsafe URLs are filtered and remote images are reduced to their alternative text. Original stored response text is preserved for save/export.

Run `npm run lint`, `npm run build` and `npx tsx scripts/check-publishing.ts` for local validation. The regression check uses an in-memory database and does not alter a hosted project.
