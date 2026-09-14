# Implementation Plan: Fix Full-File PDF Download Before First Page Render

## 1. Goal

`DeckPdfViewer` currently downloads the entire PDF file before the first page is displayed, regardless of the deck's page count or file size. The goal is to make the first page render as soon as its data has arrived, using HTTP Range requests to fetch only the bytes needed for the pages currently being shown, rather than blocking on the full file.

## 2. Current System Behaviour

`DeckPdfViewer` renders react-pdf's `Document` component with `file={pdfUrl}`, where `pdfUrl` points at the app's own `pdf-file` route handler. That route handler already forwards an incoming `Range` header to the upstream PDF host and passes through the upstream's status code (so `206 Partial Content` responses are preserved) and its `Content-Length`/`Content-Range` headers.

However, `DOCUMENT_OPTIONS` in `DeckPdfViewer` sets `disableStream: true`. In pdf.js, this flag disables the streaming/range-request code path entirely and forces the entire document to be fetched in one request before parsing begins. `rangeChunkSize` is also configured, but it has no effect while `disableStream` is `true`, because the range-based fetching logic it configures is switched off. The result: `onLoadSuccess` (and therefore any page render) cannot fire until the whole file has downloaded, no matter how large the PDF is or how the `pdf-file` route is set up to forward Range requests.

`disableAutoFetch: true` is also set. This flag governs whether pdf.js eagerly fetches remaining pages after the initial pages needed for the current view are available — it doesn't currently matter because `disableStream: true` bypasses partial fetching altogether, but it becomes relevant again once streaming is re-enabled.

`DeckPdfNav`'s prefetch behaviour (fetching `currentPage - 1` and `currentPage + 1` via `pdfProxy.getPage()` on page change) and its overall component structure are confirmed to stay as-is.

## 3. Desired Behaviour

The viewer should always open on page 1. Page 1 should render as soon as the bytes needed for it (plus whatever pdf.js needs for its initial structural parse — the document header/xref table) have arrived, not after the entire file downloads. Navigating to adjacent pages should continue to feel fast because of the existing ±1 prefetch in the `useEffect`, now backed by actual range-fetching instead of an already-fully-downloaded file in memory.

## 4. Architecture Considerations

The fix is confined to the `DOCUMENT_OPTIONS` object passed to react-pdf's `Document` component in `DeckPdfViewer.js`. No new components, dependencies, or server-side changes are required — the `pdf-file` route's Range-forwarding logic is already correct and doesn't need modification.

