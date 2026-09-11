# Implementation Plan: External PDF Download via Proxy Route

## 1. Goal

Replace the Kirby-uploaded PDF (built in `deck-pdf-download.md`) with a plain
URL field pointing at a PDF hosted elsewhere (Google Drive or any other host),
and make the download fast, forced (not a browser preview), and correctly
named, by fetching it server-side and streaming it back through a gated Next
route rather than serving it from Kirby or linking to it directly.

This is necessary, not just faster: the previous design's PDF download was
slow because Kirby on SiteGround was serving the binary; moving the file
off Kirby fixes that. But moving to an external URL also breaks the earlier
design's other assumption — the HTML `download` attribute (which forces a
save with a custom filename) is silently ignored by browsers for
cross-origin links. A raw Google Drive URL in an `<a href>` would not force a
download at all; it would navigate the visitor to Drive's own viewer/preview
page. Proxying through our own route makes the link same-origin from the
browser's perspective and gives full control over the filename and
disposition regardless of where the file actually lives.

## 2. Current System Behaviour

- **Kirby.** `cms/site/blueprints/pages/deck.yml` has a `pdf` field:
  `type: files`, `multiple: false`, `accept: application/pdf` — an uploaded
  file stored and served by Kirby itself.
- **Query.** `next/queries/deckQuery.js`'s `getDeckForRender(token)` selects
  `pdf: { query: "page.pdf.toFile", select: { url: true } }` and returns
  `pdfUrl: result.pdf?.url || ""` — the Kirby-hosted file's URL.
- **Route.** `next/app/(portal)/portal/[token]/page.js` computes `download =
  meta.pdfUrl ? <DeckDownload pdfUrl={meta.pdfUrl} title={meta.title} /> :
  null` once, after the `locked` branch, and includes it in both remaining
  branches (the "not ready" message and the `DeckEmbed` render).
- **Component.** `next/components/DeckDownload.js` is a server component: a
  local `sanitiseFilename(title)` function (trims, replaces
  `\ / : * ? " < > |` with `-`, falls back to `"Deck"`, appends `.pdf`), and
  renders `<a href={pdfUrl} download={sanitiseFilename(title)}
  className="deck-download">` with an uppercase "Download PDF" label. `href`
  points directly at the Kirby file URL.
- **Styling.** `next/styles/deck.css` has `.deck-download` — `position:
  fixed; top: 0; right: 0; height: var(--deck-header-h); display: flex;
  align-items: center; padding: 0 1.5rem; z-index: 10;`.
- **Auth shell (unaffected, reused here).**
  `next/utility/deckAccess.js`'s `resolveDeckAccess(token)` returns
  `{ status: "notfound" | "expired" | "locked" | "unlocked", meta }` by
  calling `getDeckForRender`, checking expiry, and checking the
  `deck_session` cookie (`next/utility/deckSession.js`'s
  `verifyDeckToken`/`DECK_SESSION_COOKIE`).
- **Known problem being fixed.** Downloading through Kirby/SiteGround is
  slow. Separately (not yet hit in practice, but a real defect in the current
  design): if `pdf` were ever changed to hold an external URL without any
  other change, `download` would not force a save for a cross-origin file —
  this plan's proxy design is required for "paste any URL and it downloads
  correctly," not optional polish.

## 3. Desired Behaviour

- The deck edit form in Kirby has `pdf_url` — a plain URL field — instead of
  an uploaded file. Staff paste a link to a PDF hosted anywhere (Google
  Drive, Dropbox, S3, a CDN, etc.).
- On the portal page, once unlocked, the same fixed top-right download
  control appears whenever `pdf_url` is set (identical visual behaviour to
  `deck-pdf-download.md` — this plan does not change placement, styling, or
  when it shows).
- Clicking it always downloads the file with the filename `<deck title>.pdf`,
  regardless of the source host or the file's original name there, and
  regardless of whether that host would normally show a preview page instead
  of downloading.
- For Google Drive links specifically: a normal "share" link is
  automatically rewritten to Drive's direct-download form. If Drive responds
  with its "can't scan this file for viruses" HTML interstitial (common for
  larger files) instead of the PDF, the system extracts the confirmation
  token from that page and retries once to get the actual file. If that
  still fails, the download fails with a clear error rather than silently
  serving the wrong content.
