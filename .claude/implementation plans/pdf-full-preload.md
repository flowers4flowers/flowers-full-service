# PDF Full Preload

## 1. Goal

Range-based partial loading (added by the prior "PDF Proxy Range Request Support" plan) has proven unreliable in practice — pdf.js issues many small concurrent range requests through the proxy as a viewer pages through a deck, and this has caused slow/flaky loads. This plan reverts to a single full-file download per deck view: the entire PDF is fetched once up front, with a visible progress indicator, and every page is then rendered from the fully-loaded document with no further network requests.

## 2. Current System Behaviour

`components/DeckPdfViewer.js` renders `<Document file={pdfUrl} options={DOCUMENT_OPTIONS}>` from `react-pdf`, where `DOCUMENT_OPTIONS` sets `rangeChunkSize: 1024 * 1024`, `disableAutoFetch: true`, and `disableStream: false`. This configuration allows pdf.js to issue ranged, on-demand byte fetches for the PDF's internal structure and individual pages as the user navigates, rather than requiring the whole file upfront. `DeckPdfViewer` also has a `useEffect` that explicitly pre-fetches the page-proxy's neighbors: `pdfProxy.getPage(currentPage + 1)` and `pdfProxy.getPage(currentPage - 1)`, which exists specifically to smooth over the latency of on-demand range fetching by warming the next/previous page slightly ahead of navigation.

`app/(portal)/portal/[token]/pdf-file/route.js` is the same-origin proxy `pdfUrl` points to. It currently runs on the Edge runtime, reads any incoming `Range` header from the browser, forwards it to the upstream Kirby media host via `fetch(pdfUrl, { headers: { Range: range } })`, and mirrors the upstream's status (`206`/`200`) and range-related headers (`Content-Length`, `Content-Range`, `Accept-Ranges: bytes`) back to the client, streaming `upstream.body` through unchanged. It also contains three `console.log` debug statements (upstream URL, range header, request signal/method) left over from range-support debugging.

`DeckPdfMenuItem.js` uses `react-pdf`'s `Thumbnail` component with the same shared `pdf` proxy object (passed down from `DeckPdfViewer`'s `pdfProxy` state) to lazily render page thumbnails in the slideout menu as each item scrolls into view (via `IntersectionObserver`), each of which currently also triggers its own on-demand page/range fetch against the same document proxy.

The loading UI today is minimal: `<Document>`'s `loading` prop renders `<p className="font-secondary text-md">Loading deck…</p>` while the document's structure is being parsed, and `<Page>`'s `loading` prop renders `<p className="font-secondary text-md">Loading page…</p>` per-page while an individual page renders. Neither reflects download progress — there is currently no use of `react-pdf`'s `onLoadProgress` callback anywhere in the codebase.

## 3. Desired Behaviour

On opening a PDF deck, the entire file downloads in one request before any page is available. While it downloads, a visual progress bar plus a percentage label is shown in place of the current "Loading deck…" text, reflecting bytes-loaded-over-total as reported by pdf.js. Once the download completes, the document is fully available in memory/client-side cache and every subsequent page render (via the existing `<Page pageNumber={currentPage}>`) and every thumbnail render (via `Thumbnail` in the menu) is served from the already-downloaded document with no further network activity — no per-page or per-thumbnail fetches.

The existing next/prev page pre-fetch `useEffect` (`pdfProxy.getPage(...)` calls) becomes redundant once the whole document is local, since there is nothing left to pre-warm over the network — it is removed.

The proxy route (`pdf-file/route.js`) returns a plain full `200` response regardless of any `Range` header a client might still send (pdf.js will no longer send one under the new client options, but the route should not depend on client behavior to guarantee a full download) — Range forwarding, header mirroring for partial content, and the Edge runtime are all reverted, along with the leftover debug `console.log` statements.

## 4. Architecture Considerations

