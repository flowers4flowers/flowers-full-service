# PDF Proxy Range Request Support

## 1. Goal

Eliminate the long wait before a PDF-type deck's first page renders by letting `pdf.js` (via `react-pdf`) fetch only the byte ranges it actually needs, instead of forcing a full download of the entire (often 10-30MB+) PDF before anything can display.

## 2. Current System Behaviour

`components/DeckPdfViewer.js` passes a same-origin URL (`/portal/[token]/pdf-file`) to `react-pdf`'s `<Document file={pdfUrl}>`. `pdf.js` always attempts range-based, progressive fetching of a PDF by default when the server it's talking to advertises support for it (via `Accept-Ranges: bytes`, a numeric `Content-Length`, and honoring `Range` request headers with `206 Partial Content` responses) — the initial request pdf.js "worker" sends may be an unranged fetch to determine total length, but it only continues that way if partial content responses aren't offered.

`app/(portal)/portal/[token]/pdf-file/route.js` is the same-origin proxy this URL points to. It ignores any `Range` header the browser/pdf.js sends, always calls `fetch(meta.pdfUrl)` with no options (an unranged request), and always returns a `200` response with the entire upstream body streamed through and a hardcoded `Content-Type: application/pdf` header — no `Content-Length`, `Accept-Ranges`, or `Content-Range` headers are set. Because this proxy never exposes range support, `pdf.js` falls back to downloading the whole file before it can render the first page, regardless of how the actual upstream Kirby/nginx host behaves.

The upstream Kirby media host (`admin.flowersfullservice.art`, served by nginx) was confirmed via a manual `curl -H "Range: bytes=0-100"` test to correctly respond with `206 Partial Content`, `Content-Range: bytes 0-100/12239182`, and `Content-Length: 101` — so the underlying file host already fully supports range requests; only the proxy route sits in the way.

`resolveDeckAccess` (`utility/deckAccess.js`), used by the proxy route to gate access, is unaffected by this plan — it continues to run once per request exactly as it does today, on every ranged request pdf.js makes (pdf.js typically issues multiple range requests per document as the user navigates).

## 3. Desired Behaviour

When the browser (via `pdf.js`) sends a `Range` header to `/portal/[token]/pdf-file`, the route forwards that same `Range` header to the upstream Kirby URL, and relays the upstream's response back to the browser with matching status (`206` for a partial response, `200` for a full one), along with `Content-Range`, `Content-Length`, and `Accept-Ranges: bytes` headers so the browser/pdf.js correctly understands partial content is available. When no `Range` header is present (e.g. a non-range-aware client, or the very first probing request some browsers/pdf.js configurations make), the route continues to behave as it does today — full `200` passthrough.

The net effect: pdf.js downloads only the bytes needed to parse the PDF's structure and render the currently visible page, fetching additional ranges on demand as the user navigates, rather than blocking on the entire file.

## 4. Architecture Considerations

The proxy must remain a thin passthrough rather than buffering the full file in memory before responding — it already streams via `upstream.body` today, so range support is achieved by additionally forwarding the relevant request/response headers, not by restructuring how the response body is piped through.

Switching the route from the default Node.js serverless runtime to the Edge runtime (`export const runtime = "edge"`) is included in this plan. Edge functions are built around the standard Web `fetch`/`Request`/`Response` APIs already used in this route, support arbitrary streaming response bodies without the buffering/duration constraints more relevant to Node serverless functions handling many small range requests per page view, and avoid unnecessary cold-start overhead for what is now a high-frequency route (pdf.js may issue several range requests while a single deck is being viewed, versus one request under the old full-download behavior). This is a low-risk change since the route's logic (fetch, header passthrough, streaming) has no Node-specific API dependencies — `resolveDeckAccess` must be checked for compatibility since it uses `next/headers`' `cookies()`, which is supported in the Edge runtime.

Authentication/authorization is unchanged: `resolveDeckAccess` still runs per request and still gates every range request the same way a full request was gated before, so a client cannot use range requests to bypass the existing session-cookie check.

No new dependencies are introduced.

## 5. Data Flow