- The external URL itself is never sent to the browser — not in the page
  HTML, not in any client-visible attribute. The only URL the client ever
  sees is our own `/portal/<token>/pdf` route.
- Every download request re-validates the session (expiry and cookie), not
  just the initial page load — a session that has since expired or been
  invalidated cannot download the PDF even if the page was left open.

## 4. Architecture Considerations

**Proxying is required, not optional, once the source is cross-origin.** The
`download` attribute on an `<a>` only controls the save behaviour for
same-origin, `blob:`, or `data:` URLs; browsers ignore it for cross-origin
hrefs and simply navigate instead. Making `href` point at our own route
(`/portal/<token>/pdf`) is what makes the link same-origin from the
browser's perspective, restoring both the forced download and the custom
filename regardless of the actual source host. This also naturally solves
the Kirby-hosting speed problem, since the binary transfer is now
Drive-to-our-server-to-client (or whichever host) rather than
SiteGround-to-client, and our server can be on faster infrastructure.

**No new npm dependency.** Fetching a URL server-side and returning it with a
`Content-Disposition` header is native to a Next.js route handler (`fetch` +
`Response`). No "PDF downloader" package does this job better or more simply
than the two built-in primitives already used elsewhere in this project (the
`unlock` route already builds custom `Response`/`NextResponse` objects with
headers).

**Google Drive needs explicit URL rewriting and a documented fallback.** A
normal Drive share link (`drive.google.com/file/d/<id>/view...`) serves an
HTML viewer page, not file bytes. The long-standing direct-download form is
`drive.google.com/uc?export=download&id=<id>`. For files Drive cannot or will
not automatically virus-scan (generally larger files), that URL itself
returns an HTML "Google Drive can't scan this file for viruses" page
containing a confirmation link/form with a `confirm=<token>` parameter;
appending that to the request completes the download. This mechanism is
Google's, is not officially documented as a stable public API, and has
changed in the past — treated here as a best-effort compatibility layer, not
a guarantee. If Google changes it again, large Drive-hosted PDFs may need a
different host; this is called out explicitly rather than assumed to always
work.

**Detecting success vs. the interstitial by response `Content-Type`, not by
host-specific status codes.** Drive returns HTTP 200 for both the real file
and the interstitial page. The reliable signal is the response's
`Content-Type`: `text/html` means "not the file yet" (for a Drive URL,
specifically); anything else is treated as the actual content and streamed
through as-is.

**`sanitiseFilename` moves to a shared utility.** Both `DeckDownload.js` (for
the `download` attribute, which is worth keeping as a same-origin hint even
though the server header is authoritative) and the new route (for the
`Content-Disposition` header) need the same filename logic. Duplicating it
would let the two drift apart.

**`Content-Disposition` filename is encoded per RFC 6266, not just the plain
attribute value.** `sanitiseFilename` already strips filesystem-unsafe ASCII
punctuation, but a deck title can still contain non-ASCII characters (accents,
non-Latin scripts, emoji), which are not safe to place unescaped in an HTTP
header. The route sets both a plain-ASCII `filename="..."` fallback (built by
additionally stripping non-ASCII characters for the header specifically) and
a `filename*=UTF-8''<percent-encoded>` parameter in the same header, which is
the standard way to support both older and modern clients without risking a
malformed header on an unusual title.

**Re-checks auth per download, via the existing `resolveDeckAccess`, not a
lighter custom check.** The route calls the same helper the page itself
uses, rather than re-implementing a cookie check, so the download endpoint's
notion of "unlocked" can never drift from the page's. This is a strict
improvement over `deck-pdf-download.md`'s direct-URL approach, where the
file's URL — once present in a rendered page — worked regardless of any
later session change.

**No SSRF hardening beyond what already exists.** `pdf_url` is entered by
trusted Kirby staff (already authenticated into the Panel), not public input,
so this plan does not add URL-scheme or private-IP-range validation before
fetching it server-side. Noted as an accepted, low-priority risk consistent
with this project's treatment of other staff-entered fields, not something
this plan builds defenses for.

**Streaming, not buffering, the response body.** The route passes the
upstream `fetch` response's `body` (a `ReadableStream`) straight into the
outgoing `Response` rather than reading it fully into memory first, keeping
memory use flat regardless of file size. The one exception is the Drive
interstitial page itself, which must be read as text to extract the confirm
token — that page is small (HTML, not the PDF), so buffering it is fine.

