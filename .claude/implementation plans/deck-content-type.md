# Implementation Plan: Deck Content Type (Figma or Uploaded PDF)

## 1. Goal

Let each deck in Kirby be configured as *either* a Figma embed *or* an
uploaded PDF, never both, chosen by an explicit field. The portal renders
whichever is configured: the existing Figma iframe embed, or the PDF
rendered in-browser with `react-pdf` (all pages, continuous scroll — this
plan intentionally stops short of any visual/navigation polish, which is a
follow-up styling pass). This supersedes the external-URL PDF download
machinery from `deck-pdf-proxy.md`, which is removed outright rather than
kept alongside.

## 2. Current System Behaviour

- **Kirby.** `cms/site/blueprints/pages/deck.yml` (SiteGround, not
  version-controlled) has `title`, `client`, `password`, `expiry`,
  `figma_url` (a `url` field), `pdf_url` (a `url` field, holding an
  externally-hosted PDF link — Google Drive or similar), and `client_link`
  (an `info` field showing the portal URL).
- **Query.** `next/queries/deckQuery.js`'s `getDeckForRender(token)` selects
  `title`, `client`, `parentSlug`, `intro`, `expiry`, `figmaUrl`
  (`page.figma_url.value`), `pdfUrl` (`page.pdf_url.value`), returning
  `null` unless `parentSlug === "decks"`. `getDeckSecret(token)` is separate
  (`password`, `expiry`, `parentSlug`), used only by the unlock route.
- **Access.** `next/utility/deckAccess.js`'s `resolveDeckAccess(token)`
  returns `{ status: "notfound" | "expired" | "locked" | "unlocked", meta }`,
  unchanged and reused here.
- **Route.** `next/app/(portal)/portal/[token]/page.js` — after the `locked`
  branch, computes `download = meta.pdfUrl ? <DeckDownload token pdfUrl
  title /> : null`, includes it in both the "not ready" (no `figmaUrl`) and
  the `DeckEmbed` returns.
- **Components.** `next/components/DeckEmbed.js` (client) renders the Figma
  iframe with a fade-out loader (`buildEmbedSrc` wraps any non-`/embed`
  Figma URL with `embed_host=`/`url=`). `next/components/DeckDownload.js`
  (server) renders a fixed top-right `<a href="/portal/<token>/pdf"
  download="<sanitised title>.pdf">` — its visible label currently has a
  `hidden` class (added in a recent "remove download button" commit; the
  component and route are still functionally present).
- **PDF download proxy.** `next/app/(portal)/portal/[token]/pdf/route.js`
  (`GET`) calls `resolveDeckAccess`, refuses anything but `unlocked`, resolves
  Google Drive share links via `next/utility/driveDownload.js`
  (`isGoogleDriveUrl`, `driveFileIdFrom`, `buildDriveDownloadUrl`,
  `parseDriveConfirmForm`, `buildDriveUserContentUrl` — handles Drive's
  hidden-form virus-scan-warning interstitial), fetches the resolved URL, and
  streams it back with a `Content-Disposition: attachment` header built via
  `next/utility/filename.js` (`sanitiseFilename`, `sanitiseFilenameAscii`).
- **Styling.** `next/styles/deck.css` has `:root { --deck-header-h: 80px; }`,
  `.deck-embed`/`.deck-embed__frame`/`.deck-embed__loader` (the Figma embed),
  and `.deck-download` (fixed top-right, aligned with the header).
- **Portal shell (unaffected).** `next/app/(portal)/layout.js` renders the
  FLOWERS logo header and a flush content wrapper; `next/app/error.js` is an
  unrelated generic client-side error boundary added since. Neither is
  touched by this plan.
- **No PDF-rendering library is installed.** `next/package.json` has no
  `react-pdf` or `pdfjs-dist` dependency.
- **Nothing in production depends on the old field names** in a way this
  plan needs to migrate — consistent with every prior deck plan this
  project, blueprint field changes are applied directly rather than run in
  parallel.

## 3. Desired Behaviour

- The deck edit form in Kirby has a `content_type` field (select: "Figma" or
  "PDF", required, no default so staff must choose). `figma_url` is shown
  only when `content_type` is Figma; a new `pdf_file` upload field (single
  PDF) is shown only when `content_type` is PDF. The previous `pdf_url`
  field is removed.