The browser's `pdf.js` instance sends a `GET` request to `/portal/[token]/pdf-file`, optionally including a `Range` header describing the byte range it wants. The route handler resolves deck access exactly as before; if unlocked, it now reads the incoming request's `Range` header (if present) and includes it in the outgoing `fetch(meta.pdfUrl, { headers: { Range: ... } })` call to Kirby's nginx host. Kirby's nginx responds with either `206` (partial, when a valid `Range` was sent) or `200` (full file, when it wasn't), including `Content-Range`/`Content-Length` on a partial response. The route mirrors the upstream's status code and relevant headers (`Content-Type`, `Content-Length`, `Content-Range` when present, `Accept-Ranges: bytes`) onto its own response, and streams `upstream.body` through unchanged, exactly as the existing implementation already does for the body itself.

## 6. Component Responsibilities

### `app/(portal)/portal/[token]/pdf-file/route.js` (modified)
- Responsible for: gating access via `resolveDeckAccess` (unchanged), reading an incoming `Range` header and forwarding it upstream, mirroring the upstream response's status and range-related headers back to the client, streaming the response body through.
- NOT responsible for: parsing or validating the `Range` header's contents itself (delegated entirely to the upstream nginx host, which already validates and responds correctly) — the route does not need to understand byte-range syntax, only pass it through.
- No props (route handler, not a component). No internal state.

## 7. Files Affected

- `app/(portal)/portal/[token]/pdf-file/route.js` — add `Range` header forwarding, mirror upstream status/headers, switch runtime to Edge.

No changes to `DeckPdfViewer.js`, `deckQuery.js`, `deckAccess.js`, or any other file — `react-pdf`/`pdf.js` already sends range requests by default when the server supports them, so no client-side code needs to change to take advantage of this.

## 8. Step-by-Step Implementation

**Step 1 — `app/(portal)/portal/[token]/pdf-file/route.js`**
Add `export const runtime = "edge";` alongside the existing `export const dynamic = "force-dynamic";`. Read the incoming request's `Range` header via `request.headers.get("range")`. When building the upstream `fetch(meta.pdfUrl, ...)` call, conditionally pass a `headers` object containing `Range` only if the incoming header was present (an empty/undefined `Range` header should not be forwarded, since sending a malformed empty header could confuse the upstream server). After receiving `upstream`, build the outgoing response headers by starting from `Content-Type: application/pdf` (unchanged), then conditionally copying `Content-Length` and `Content-Range` from `upstream.headers` when present, and always setting `Accept-Ranges: bytes` so the browser knows range requests are supported on this route regardless of whether this particular request was ranged. Set the outgoing `NextResponse`'s `status` to `upstream.status` instead of the hardcoded `200`, so a `206` from upstream is correctly relayed as `206` (this is required — pdf.js and browsers treat `206` as the signal that partial content was actually honored, not just requested). Watch for: `resolveDeckAccess` internally calls `cookies()` from `next/headers`, which is supported under the Edge runtime, but confirm this by checking for any Edge-incompatible API usage inside `deckAccess.js`, `deckQuery.js` (via `kirbyFetch`), and `deckSession.js` (via `jose`, which is Edge-compatible) during implementation, since a Node-only API anywhere in that call chain would break under Edge and require reverting the runtime change for this route while keeping the header-forwarding logic. Watch for: the existing `if (!upstream.ok || !upstream.body)` check currently only treats `upstream.ok` (200-299) as success — a `206` response's `ok` property is `true` (206 is in the 200-299 range per the Fetch spec), so this existing guard does not need modification for partial-content responses to pass through correctly.

## 9. Edge Cases

Upstream Kirby host temporarily unreachable or returns an error: unchanged from current behavior — the existing `502` fallback still applies regardless of whether the request was ranged.

A client or intermediary strips the `Range` header before it reaches this route: falls back to the existing full-file `200` behavior automatically, since forwarding is conditional on the header's presence — no broken state, just no speed benefit for that particular request.

Multiple concurrent range requests for the same deck (pdf.js often issues several in parallel while paging through a large document): each is an independent request through `resolveDeckAccess` and the upstream fetch, with no shared state between them — this matches how the route already behaves for the single full-file case today, just at higher request volume, which is the intended tradeoff for faster perceived load.

`deckAccess.js`/`deckQuery.js`/`deckSession.js` containing a Node-only API incompatible with the Edge runtime: would surface as a build or runtime error immediately upon deploying/testing this route; the concrete fallback is dropping the Edge runtime line while keeping all other changes, which still fixes the core slow-load problem even under the Node runtime — Edge is a performance improvement on top of the fix, not a requirement for it to work.

## 10. Test Considerations

Manual checks:
- Load a large (10MB+) PDF-type deck and observe the Network tab: confirm the initial request(s) to `/portal/[token]/pdf-file` show `206 Partial Content` rather than `200`, and that the first page renders noticeably faster than the full file size would suggest.
- Confirm subsequent page navigation (via the bottom nav) triggers additional range requests as needed rather than re-downloading the whole file.
- Confirm a deck still loads correctly end-to-end (all pages viewable, no corruption) — range-based loading must not silently break document parsing.
- Test on a throttled network connection (e.g. Chrome DevTools "Slow 3G/4G" throttling) to make the improvement clearly observable versus the old full-download behavior.
- Confirm the existing access-gating still works: an expired or locked deck's PDF must still return `404`/be inaccessible via this route regardless of any `Range` header sent.
- If the Edge runtime is kept, deploy to a Vercel preview and confirm the route functions there (Edge runtime behavior can differ subtly from local `next dev`, which does not fully emulate the Edge runtime).

No automated test suite exists for this app; no new automated tests are introduced by this plan.

## 11. Implementation Order

1. `app/(portal)/portal/[token]/pdf-file/route.js` — existing file, modified. The only file in scope; all changes (Range forwarding, header mirroring, status passthrough, Edge runtime) are made together since they are small and interdependent within this single route handler.