**Known constraint carried forward, not solved here.** A very large PDF over
a slow upstream connection could approach the hosting platform's serverless
function execution-time limit, since the whole transfer happens within one
request/response cycle. Not addressed in this plan; if it becomes a real
problem, the fix would be range-request support or moving the proxy to an
edge runtime, both separate pieces of work.

## 5. Data Flow

**Authoring.** A staff member opens a deck in the Kirby Panel and pastes a
PDF link into `pdf_url` (or leaves it empty). No upload happens; Kirby stores
the string like any other text/url field.

**Page request (unchanged from `deck-pdf-embed`/`deck-pdf-download`).** A
client requests `/portal/<token>`. `resolveDeckAccess` returns `meta`
including `meta.pdfUrl` (now sourced from `page.pdf_url.value` rather than a
file). If truthy, the route renders `<DeckDownload token={params.token}
pdfUrl={meta.pdfUrl} title={meta.title} />` — `DeckDownload` now needs the
token to build the proxy route's URL; it still receives `pdfUrl` only to
decide whether to render at all (its `href` no longer uses the raw value
directly).

**Download click.** The browser requests `GET /portal/<token>/pdf`. The route
calls `resolveDeckAccess(token)` again. Any status other than `unlocked`
returns a plain 401/403/404 response with no body (`notfound`/`expired`/
`locked` all treated as "not authorized to download"). On `unlocked`, if
`meta.pdfUrl` is empty, 404. Otherwise the route normalises the URL (Google
Drive rewrite if applicable), fetches it, and — only for a Drive URL whose
response `Content-Type` is `text/html` — reads that response as text,
extracts a `confirm` token, and refetches
`drive.google.com/uc?export=download&confirm=<token>&id=<id>`. Whatever
response is finally deemed "the file" (non-`text/html`, or a non-Drive URL's
response as-is) is streamed back to the browser with `Content-Type` (the
upstream's, or `application/pdf` if the upstream did not send one),
`Content-Disposition: attachment` plus the encoded filename, and
`Cache-Control: private, no-store`.

**Browser.** Because the response came from the same origin as the page
(`/portal/<token>/pdf`) with an `attachment` disposition, the browser saves
it directly using the server-specified filename — no dependency on the
`download` HTML attribute at all, though `DeckDownload` still sets it to the
same value as a same-origin progressive-enhancement hint.

## 6. Component Responsibilities

### `next/utility/filename.js` — module (new)

- **Responsible for:** `sanitiseFilename(title)`, moved unchanged from
  `DeckDownload.js` (trim, replace `\ / : * ? " < > |` with `-`, fallback
  `"Deck"`, append `.pdf`); a second export, `sanitiseFilenameAscii(title)`,
  that additionally strips any character outside printable ASCII
  (`0x20`–`0x7E`) after the same replacement/fallback logic, for the header's
  plain `filename=` fallback.
- **Not responsible for:** RFC 6266 percent-encoding (built inline where the
  header is assembled, using the platform's `encodeURIComponent`, not a new
  helper, since it is a single standard call).
- **Exports:** `sanitiseFilename`, `sanitiseFilenameAscii`.

### `next/utility/driveDownload.js` — module (new)

- **Responsible for:** `isGoogleDriveUrl(url)` (hostname check);
  `driveFileIdFrom(url)` (extract the file id from any of the common Drive
  share-URL shapes — `/file/d/<id>/...`, `?id=<id>`; returns the id or
  `null`); `buildDriveDownloadUrl(id, confirmToken)` (returns
  `https://drive.google.com/uc?export=download&id=<id>` or, with a token,
  the same plus `&confirm=<token>`); `extractDriveConfirmToken(html)` (regex
  search for a `confirm=` value in the interstitial page's HTML, returns the
  token or `null`).
- **Not responsible for:** performing any fetches itself — pure
  URL/string functions only, so they are unit-testable without network
  access.
- **Exports:** the four functions above.

### `next/app/(portal)/portal/[token]/pdf/route.js` — route handler (new)

- **Responsible for:** `GET`. Calling `resolveDeckAccess(params.token)`;
  returning an empty 401/403/404 response for every status except
  `unlocked`, and 404 when `meta.pdfUrl` is empty; determining the fetch URL
  (via `driveDownload.js` when applicable, otherwise `meta.pdfUrl`
  unchanged); performing the fetch (and the one Drive-interstitial retry when
  needed); returning the upstream body streamed through with `Content-Type`,
  `Content-Disposition` (both filename forms via `filename.js`), and
  `Cache-Control: private, no-store`; returning a plain error response (502)
  if the upstream fetch fails or the interstitial retry does not yield a
  non-HTML response.
- **Not responsible for:** rendering any UI, deciding whether the download
  control is shown on the page (that stays in `[token]/page.js`).
- **Exports:** `GET`. `export const dynamic = "force-dynamic"` (reads
  cookies via `resolveDeckAccess`).

### `next/components/DeckDownload.js` — component (modified)

- **Responsible for:** rendering `<a href={\`/portal/${token}/pdf\`}
  download={sanitiseFilename(title)} className="deck-download">` with the
  same visible label as before. The local `sanitiseFilename` definition is
  removed in favour of importing it from `next/utility/filename.js`.
- **Not responsible for:** fetching or streaming the file (delegated to the
  route); deciding whether to render (delegated to the caller, unchanged).
- **Props:** `token: string` (new, required — builds the proxy URL);
  `pdfUrl: string` (still required — the caller uses its truthiness to decide
  whether to render `DeckDownload` at all, even though the component itself
  no longer uses the value for `href`); `title: string` (unchanged).
- **State:** none (still no `"use client"` needed).

### `next/app/(portal)/portal/[token]/page.js` — server component (modified)

- **Responsible for:** passing `token={params.token}` to `DeckDownload` in
  addition to the existing `pdfUrl`/`title` props. No other change — the
  `download` computation and its inclusion in both unlocked branches stays
  exactly as `deck-pdf-download.md` left it.

### `next/queries/deckQuery.js` — module (modified)

- **Responsible for:** `getDeckForRender`'s `select` changes from `pdf: {
  query: "page.pdf.toFile", select: { url: true } }` to `pdfUrl:
  "page.pdf_url.value"`; the returned object's `pdfUrl` line changes from
  `result.pdf?.url || ""` to `result.pdfUrl || ""`.
- **Not responsible for:** anything about the download route or filename
  logic.

### Kirby `cms/site/blueprints/pages/deck.yml` — modified (SiteGround upload)

- Replace the `pdf` files field with `pdf_url`: `type: url`, `label: PDF
  URL`, `help: Link to a PDF hosted elsewhere (Google Drive, Dropbox, etc).
  For Google Drive, a normal share link works. Test the link in a private
  browser window first to confirm it's accessible without a Google
  account.`

## 7. Files Affected

### Kirby (SiteGround file manager)

| File | Mod | Why |
| --- | --- | --- |
| `cms/site/blueprints/pages/deck.yml` | Mod | Replace the `pdf` file upload field with a `pdf_url` link field. |

### Next

| File | New/Mod | Why |
| --- | --- | --- |
| `next/queries/deckQuery.js` | Mod | `getDeckForRender` reads `pdf_url` as a plain value instead of resolving a file. |
| `next/utility/filename.js` | New | Shared filename sanitisation, used by both the component and the route. |
| `next/utility/driveDownload.js` | New | Google Drive URL detection, rewriting, and confirm-token extraction. |
| `next/app/(portal)/portal/[token]/pdf/route.js` | New | The gated proxy/download endpoint. |
| `next/components/DeckDownload.js` | Mod | Links to the proxy route instead of the raw `pdfUrl`; imports the shared sanitiser. |
| `next/app/(portal)/portal/[token]/page.js` | Mod | Passes `token` to `DeckDownload`. |

Unaffected: `deckAccess.js`, `deckSession.js`, `unlock/route.js`,
`PasswordGate.js`, `DeckEmbed.js`, `(portal)/layout.js`, `deck.css` (no
styling change — `.deck-download` stays as-is).

## 8. Step-by-Step Implementation

### Step 1 — `next/utility/filename.js`

- Move `sanitiseFilename` out of `DeckDownload.js` verbatim (trim, replace
  `\ / : * ? " < > |` with `-`, fallback `"Deck"`, append `.pdf`).
