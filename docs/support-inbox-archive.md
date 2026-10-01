# Support inbox archive

In Communications → Support inbox, choose **Archive** on a request to remove it
from the Inbox. Choose **Archived** to find archived requests, then **Restore to
inbox** to bring one back. The workflow status, enquiry and recorded reply are
preserved. Archiving does not send mail, record a sent reply or delete a request.
The existing reply/status controls remain available in the Archived view.

The API defaults to unarchived requests. `GET /api/v1/admin/contact-requests?archived=true`
lists archived requests; both views return the newest 200 matches. The filtering
happens before the limit. `PATCH /api/v1/admin/contact-requests/:id/archive`
accepts `{ "archived": true }` or `{ "archived": false }` only. Existing staff
`support.read` and `support.write` permissions apply. Browser access to the
underlying table remains denied.

Database migration: `20261001103919_support_inbox_archive.sql`. Existing rows
start in the Inbox. Archive state is a nullable timestamp, independent of the
request status. The migration adds partial indexes for each view.

Run `npm run check:support-archive` to verify the actual API against a local
mock Supabase transport backed by PGlite. It checks archive/restore, preservation
of replies/status, queue filtering, invalid inputs, missing requests and staff
permissions without changing hosted data.