- On `/portal/<token>`, once unlocked:
  - `content_type` is Figma and `figma_url` is set → the existing
    `DeckEmbed` iframe, unchanged.
  - `content_type` is PDF and `pdf_file` is uploaded → the PDF renders
    in-browser: every page, full-width, stacked vertically, native scroll.
    No page-by-page navigation controls, no styling pass — that is
    explicitly deferred.
  - Either `content_type` with its corresponding field empty (not yet
    configured), or no `content_type` chosen at all → "This deck is not
    ready yet." (same message and styling used today for a missing
    `figma_url`).
- There is no more download link, download route, or PDF-download-specific
  handling of any kind (Google Drive rewriting, forced attachment headers,
  filename sanitisation) — all of that is removed. Viewing a PDF *is* the
  feature now; a separate "download it" affordance is not part of this
  plan and can be added later if wanted.
- The PDF is served from its plain Kirby file URL, loaded directly by the
  viewer — same trade-off already accepted for deck images and the Figma
  URL itself: the file is only reachable via a URL that isn't shown to the
  visitor until they're past the password gate, but a leaked URL itself
  carries no further protection.

## 4. Architecture Considerations

**One explicit field decides the mode, not inference from which field is
filled.** A `content_type` select makes the "either/or" intent literal and
avoids ambiguous states (e.g., both `figma_url` and `pdf_file` accidentally
populated — which should win?). Kirby's `when` condition then only shows the
relevant field in the Panel, so staff are not looking at two mostly-empty,
mutually-irrelevant fields.

**The PDF-download machinery from `deck-pdf-proxy.md` is deleted, not kept
alongside.** That entire feature (external URL, Google Drive rewriting, the
gated proxy route, forced-attachment filenames) existed to make a link *to* a
PDF hosted elsewhere download correctly. None of it applies once the PDF is
an uploaded Kirby file rendered in-browser — there is no external host to
proxy around, and "view it" replaces "download it" as the interaction
entirely. Keeping the dead code would leave two unrelated, confusing PDF
code paths in the project for no benefit.

**Going back to a Kirby-uploaded file is a deliberate reversal of the
`deck-pdf-download.md` → `deck-pdf-proxy.md` move, and the reason for that
earlier move (slow downloads through Kirby/SiteGround) has not gone away.**
This plan accepts that risk explicitly rather than re-solving it, for two
reasons: first, it's what was asked for; second, serving the file at its
plain Kirby URL (rather than through a proxy, per the confirmed choice) lets
the browser and `react-pdf` use standard HTTP range requests to fetch and
render pages progressively, which is a meaningfully better position than the
earlier download route's full-buffer-then-attachment approach — a large PDF
can start rendering its first page before the whole file has transferred,
rather than the browser waiting for a complete download before anything
happens. If a specific uploaded deck PDF turns out to be too large or slow
in practice, that is a real risk this plan does not otherwise mitigate.

**`react-pdf`, used only as a client component, dynamically imported with
SSR disabled.** `pdfjs-dist` (which `react-pdf` wraps) does browser-only work
(canvas, a Web Worker) that is not safe to evaluate during server rendering.
The standard, documented pattern for this in the Next.js App Router is: the
PDF-rendering logic lives in its own `"use client"` component, and the
*server* component that would otherwise render it imports that component via
`next/dynamic(..., { ssr: false })` instead of a normal `import`, which
skips server-side rendering of that subtree entirely. This is called out as
the one area of this plan needing verification against `react-pdf`'s current
documentation during implementation (Step 4) rather than assumed correct
from memory — worker-loading setup in particular (`pdfjs.GlobalWorkerOptions.
workerSrc`) has changed across `pdfjs-dist` versions, and this plan specifies
pointing it at a CDN URL built from the installed package's own reported
version (`pdfjs.version`) specifically so it cannot drift out of sync with
whatever gets installed.

**No page-navigation UI, no responsive sizing, no visual design in this
plan.** Explicitly deferred, per the request. The viewer renders every page
at a fixed placeholder width; the follow-up styling plan owns making this
look and behave like a finished feature (responsive width, possibly a
page-by-page mode, loading states, etc.).