- Add `sanitiseFilenameAscii(title)`: run the same trim/replace/fallback
  logic, then additionally strip any character whose code point falls
  outside `0x20`–`0x7E` before appending `.pdf`.
- Why first: both the component (Step 5) and the route (Step 4) depend on
  this module existing.
- Gotcha: keep the two functions' shared logic obviously identical (same
  replace pattern, same fallback) so they only ever differ in the ASCII
  strip — a future filename rule change should not require editing both
  independently by hand without noticing the duplication.

### Step 2 — `next/utility/driveDownload.js`

- `isGoogleDriveUrl(url)`: parse with the `URL` constructor in a `try`
  (invalid input → `false`); return true if `hostname` is `drive.google.com`.
- `driveFileIdFrom(url)`: try, in order, a regex for `/file/d/([\w-]+)/` and
  a regex for `[?&]id=([\w-]+)`; return the first match's capture group or
  `null`.
- `buildDriveDownloadUrl(id, confirmToken)`: return
  `` `https://drive.google.com/uc?export=download&id=${id}` ``, appending
  `` `&confirm=${confirmToken}` `` when `confirmToken` is provided.
- `extractDriveConfirmToken(html)`: regex search for `confirm=([0-9A-Za-z_-]+)`
  in the given string; return the first match or `null`.