This plan is largely a targeted rollback of the "PDF Proxy Range Request Support" plan's proxy changes, combined with new client-side `Document` options and a new progress UI element. Reverting is preferred over leaving range support dormant in the proxy: an unused capability that silently activates itself the moment any client (now or in the future) sends a `Range` header is a latent inconsistency between client expectations (always full download) and server behavior (would honor partial requests) — removing it keeps client and server assumptions aligned and the code simpler to reason about.

Switching `Document` to full-download mode is done via `react-pdf`/pdf.js's documented options: `disableStream: true` (disables the incremental HTTP streaming/response-splitting pdf.js otherwise uses to start parsing before the full body arrives) and `disableAutoFetch: true` is already set and remains appropriate (it only affects whether pdf.js opportunistically over-fetches beyond what's requested when streaming/ranging is available — with streaming and ranging both off it has no effect, but leaving it set is harmless and avoids an unrelated behavior change). The existing `rangeChunkSize` option becomes irrelevant once ranging is disabled and can either be left in place (harmless, ignored) or removed for clarity — this plan removes it since keeping unused options around invites confusion about what's actually active.

Disabling ranging is controlled by two related but distinct pdf.js options: `disableRange` (stops pdf.js from issuing `Range` requests for on-demand page fetches) and `disableStream` (stops pdf.js from treating the response as an incrementally-parseable stream at all, forcing it to wait for the complete response body before parsing anything). Both must be set to fully force a single blocking full-file download with no incremental behavior — setting only one leaves partial incremental-loading behavior active.

Progress is surfaced via `react-pdf`'s `<Document onLoadProgress={({ loaded, total }) => ...}>` callback, which pdf.js invokes as bytes arrive during the (now single, full) fetch. This requires new component state in `DeckPdfViewer` to store the latest `{ loaded, total }` values and a small presentational treatment (progress bar + percentage) in place of the static "Loading deck…" text, using the `loading` prop's ability to accept a function/JSX. Progress bar markup and styling are added following the existing BEM-style class naming used throughout `deck.css` (e.g. `deck-pdf-viewer__progress`, `deck-pdf-viewer__progress-bar`), and placed on the existing `.deck-pdf-viewer` black background.

The proxy route is reverted to the Node.js default runtime rather than kept on Edge: Edge was specifically justified in the prior plan by the need to efficiently handle many small concurrent range requests per deck view; with a single full-file request per view, that justification no longer applies, and reverting keeps the route's behavior and runtime consistent with what it's actually doing (per user decision).

No new dependencies are introduced. This plan does not change `resolveDeckAccess`, `deckQuery.js`, or any authentication/authorization logic — access gating continues to run exactly once per (now single) request to the proxy route, unchanged.

## 5. Data Flow

`DeckPdfViewer` renders `<Document file={pdfUrl} options={DOCUMENT_OPTIONS}>`. With `disableRange: true` and `disableStream: true` set, pdf.js's worker issues a single unranged `GET` request to `/portal/[token]/pdf-file`. The proxy route resolves deck access as before, then performs a single unranged `fetch(pdfUrl, { signal: request.signal })` against the upstream Kirby host and streams the full response body back with a plain `200` status, `Content-Type: application/pdf`, and `Content-Length` when available (no `Range`/`Accept-Ranges`/`Content-Range` handling). As bytes arrive at the browser, pdf.js reports progress through the `onLoadProgress` callback, which `DeckPdfViewer` uses to update local `{ loaded, total }` state, driving the progress bar's width and the percentage text. Once the full body has arrived and pdf.js finishes parsing, `onLoadSuccess` fires exactly as it does today, setting `pdfProxy` and `numPages`, and the currently-selected `<Page pageNumber={currentPage}>` renders from the in-memory document with no further network requests. Thumbnails rendered by `DeckPdfMenuItem` via `Thumbnail` read from the same fully-loaded `pdf` proxy object, also with no further network requests.

## 6. Component Responsibilities

### `DeckPdfViewer` (modified)
**Responsible for:** as before (owning `currentPage`, `numPages`, `pdfProxy`, viewport/nav-height measurement, rendering `Document`/`Page`/`DeckPdfNav`/`DeckPdfMenu`), plus: owning new `loadProgress` state (`{ loaded, total }` or equivalent), passing an `onLoadProgress` handler to `Document`, and rendering the progress bar/percentage in place of the static loading text while the document loads.