**No new dependency for the Figma side.** `DeckEmbed` is untouched.

## 5. Data Flow

**Authoring.** A staff member opens a deck in the Kirby Panel, chooses
`content_type`, and fills in the field that choice reveals: a Figma URL, or
an uploaded PDF file. Kirby stores whichever is relevant; the other field's
blueprint entry does not even show in the form.

**Request.** A client requests `/portal/<token>`. `resolveDeckAccess`
(unchanged) returns `meta` including the new `contentType` and (depending on
type) `figmaUrl` or `pdfUrl` — the latter now sourced from the uploaded
file's Kirby URL rather than an external link. The route branches: `locked`/
`expired`/`notfound` exactly as today; `unlocked` with `contentType ===
"figma"` and a `figmaUrl` renders `DeckEmbed`; `unlocked` with `contentType
=== "pdf"` and a `pdfUrl` renders `DeckPdfViewer` (dynamically imported,
`ssr: false`); anything else renders the "not ready" message.

**PDF render.** `DeckPdfViewer` receives the Kirby file URL as a prop,
passes it as `<Document file={pdfUrl}>`'s `file` prop, and on
`onLoadSuccess` learns `numPages`; it then renders `numPages` `<Page>`
components in order. Each `<Page>` triggers its own fetch (via `pdfjs`'s
internal HTTP client, using range requests where the server supports them)
for the bytes it needs — the browser talks directly to Kirby's file URL, not
through any Next.js route.

## 6. Component Responsibilities

### `next/queries/deckQuery.js` — module (modified)

- **Responsible for:** `getDeckForRender` gains `contentType:
  "page.content_type.value"` in its `select` and returned object. The `pdf`
  select entry changes from a plain value read (`page.pdf_url.value`) back
  to a file resolution: `pdf: { query: "page.pdf_file.toFile", select: {
  url: true } }`, with the returned `pdfUrl` becoming `result.pdf?.url ||
  ""`.