- Why after Step 1: independent of it, but ordered here to keep the two
  small "pure logic" utilities together before the route that composes them.
- Gotcha: this module intentionally does not fetch anything — keeping it
  pure makes the URL-rewriting logic testable without a live Drive link, and
  isolates the one genuinely uncertain, Google-controlled behaviour (the
  interstitial/confirm-token shape) from the request-handling code in the
  route.
- Connects to: used by Step 4.

### Step 3 — `next/queries/deckQuery.js`

- In `getDeckForRender`, replace the `pdf: { query: "page.pdf.toFile",
  select: { url: true } }` entry in `select` with `pdfUrl: "page.pdf_url.value"`.
- Replace the returned object's `pdfUrl: result.pdf?.url || ""` with
  `pdfUrl: result.pdfUrl || ""`.
- Why now: the route (Step 4) and the page (Step 6) both need `meta.pdfUrl`
  to mean "the external URL string," not "a resolved Kirby file object."
- Gotcha: `pdf_url` is not a reserved Kirby model method (checked against the
  same `allowedMethodsForFiles()`/`allowedMethodsForModels()` lists that
  previously forced the `visual`/`body` renames), so it resolves as a normal
  content field.
- Connects to: every later step.

### Step 4 — `next/app/(portal)/portal/[token]/pdf/route.js`

- `export const dynamic = "force-dynamic"`.
- `export async function GET(request, { params })`:
  1. `const { status, meta } = await resolveDeckAccess(params.token)`.
  2. If `status !== "unlocked"`, return `new Response(null, { status:
     status === "notfound" ? 404 : 401 })`.
  3. If `!meta.pdfUrl`, return `new Response(null, { status: 404 })`.
  4. Determine the fetch target: if `isGoogleDriveUrl(meta.pdfUrl)`, find
     `driveFileIdFrom(meta.pdfUrl)`; if an id is found, fetch target =
     `buildDriveDownloadUrl(id)`; if no id is found, fall back to
     `meta.pdfUrl` unchanged (cannot rewrite what it cannot parse).
  5. `let upstream = await fetch(target)`, guarded by `try/catch` — on
     failure return `new Response("Could not reach the file host.", {
     status: 502 })`.
  6. If the URL was a recognised Drive link with an id, and
     `upstream.headers.get("content-type")?.startsWith("text/html")`: read
     `await upstream.text()`, call `extractDriveConfirmToken`; if a token is
     found, refetch `buildDriveDownloadUrl(id, token)` into `upstream`; if no
     token is found, or the refetch is still `text/html`, return `new
     Response("This file could not be downloaded from Google Drive. Try a
     different host or check the file's sharing settings.", { status: 502 })`.
  7. Build the filename: `sanitiseFilename(meta.title)` for the RFC 6266
     `filename*=` (percent-encoded via `encodeURIComponent`) and
     `sanitiseFilenameAscii(meta.title)` for the plain `filename=` fallback.
  8. Return `new Response(upstream.body, { headers: { "Content-Type":
     upstream.headers.get("content-type") || "application/pdf",
     "Content-Disposition": \`attachment; filename="${asciiName}";
     filename*=UTF-8''${encodeURIComponent(fullName)}\`, "Cache-Control":
     "private, no-store" } })`.
- Why after Steps 1–3: depends on the filename utility, the Drive utility,
  and `meta.pdfUrl` meaning a plain URL string.