**Not responsible for:** the pre-fetch-neighboring-pages `useEffect` — removed, since it exists purely to smooth over range-based on-demand fetching, which no longer occurs.

**No prop shape changes.** New internal state: `loadProgress` (object or null, not exposed as a prop to children).

### `app/(portal)/portal/[token]/pdf-file/route.js` (modified)
**Responsible for:** gating access via `resolveDeckAccess` (unchanged), performing a single unranged fetch to the upstream PDF URL, streaming the full response back with `200` status and `Content-Type`/`Content-Length` headers only.

**Not responsible for:** reading, forwarding, or responding to any `Range` header — this capability is fully removed, not merely unused.

No props/state (route handler).

### New progress bar markup (within `DeckPdfViewer`'s `Document`'s `loading` render, no new component file — see Architecture Considerations for why this stays inline rather than being extracted)
**Responsible for:** visually representing `loadProgress.loaded / loadProgress.total` as a filled bar width and a percentage text label.

**Not responsible for:** any logic about when it's shown — that's controlled entirely by `Document`'s `loading` prop lifecycle (shown while loading, unmounted once `onLoadSuccess` fires and `numPages` is set), matching how the current "Loading deck…" text already behaves.

### `DeckPdfMenuItem`, `DeckPdfNav`, `DeckPdfMenu`
No changes. They continue to use the same `pdf`/`pdfProxy` object and `onNavigate` callback as today; the only difference is that by the time they're interacted with, the underlying document has no remaining network dependency.

## 7. Files Affected

- `next/components/DeckPdfViewer.js` — set `disableRange`/`disableStream` options, remove the neighbor pre-fetch effect, add progress state and progress UI, remove now-unused `rangeChunkSize` option.
- `next/app/(portal)/portal/[token]/pdf-file/route.js` — remove Range forwarding/header mirroring, revert runtime to default Node, remove debug `console.log` statements.
- `next/styles/deck.css` — add progress bar styling (`deck-pdf-viewer__progress` and related classes).

No changes to `DeckPdfNav.js`, `DeckPdfMenu.js`, `DeckPdfMenuItem.js`, `page.js`, `deckAccess.js`, `deckQuery.js`, or `deckSession.js`.

## 8. Step-by-Step Implementation

**Step 1 — `next/app/(portal)/portal/[token]/pdf-file/route.js`: revert to full passthrough**
Remove `export const runtime = "edge";`, reverting the route to the default Node.js serverless runtime. Remove the `const range = request.headers.get("range");` line and the three `console.log` debug statements (upstream URL, range header, request signal/method — these were temporary debugging aids from the prior range-support work and serve no purpose now). Change the upstream `fetch(pdfUrl, { headers: range ? { Range: range } : {}, signal: request.signal })` call to `fetch(pdfUrl, { signal: request.signal })` — no headers object needed since there's no conditional Range to forward. In the outgoing response headers, keep `Content-Type: application/pdf` and the conditional `Content-Length` copy from `upstream.headers`, but remove `Accept-Ranges: bytes` and the conditional `Content-Range` copy — these advertised/relayed range support that no longer exists. Change the `NextResponse` `status` from `upstream.status` back to a hardcoded `200` (or continue using `upstream.status`, which will simply always be `200` now that no `Range` header is ever forwarded upstream — either is correct, but using `upstream.status` is slightly more defensive against an unexpected upstream response code and requires no behavior branching, so keep it as-is rather than hardcoding). Gotcha: the `getCachedPdfUrl` in-memory TTL cache above this handler is unrelated to range support and must not be touched — it caches the resolved upstream URL, not response bytes.