- **Not responsible for:** deciding which content type to render (that's the
  route's job) or anything about `react-pdf`.

### `next/components/DeckPdfViewer.js` — client component (new)

- **Responsible for:** setting `pdfjs.GlobalWorkerOptions.workerSrc` once
  (module scope, not per-render); rendering `<Document file={pdfUrl}>` with
  a `loading` element (reusing the same simple "Loading deck…" treatment
  `DeckEmbed` already uses, for consistency until the later styling pass);
  on successful load, storing `numPages` and rendering that many `<Page>`
  components stacked in a scrollable container.
- **Not responsible for:** navigation between pages, responsive sizing,
  download/export, auth, fetching `pdfUrl` (received as a prop).
- **Props:** `pdfUrl: string` (required).
- **State:** `numPages: number | null`.

### `next/app/(portal)/portal/[token]/page.js` — server component (modified)

- **Responsible for:** unchanged `notfound`/`expired`/`locked` branches
  (`DeckDownload`/`download` computation removed). On `unlocked`, branching
  on `meta.contentType` and the corresponding URL/file field: Figma →
  `DeckEmbed`; PDF → the dynamically-imported `DeckPdfViewer`; neither
  satisfied → the "not ready" message (now the sole fallback, since there is
  no more independent download control to show alongside it).
- **Not responsible for:** any PDF-rendering logic, any Figma-embed logic
  (both delegated to their components).

### `next/components/DeckEmbed.js` — unchanged

### Kirby `cms/site/blueprints/pages/deck.yml` — modified (SiteGround upload)

- Add `content_type`: `type: select`, `label: Content Type`, `required:
  true`, `options: { figma: Figma, pdf: PDF }`.
- `figma_url` gains `when: { content_type: figma }`.
- Replace `pdf_url` with `pdf_file`: `type: files`, `label: PDF`, `multiple:
  false`, `accept: application/pdf`, `when: { content_type: pdf }`, `help:
  The PDF is shown directly on the portal page.`
- `title`, `client`, `password`, `expiry`, `client_link` unchanged.

## 7. Files Affected

### Kirby (SiteGround file manager)

| File | Mod | Why |
| --- | --- | --- |
| `cms/site/blueprints/pages/deck.yml` | Mod | Add `content_type`; conditionally show `figma_url`; replace `pdf_url` with `pdf_file`. |

### Next

| File | New/Mod/Del | Why |
| --- | --- | --- |
| `next/package.json` | Mod | Add `react-pdf`. |
| `next/queries/deckQuery.js` | Mod | Add `contentType`; `pdfUrl` sourced from an uploaded file again. |
| `next/components/DeckPdfViewer.js` | New | Renders the uploaded PDF, all pages, continuous scroll. |
| `next/app/(portal)/portal/[token]/page.js` | Mod | Branch on `contentType`; drop the download control. |
| `next/components/DeckDownload.js` | Del | Superseded — viewing replaces downloading. |
| `next/app/(portal)/portal/[token]/pdf/route.js` | Del | No more external file to proxy. |
| `next/utility/driveDownload.js` | Del | Only used by the deleted route. |
| `next/utility/filename.js` | Del | Only used by the deleted route/component (confirm no other importer before deleting — see Step 7). |
| `next/styles/deck.css` | Mod | Remove `.deck-download`; add a minimal `.deck-pdf-viewer` baseline. |

Unaffected: `deckAccess.js`, `deckSession.js`, `unlock/route.js`,
`PasswordGate.js`, `DeckEmbed.js`, `(portal)/layout.js`, `(site)/layout.js`,
`app/layout.js`, `app/error.js`, everything under the public site.

## 8. Step-by-Step Implementation

### Step 1 — `next/package.json`

- Add `react-pdf` to `dependencies`. Install.
- Why first: every later Next step depends on it being resolvable.
- Gotcha: note the installed `react-pdf`/`pdfjs-dist` versions once done —
  Step 4's worker-URL construction and the exact import shape
  (`import { Document, Page, pdfjs } from "react-pdf"`) should be checked
  against that specific version's current documentation, not assumed.

### Step 2 — `next/queries/deckQuery.js`

- Add `contentType: "page.content_type.value"` to `getDeckForRender`'s
  `select` and `contentType: result.contentType || ""` to its returned
  object.
- Change the `pdfUrl` select entry from `pdfUrl: "page.pdf_url.value"` to
  `pdf: { query: "page.pdf_file.toFile", select: { url: true } }`, and the
  returned `pdfUrl` line from `result.pdfUrl || ""` to `result.pdf?.url ||
  ""`.
- Why now: both later branches (Steps 5, 6) depend on `meta.contentType` and
  the file-resolved `meta.pdfUrl`.
- Gotcha: `content_type` and `pdf_file` are not reserved Kirby model methods
  (checked against the same `allowedMethodsForFiles()`/
  `allowedMethodsForModels()` lists used to catch this earlier in the
  project), so both resolve as ordinary content fields.
- Connects to: Step 6.

### Step 3 — Kirby blueprint change (SiteGround)

- Edit `deck.yml` per Section 6. Upload.
- On the deck used for testing, set `content_type` to PDF and upload a real,
  reasonably-sized PDF into `pdf_file`; on a second test deck (or by
  switching back and forth on the same one later), confirm the Figma path
  still works with `content_type` set to Figma.
- Why here, early: unblocks testing everything that follows with real data.
- Gotcha: any deck previously using the removed `pdf_url` field loses that
  value once the field is removed from the blueprint (its content stays in
  the `.txt` file, just unreferenced) — acceptable per Section 4, nothing in
  production depends on it.

### Step 4 — `next/components/DeckPdfViewer.js`

- `"use client"`.
- `import { Document, Page, pdfjs } from "react-pdf";` at module scope, then
  set `pdfjs.GlobalWorkerOptions.workerSrc =
  \`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs\`;`
  once, outside the component function (so it runs a single time per module
  load, not per render).
- `const [numPages, setNumPages] = useState(null);`
- Render a wrapper `div.deck-pdf-viewer` containing `<Document
  file={pdfUrl} onLoadSuccess={({ numPages }) => setNumPages(numPages)}
  loading={<p className="font-secondary text-md">Loading deck…</p>}>` and,
  once `numPages` is known, `Array.from({ length: numPages }, (_, i) => i +
  1).map((pageNumber) => <Page key={pageNumber} pageNumber={pageNumber}
  width={800} />)` inside it.
- Why after Steps 1–3: needs the dependency installed and a real file to
  render against.
- Gotcha (flagged per Section 4): verify the worker URL/extension
  (`.mjs` vs `.js`) and the `Document`/`Page` prop names against whatever
  `react-pdf` version Step 1 actually installed — these have changed across
  major versions. If the CDN worker approach does not load cleanly, the
  documented fallback is importing the worker from the installed package
  directly (`new URL("pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url)`), which requires no CDN dependency but is more sensitive
  to the bundler's handling of `import.meta.url` — try the CDN approach
  first as specified, since it is simpler and version-safe by construction.
- Gotcha: the `width={800}` is a placeholder, explicitly not a finished
  responsive design — acceptable per Section 4/the request.
- Connects to: rendered by Step 6.

### Step 5 — `next/app/(portal)/portal/[token]/page.js`

- Remove `import DeckDownload from "../../../../components/DeckDownload";`
  and the `download` computation.
- Add, at the top of the file: `import dynamic from "next/dynamic";` and
  `const DeckPdfViewer = dynamic(() => import("../../../../components/
  DeckPdfViewer"), { ssr: false });` (module scope, not inside the component
  function).
- Replace the final two branches:
  - if `meta.contentType === "figma" && meta.figmaUrl`, return `<DeckEmbed
    figmaUrl={meta.figmaUrl} />`;
  - else if `meta.contentType === "pdf" && meta.pdfUrl`, return
    `<DeckPdfViewer pdfUrl={meta.pdfUrl} />`;
  - else, return the existing "This deck is not ready yet." block (no
    longer paired with a `download` sibling).
- Why after Step 4: the dynamic import target must exist.
- Gotcha (flagged per Section 4): confirm at build/dev time that
  `next/dynamic(..., { ssr: false })` is accepted at this call site — it is
  called from a Server Component to load a `"use client"` component, which
  is the documented supported case, but this is exactly the kind of API
  detail this plan flags for verification rather than assumes. If Next
  rejects it, the fallback is moving this dynamic import into a small new
  client component that itself renders `DeckPdfViewer`, and rendering that
  wrapper from the page instead — a one-file, mechanical fix if needed.
- Connects to: the last piece wiring the content-type branch together.

### Step 6 — delete `next/components/DeckDownload.js`

- Confirm (grep) no remaining importers after Step 5. Delete.

### Step 7 — delete `next/app/(portal)/portal/[token]/pdf/route.js` and the `pdf` directory

- Delete the file; remove the now-empty `pdf/` directory.
- Grep for `getImportPage`-style leftovers or any other reference to this
  route path (e.g. in `DeckDownload.js`, already deleted in Step 6) to
  confirm nothing else links to `/portal/<token>/pdf`.

### Step 8 — delete `next/utility/driveDownload.js`

- Confirm (grep for `driveDownload`) its only importer was the route deleted
  in Step 7. Delete.

### Step 9 — delete `next/utility/filename.js`

- Confirm (grep for `sanitiseFilename` and `sanitiseFilenameAscii`) no
  remaining importers (the route from Step 7 and the component from Step 6
  were the only two). Delete.
- Gotcha: if anything unexpected still imports this module, stop and report
  it rather than deleting — per Section 7's note, this should be confirmed,
  not assumed.

### Step 10 — `next/styles/deck.css`

- Remove the `.deck-download` rule.
- Add a minimal `.deck-pdf-viewer` rule: enough to be usable (vertical
  stacking with spacing between pages, e.g. `display: flex; flex-direction:
  column; gap: 1rem; padding: 1.5rem; overflow-y: auto;`) without attempting
  any real visual design — consistent with Section 4's explicit scope limit.
- Why last among the code changes: only meaningful once `DeckPdfViewer`'s
  class name (Step 4) is settled.

### Step 11 — Build and manual QA

- `npm run build` in `next/`, from a clean `.next` and with no `npm run dev`
  process running concurrently (this project has hit stale-cache build
  failures from overlapping `dev`/`build` runs before).
- Then the checks in Section 10.

## 9. Edge Cases

- **`content_type` is Figma but `figma_url` is empty.** "Not ready" message
  — unchanged behaviour from before this plan.
- **`content_type` is PDF but no file is uploaded.** Same "not ready"
  message (the `meta.pdfUrl` check fails).
- **`content_type` left unset entirely (new deck, not yet configured).**
  Falls through to "not ready" — neither branch's condition is met.
- **A large uploaded PDF loads slowly.** Accepted risk, discussed in
  Section 4; direct-URL serving with range-request support is the best
  available mitigation without rebuilding the proxy this plan removes.
- **`react-pdf`'s worker fails to load (network-blocked CDN, mismatched
  version).** The `Document` component's own error state would show
  (react-pdf surfaces a load error via its `error` render prop, not used
  explicitly in this minimal version, so a failure would currently just
  leave the `loading` element or a default error message — refining this is
  left to the later styling pass, not this plan).
