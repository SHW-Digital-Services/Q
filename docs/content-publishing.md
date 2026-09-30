# News, updates and Help Videos

Apply `20260929204319_news_item_updates.sql` and `20260929204822_help_videos.sql` before deploying this feature. The original Help Videos migration creates its private Storage bucket with permitted MIME types and a 100 MB file limit. The help_video_upload_50mb_limit migration sets the bucket limit to 50 MB, matching the Free-plan cap. Q accepts source files up to 500 MB and compresses larger-than-50-MB videos in the browser before any upload. No Storage write policy is granted to public or signed-in users; uploads require an Admin-issued signed token.

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

Creation fields: `title` (3–180 characters), `steps` (1–50 non-empty strings, at most 2,000 characters each), `status` (`draft` or `published`) and exactly one of `videoUrl` (HTTPS, at most 2,000 characters, no credentials) or `videoPath` (uploaded Storage path). File uploads use Admin-signed TUS uploads directly to Supabase, avoiding application-server request size limits. Supported source formats are MP4, WebM and Ogg, up to 500 MB; the uploaded result must be no larger than 50 MB. Saving checks that an uploaded object exists.

Uploaded playback uses native video controls with preload disabled. Signed URLs expire after one hour; refresh Help Videos to obtain a new link. Hosted links open the provider's site on selection. Unpublishing stops new playback links; previously issued links can remain valid until expiry. Archiving retains records and files. Review abandoned uploads and archived media under the operator's retention procedure; no automated cleanup is implemented. Add captions through the uploaded media or external host, and supply useful written steps. Upload only demonstration data and material the operator has permission to publish.

## Preview and AI display

Staff and Admin may preview after reauthentication using the same CRM account. Preview remains in the current page's memory; reload/sign-out ends it. Only Admin can change launch status or manage videos. AI messages render Markdown with GFM lists, tables and code; raw HTML is skipped, unsafe URLs are filtered and remote images are reduced to their alternative text. Original stored response text is preserved for save/export.

Run `npm run lint`, `npm run build` and `npx tsx scripts/check-publishing.ts` for local validation. The regression check uses an in-memory database and does not alter a hosted project.

Large video uploads use signed TUS uploads in 6 MB chunks with retry and progress feedback. Format, empty-file and size validation appears beside the selected file immediately; storage failures appear as an alert. Browsers that omit the MIME type can use the supported filename extension. Supabase Free projects have a hard 50 MB global upload cap; a bucket migration cannot override it. Q compresses files above that cap locally; when compression cannot fit a readable result below 50 MB, use the YouTube hosted-video-link option. See https://supabase.com/docs/guides/storage/uploads/file-limits.

YouTube watch, youtu.be, Shorts, Live and embed links render inside the Help centre. Selecting Play loads the privacy-enhanced youtube-nocookie.com player; no YouTube player or thumbnail is requested before that action. Non-YouTube HTTPS links retain the external link. Owners must permit embedding on YouTube; restricted videos can still be opened on YouTube.

Compression loads Q-hosted ffmpeg.wasm only when required. It produces H.264/AAC MP4, reduces resolution to at most 1280?720 at 30 fps, targets a size below the cap with a second attempt if needed, and checks the final byte count before preparing an upload. It preserves video duration and the first audio track; separate subtitle tracks are not copied (burned-in captions remain visible). Long recordings or browser memory limits can prevent compression. Progress and cancellation are displayed; cancel or navigation terminates the compression worker, and the original file on the device is not changed.