**Step 2 — `next/components/DeckPdfViewer.js`: disable ranged/streamed fetching**
In `DOCUMENT_OPTIONS`, remove the `rangeChunkSize: 1024 * 1024` line, change `disableStream: false` to `disableStream: true`, and add `disableRange: true`. Leave `disableAutoFetch: true` as-is. Gotcha: setting `disableStream: true` means pdf.js will not begin parsing until the entire response has arrived — this is the intended tradeoff (per the clarified goal of reliability over first-page speed) but confirms why the progress indicator (Step 4) is necessary: without it, there is no feedback at all during what may now be a longer wait on slow connections.

**Step 3 — `next/components/DeckPdfViewer.js`: remove the neighbor page pre-fetch effect**
Delete the `useEffect` block that calls `pdfProxy.getPage(currentPage + 1)` and `pdfProxy.getPage(currentPage - 1)` (the one keyed on `[pdfProxy, currentPage, numPages]`). This effect existed to warm upcoming pages ahead of on-demand range fetches; with the full document already resident after `onLoadSuccess`, `getPage` calls against neighboring pages have no network benefit and are dead weight. Gotcha: confirm no other logic in the file depends on this effect's side effects (it has none beyond the `getPage` calls themselves, which don't set any state) before deleting.

**Step 4 — `next/components/DeckPdfViewer.js`: add load-progress state and pass `onLoadProgress`**
Add `const [loadProgress, setLoadProgress] = useState(null);` alongside the other `useState` declarations. On the `<Document>` element, add an `onLoadProgress={({ loaded, total }) => setLoadProgress({ loaded, total })}` prop. Gotcha: pdf.js's `onLoadProgress` `total` value can occasionally be `0` or unavailable very early in a fetch before the server's `Content-Length` is known — guard the percentage calculation (Step 5) against a `0`/falsy `total` to avoid a `NaN%` or `Infinity%` flash.

**Step 5 — `next/components/DeckPdfViewer.js`: replace the static loading text with the progress UI**
Change the `<Document>`'s `loading` prop from the static `<p className="font-secondary text-md">Loading deck…</p>` to a small inline JSX block: a percentage computed as `total ? Math.round((loaded / total) * 100) : 0` (guarding the `total` falsy case per Step 4's gotcha), rendered as a `deck-pdf-viewer__progress` wrapper containing a `deck-pdf-viewer__progress-bar` element whose inline `width` style is set to `${percentage}%`, plus a `deck-pdf-viewer__progress-label` text node (e.g. `Loading deck… {percentage}%`) using the existing `font-secondary text-md` classes to match current typography. Read from the `loadProgress` state added in Step 4, defaulting `loaded`/`total` to `0` when `loadProgress` is `null` (i.e. before the first progress event fires). Leave the `<Page>` element's `loading` prop (`"Loading page…"`) untouched — that covers per-page render time, which is unrelated to the document download and still applies (rendering a page from an already-parsed document is not instant).

**Step 6 — `next/styles/deck.css`: add progress bar styling**
Add new rules following the file's existing BEM-per-section convention (see the `.deck-pdf-viewer` / `.deck-pdf-nav` pattern), placed directly after the existing `.deck-pdf-viewer` rule under a `Deck (pdf viewer)` comment block already present. Define `.deck-pdf-viewer__progress` as a fixed-width (e.g. `200px`) or percentage-width container with a thin height (e.g. `4px`), a low-contrast background track color appropriate against the `.deck-pdf-viewer`'s black background (e.g. a translucent white), and `border-radius` for a pill shape. Define `.deck-pdf-viewer__progress-bar` as the filled inner element (`height: 100%`, solid white or brand-accent background, `border-radius` matching the track, and a `width` driven by the inline style set in Step 5 — optionally a `transition: width 0.2s` for smoothness). Define `.deck-pdf-viewer__progress-label` for the percentage text, spaced below or beside the bar (e.g. `margin-top`), reusing the existing `font-secondary text-md` typography classes already applied via `className` rather than redefining font styles in CSS. Gotcha: confirm color choices are legible against the black `.deck-pdf-viewer` background specifically, not against the app's general light background used elsewhere.

## 9. Edge Cases