- Gotcha: step 6's `text/html` check only applies when the URL was
  recognised as a parseable Drive link — a non-Drive host that happens to
  return HTML (e.g., a broken or expired share link) is not specially
  handled and is streamed through as-is, which will produce a browser-saved
  file that is actually an HTML error page; this is the accepted limitation
  from Section 9, not a bug to chase further here.
- Gotcha: streaming `upstream.body` directly (a `ReadableStream`) avoids
  buffering the whole PDF in the function's memory; only the Drive
  interstitial page (small HTML) is ever read fully with `.text()`.
- Connects to: called by the link `DeckDownload` (Step 5) renders.

### Step 5 — `next/components/DeckDownload.js`

- Replace the local `sanitiseFilename` function with `import {
  sanitiseFilename } from "../utility/filename";`.
- Add `token` to the destructured props.
- Change the `<a>`'s `href` from `{pdfUrl}` to `` {`/portal/${token}/pdf`} ``.
  Keep `download={sanitiseFilename(title)}` and the rest of the markup
  unchanged.
- Why after Step 4: the `href` now points at a route that must already exist
  for this to be testable end to end, though the edit itself has no runtime
  dependency ordering concern.
- Connects to: rendered by Step 6 with the new `token` prop.

### Step 6 — `next/app/(portal)/portal/[token]/page.js`

- In the `download` computation (`const download = meta.pdfUrl ? <DeckDownload
  ... /> : null;`), add `token={params.token}` to the `DeckDownload` props.
- Why last among the code changes: the smallest possible edit, done once the
  component it calls (Step 5) expects the new prop.

### Step 7 — Kirby blueprint change (SiteGround)

- Edit `cms/site/blueprints/pages/deck.yml`: replace the `pdf` files field
  with `pdf_url` as specified in Section 6. Upload.
- On the test deck used for `deck-pdf-download.md`, clear the old uploaded
  PDF's field value (it will be gone from the form once the field type
  changes) and paste a real external PDF URL — a small Google Drive-hosted
  test PDF is the most useful case to verify first, since it is both the
  named use case and the one with the extra rewrite/interstitial logic.
- Why last: everything else can be built and reviewed without a live URL;
  this is what makes it testable end to end.

### Step 8 — Build and manual QA

- `npm run build` in `next/`. Expect a new route,
  `/portal/[token]/pdf`, alongside the existing `/portal/[token]` and
  `/portal/[token]/unlock`.
- Then the checks in Section 10.

## 9. Edge Cases

- **`pdf_url` empty.** Unchanged from `deck-pdf-download.md` — no download
  control renders (gated by `meta.pdfUrl` truthiness in `[token]/page.js`,
  untouched by this plan).
- **Google Drive interstitial appears even after the confirm-token retry, or
  no token can be found.** The route returns a 502 with a short plain-text
  explanation; the browser shows that as a failed navigation/download rather
  than saving an HTML file mislabelled as a PDF.
- **Google Drive changes its interstitial/confirm mechanism.** This plan's
  Drive handling would need updating; documented in Section 4 as a known,
  accepted fragility rather than something guarded against further here.
- **A non-Drive host returns HTML (broken link, login wall, expired
  share).** Streamed through as-is with a forced `.pdf` filename; the
  downloaded file will not open correctly. No detection beyond the
  Drive-specific check exists for other hosts — mitigated only by the
  authoring guidance in the blueprint's help text (test the link first).
- **Upstream host unreachable or times out.** The `fetch` in Step 4's point
  5 is wrapped in `try/catch`; failure returns a 502 rather than an unhandled
  server error.
- **Very large file over a slow upstream connection.** Possible to approach
  a serverless function's execution-time limit since the whole proxy happens
  within one request; not solved in this plan (see Section 4's closing
  paragraph).
- **Deck title with non-ASCII characters.** Handled by the dual
  `filename="..."` / `filename*=UTF-8''...` header construction in Step 4;
  the ASCII fallback still produces a valid (if less pretty) filename for
  clients that only honour the plain form.
- **Session expires between page load and download click.** Correctly
  refused (401/403) — this is the auth-freshness improvement noted in
  Section 4, not a regression to guard against.
- **Unknown or expired token hit directly at `/portal/<token>/pdf` without
  ever visiting the page.** `resolveDeckAccess` returns `notfound`/`expired`
  exactly as it would for the page route; handled identically (404/401).