- **Switching a deck from PDF back to Figma (or vice versa) in the Panel.**
  Immediately reflected on next page load — nothing is cached beyond the
  existing `no-store` KQL fetch behaviour already in place.
- **Old decks still holding the removed `pdf_url` value.** Orphaned,
  harmless, never read again — consistent with how this project has handled
  every previous field removal.
- **`PORTAL_SESSION_SECRET` missing / session invalid.** Unchanged — the
  gate stays locked regardless of `content_type`.

## 10. Test Considerations

**Prerequisites**

- Kirby `deck.yml` updated per Step 3; one test deck set to `content_type:
  figma` with a working `figma_url`; the same or another test deck set to
  `content_type: pdf` with a real, moderately-sized PDF uploaded to
  `pdf_file`.

**Manual**

1. Unlock the Figma-type deck → `DeckEmbed` renders exactly as before.
2. Unlock the PDF-type deck → every page of the PDF renders, stacked,
   scrollable; no page is missing or duplicated (compare `numPages` against
   the actual file).
3. Set `content_type` to PDF but delete the uploaded file → "not ready"
   message.
4. Leave `content_type` unset on a fresh test deck → "not ready" message.
5. Confirm there is no download link or button anywhere on either deck type
   now.
6. Confirm the gate flow (locked/expired/wrong password) is unaffected for
   both content types.