- **Very large PDF on a slow connection:** the full file must now download before any page shows, which can be a long wait. The progress bar (Steps 4-6) directly addresses giving feedback during this wait; no additional timeout/retry logic is introduced by this plan, matching the existing `onLoadError` console-only error handling.
- **`onLoadProgress` never fires before `onLoadSuccess` (very fast/small file, or a browser that reports progress differently):** `loadProgress` state may remain `null` through to completion — the guarded default (`loaded`/`total` default to `0`) prevents a crash, and the loading UI is unmounted immediately once `onLoadSuccess` fires regardless of whether progress was ever observed, so no stuck-at-0% state is possible.
- **`total` unavailable because the upstream/proxy response lacks `Content-Length`:** the proxy already conditionally sets `Content-Length` only when the upstream provides it (unchanged by this plan); if absent, `onLoadProgress`'s `total` will be `0` for the whole download, and the guarded percentage calculation (Step 5) will show `0%` throughout rather than a broken value — acceptable degraded behavior, no upstream guarantee of `Content-Length` presence exists to rely on further.
- **Client (or an intermediary/proxy/CDN in front of this route) sends a `Range` header despite `disableRange: true` on the client:** the reverted proxy (Step 1) no longer reads or forwards any `Range` header at all, so it always returns the full file with `200` — this is intentional defense-in-depth per the user's decision to revert both sides, not just the client.
- **`resolveDeckAccess` failing mid-download (e.g. session cookie expiring while a large file is still streaming):** unchanged from current behavior — access is checked once at the start of the request; an in-flight download is not re-checked mid-stream, exactly as today.
- **Thumbnails in the page menu (`DeckPdfMenuItem`) rendered before the document has fully loaded:** cannot occur — `DeckPdfMenu`/`DeckPdfMenuItem` are only rendered once `numPages` is truthy (see `DeckPdfViewer`'s existing `{numPages && <DeckPdfMenu ... />}` guard), which only becomes true after `onLoadSuccess`, i.e. after the full document is already loaded — so thumbnails never have a network dependency at render time under the new model.

## 10. Test Considerations

Manual checks (no automated test suite exists for this app; none introduced by this plan):
- Load a PDF-type deck and confirm, via the Network tab, exactly one request to `/portal/[token]/pdf-file` with status `200` (no `206`s, no follow-up range requests as pages are navigated).
- Confirm the progress bar fills smoothly from 0% to 100% (or close to it) while the file downloads, with the percentage label updating, on both a fast connection and a throttled one (Chrome DevTools "Slow 3G/4G").
- Confirm the progress UI disappears and the first page renders correctly once the download completes.
- Page through the entire deck (buttons, keyboard nav, and menu selection) and confirm no further network requests to the proxy route occur, and no rendering errors/blank pages appear.
- Open the page menu and confirm thumbnails render correctly for pages scrolled into view, with no visible fetch delay beyond normal rendering time.
- Confirm an expired/locked deck still correctly blocks access at the proxy route (still returns the access-gated `404` before attempting any upstream fetch).
- Confirm the proxy route still functions correctly under the Node runtime in a deployed preview (not just local `next dev`), since the prior plan's Edge adoption implies some environment-specific behavior may differ — reverting to Node is the well-tested prior baseline, but should still be confirmed post-deploy.
- Test with a genuinely large deck (10MB+) to confirm the full-download tradeoff is acceptable in practice and the progress bar makes the wait feel reasonable.

## 11. Implementation Order

1. `next/app/(portal)/portal/[token]/pdf-file/route.js` — existing file, modified first: revert Range forwarding, header mirroring, Edge runtime, and remove debug logging, establishing the server side always serving a full file before any client-side option changes are made.
2. `next/components/DeckPdfViewer.js` — existing file, modified second: set `disableRange`/`disableStream`, remove the now-redundant neighbor-prefetch effect, add progress state/handler and replace the loading text with the progress UI — done after the proxy so the client-side "expect a full download" configuration matches what the server now actually provides.
3. `next/styles/deck.css` — existing file, modified last: add the progress bar styling once the markup it targets (Step 5 of `DeckPdfViewer.js`) exists, so class names can be cross-checked directly against the JSX.