- **A deck's `pdf_url` is pasted as a Drive "open?id=" link instead of a
  "file/d/" link.** `driveFileIdFrom` checks both patterns, so either form
  is recognised.
- **A Drive link with an id that cannot be parsed (an unusual or malformed
  URL).** Falls back to fetching `meta.pdfUrl` unchanged, per Step 4 point 4
  — same handling as any other unrecognised host.

## 10. Test Considerations

**Prerequisites**

- Kirby `deck.yml` updated per Step 7.
- A small Google Drive-hosted PDF, shared as "Anyone with the link," pasted
  into a test deck's `pdf_url` — small enough to confirm the basic path
  works before testing the interstitial case.
- If possible, a larger Drive-hosted PDF (or one Drive otherwise declines to
  scan) to exercise the confirm-token retry path.
- A PDF hosted on a second, non-Drive host (e.g., Dropbox with `?dl=1`, or
  any direct-link CDN) to confirm the generic (non-Drive) path.

**Manual**

1. Unlock a deck with a small Drive-hosted `pdf_url` → click the download
   control → the PDF downloads immediately with filename `<deck title>.pdf`,
   not Drive's internal filename.
2. Repeat with a larger/interstitial-triggering Drive file → confirm the
   retry succeeds and the real PDF downloads (not an HTML file).
3. Repeat with a non-Drive direct-link host → confirm it downloads correctly
   with no Drive-specific logic involved.
4. Confirm download speed is markedly better than the Kirby-hosted version
   from `deck-pdf-download.md`.
5. Visit `/portal/<token>/pdf` directly in a fresh browser with no session
   cookie → 401/403, no file served.
6. Unlock, then manually clear the `deck_session` cookie, then hit
   `/portal/<token>/pdf` directly → refused, not served from a stale page
   state.
7. Set the deck's `expiry` to yesterday, then hit `/portal/<token>/pdf`
   directly (even with an otherwise-valid cookie) → refused.
8. Clear `pdf_url` on a deck → download control disappears from the page (as
   in `deck-pdf-download.md`), and `/portal/<token>/pdf` returns 404 if hit
   directly.
9. Test a deck title containing accented or non-Latin characters → confirm
   the download still succeeds and the saved filename is sensible in at
   least one modern browser.
10. Point `pdf_url` at a broken/expired Drive link → confirm a clear failure
    (502) rather than a corrupted download.

**Regression**

11. Deck embed (`DeckEmbed`), the gate flow, and every state from
    `deck-figma-embed.md` remain unchanged for decks with and without a
    `pdf_url` set.

**Build**

12. `npm run build` clean, from a clean `.next` and with no other Next
    process (`npm run dev`) running concurrently against the same directory
    — the previous session hit a stale-cache build failure specifically
    from overlapping `dev`/`build` runs; stop `npm run dev` first.

**Automated**

- Reasonable candidates given this plan's genuinely tricky logic: unit tests
  for `driveFileIdFrom` (both URL shapes, and a non-Drive URL returning
  `null`), `extractDriveConfirmToken` (present and absent cases against a
  saved sample of Drive's interstitial HTML if one can be captured), and
  `sanitiseFilename`/`sanitiseFilenameAscii` (a title with accented
  characters, one with filesystem-unsafe punctuation, an empty title).

## 11. Implementation Order

1. `next/utility/filename.js` — **new** — shared by both later consumers.
2. `next/utility/driveDownload.js` — **new** — independent, pure Drive URL
   logic, needed by the route.
3. `next/queries/deckQuery.js` — **modify** — `pdfUrl` now means a plain
   external URL string; needed by the route and the page.
4. `next/app/(portal)/portal/[token]/pdf/route.js` — **new** — composes
   Steps 1–3; the core of this plan.
5. `next/components/DeckDownload.js` — **modify** — points at the new route;
   depends on it existing to be meaningfully testable.
6. `next/app/(portal)/portal/[token]/page.js` — **modify** — passes `token`
   through to the updated component.
7. `cms/site/blueprints/pages/deck.yml` — **modify (SiteGround)** — swap the
   file field for the URL field; set a real test URL.
8. Build (from a clean `.next`, with `next dev` stopped), then run the
   Section 10 checks against a Drive-hosted PDF and a non-Drive-hosted PDF.