7. Confirm `/portal/<token>/pdf` no longer resolves to anything (404, since
   the route file is deleted).
8. Open the network panel while viewing a PDF deck and confirm requests go
   directly to the Kirby file host, not through the Next app.

**Regression**

9. Public site routes and every other portal behaviour (session, expiry,
   `PasswordGate`) unchanged.

**Build**

10. `npm run build` clean, per Step 11's conditions (no concurrent `dev`
    process, clean `.next`).

**Automated**

- Not warranted given this plan's size and the explicit deferral of any
  real UI; if useful later, the most valuable addition would be around the
  content-type branching logic in the page component once it stabilises
  post-styling-pass, not the `react-pdf` rendering itself.

## 11. Implementation Order

1. `next/package.json` — **modify** — add `react-pdf`; nothing later
   compiles without it.
2. `next/queries/deckQuery.js` — **modify** — `contentType` + file-based
   `pdfUrl`; needed by every later Next step.
3. `cms/site/blueprints/pages/deck.yml` — **modify (SiteGround)** — the new
   field structure; upload and set real test data early so the rest is
   testable as it's built.
4. `next/components/DeckPdfViewer.js` — **new** — the PDF renderer.
5. `next/app/(portal)/portal/[token]/page.js` — **modify** — the
   content-type branch, dynamic import, drop the download control.
6. `next/components/DeckDownload.js` — **delete** — dead after Step 5.
7. `next/app/(portal)/portal/[token]/pdf/route.js` (+ its directory) —
   **delete** — dead once nothing links to it.
8. `next/utility/driveDownload.js` — **delete** — only used by Step 7's
   route.
9. `next/utility/filename.js` — **delete** — only used by Steps 6/7.
10. `next/styles/deck.css` — **modify** — drop `.deck-download`, add the
    minimal `.deck-pdf-viewer` baseline.
11. Build, then run the Section 10 checks against both a Figma-type and a
    PDF-type test deck.