Two flags are in play:
- `disableStream`: must be changed to `false` (or removed, since `false` is pdf.js's default) so pdf.js issues Range requests instead of a single full-file fetch.
- `disableAutoFetch`: staying `true` is appropriate to keep — it prevents pdf.js from eagerly downloading the rest of the document in the background once streaming is active, which keeps bandwidth usage aligned with what the user is actually viewing (current page plus the ±1 prefetch already implemented in `DeckPdfNav`'s effect). This was requested to stay minimal-scope, and disabling auto-fetch is the conservative choice that avoids accidentally reintroducing "download everything" behaviour through a different mechanism.

`rangeChunkSize` (currently `1024 * 1024`, i.e. 1MB) can remain unchanged; it only takes effect once `disableStream` is `false` and determines the size of each ranged chunk pdf.js requests.

No changes are needed to `PasswordGate.js` or the `unlock` route, per scope.

## 5. Data Flow

The browser requests `/portal/[token]/pdf-file`. That route resolves deck access, and — once streaming is enabled in the viewer — receives a `Range` header from the browser's pdf.js client (via react-pdf) rather than no header at all. The route forwards that `Range` header to the upstream PDF host, receives a partial (`206`) response, and streams that partial response body back to the browser with the appropriate `Content-Range`/`Content-Length` headers already in place today. pdf.js on the client accumulates just enough of the file to parse the structure and render the requested page, issuing further ranged requests as `DeckPdfNav`'s effect calls `pdfProxy.getPage()` for adjacent pages. No data flow changes are needed on the server side; the only change is that the client will now actually issue ranged requests instead of one unranged request for the whole file.

## 6. Component Responsibilities

### DeckPdfViewer
- Responsible for: configuring and rendering react-pdf's `Document`/`Page` components, owning `pdfProxy`, `numPages`, and `currentPage` state, and prefetching adjacent pages via the existing `useEffect`.
- Not responsible for: any server-side fetching or Range-header handling (owned by the `pdf-file` route), password gating, or page-count/deep-link URL state (deferred, per scope — always starts at page 1).
- Props: `pdfUrl` (string, required) — URL passed to react-pdf's `Document`.
- Internal state: `pdfProxy` (pdf.js document proxy object, initially `null`), `numPages` (number, initially `null`), `currentPage` (number, initially `1`).
- No prop or state shape changes are required for this fix; only the `DOCUMENT_OPTIONS` constant changes.

### DeckPdfNav
- Unchanged. Continues to own only navigation button rendering and calling `onNavigate` with the target page number.

### pdf-file route handler
- Unchanged. Already correctly forwards `Range` headers and passes through upstream status/headers.

## 7. Files Affected

- `next/components/DeckPdfViewer.js` — `DOCUMENT_OPTIONS.disableStream` must be changed from `true` to `false` so pdf.js uses Range-based fetching instead of downloading the full file up front.

No other files require changes.

## 8. Step-by-Step Implementation

**Step 1 — Update `DOCUMENT_OPTIONS` in `DeckPdfViewer.js`.**
Change `disableStream: true` to `disableStream: false`. Leave `disableAutoFetch: true` and `rangeChunkSize: 1024 * 1024` as they are.

Why: `disableStream` is the single flag currently forcing a full-file download before parsing/rendering can begin. Setting it to `false` restores pdf.js's default Range-request-based loading, which the `pdf-file` route already supports end to end.

Gotcha: `disableStream` and `disableAutoFetch` interact. With `disableStream: false` and `disableAutoFetch: true`, pdf.js will range-fetch only what's needed for the pages actually requested via `getPage()` (the current page plus the ±1 prefetch), rather than eagerly downloading the whole document in the background. This matches the "no other UX work" constraint — behaviour otherwise stays exactly as-is, just faster to first paint.

This is the only step. It connects directly to nothing else changing — no other file in the flow needs to change for this to take effect, because the request-forwarding logic on the server was already correct.

## 9. Edge Cases

- **Upstream PDF host does not support Range requests.** If `meta.pdfUrl`'s host ignores the `Range` header and always returns `200` with the full body, pdf.js will still function correctly (it falls back to treating the response as the full file) but will not gain any speed benefit. This isn't something to guard against in code — it's a property of wherever `meta.pdfUrl` is hosted — but worth confirming if the speedup isn't observed after this change.
- **Very small PDFs.** For decks with few pages/small file size, the visible difference may be negligible, since the whole file may fit in the first range chunk anyway. This is expected and not a regression.
- **Rapid page navigation before prefetch completes.** If a user clicks "next" faster than the ±1 prefetch can resolve, `Page` will show its existing `loading` fallback for that page while pdf.js fetches the needed ranges. This is existing behaviour, unaffected by this change, and is already handled by the `loading` prop on `Page`.
- **`onLoadError` behaviour is unchanged.** Any failure fetching ranges (e.g. network failure mid-stream) will still route through the existing `console.error("PDF load failed:", error)` handler in `Document`'s `onLoadError`.

## 10. Test Considerations

**Manual checks:**
- Open a deck with a large, multi-page PDF and confirm page 1 renders visibly before the full file size (visible in Network tab) has finished downloading.
- In browser devtools Network tab, confirm requests to `/portal/[token]/pdf-file` now carry a `Range` request header and receive `206 Partial Content` responses instead of a single `200` covering the entire file.
- Navigate forward and backward through several pages and confirm no visual regression — pages should still load in the same order and prefetch behaviour (±1) should still be observable as ranged requests fired ahead of the user reaching that page.
- Test against a deck with a PDF host that does support Range requests to confirm the speedup; if feasible, also test against one that doesn't, to confirm graceful fallback to full-file loading with no error.
- Confirm behaviour is unaffected for the `locked`/`expired`/`figma`/`not-ready` states in `page.js`, none of which touch `DeckPdfViewer`.

**Automated tests:** Not essential for a single-flag configuration change, but if the codebase has existing tests around `DeckPdfViewer`, confirm `DOCUMENT_OPTIONS` is asserted or update any snapshot that captures it.

## 11. Implementation Order

1. `next/components/DeckPdfViewer.js` — existing file, modify `DOCUMENT_OPTIONS.disableStream` from `true` to `false`. This is the only change required; there is no dependency ordering to consider since no other file needs modification.
