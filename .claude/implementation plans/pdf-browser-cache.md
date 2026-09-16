# PDF Browser HTTP Caching

## 1. Goal

Even with the server-side byte cache (from the "PDF Performance and Black Background" plan), a full page reload always makes a fresh network request to `/portal/[token]/pdf-file`, and the browser has no instruction to skip that request itself. This plan adds `Cache-Control` headers so a reload within a defined window loads the PDF entirely from the browser's own disk cache, with zero network request — the fastest possible path to the bytes being available for pdf.js to start parsing.

## 2. Current System Behaviour

`app/(portal)/portal/[token]/pdf-file/route.js` sets response headers `Content-Type: application/pdf` and, when available, `Content-Length`, copied from the upstream response. No `Cache-Control`, `ETag`, or any other caching-related header is set. Without an explicit `Cache-Control`, browsers apply their own heuristic caching rules (which vary by browser and are unreliable for a same-origin API-style route like this), so in practice each reload of the portal page triggers a fresh `GET` to this route, which is handled by the existing server-side byte cache (serves instantly from memory on a hit) or a full upstream fetch (on a miss) — but either way, a network round trip from the browser to this Next.js server always occurs.

Access to this route is gated by a session cookie (`DECK_SESSION_COOKIE`), verified via `verifyDeckToken` against `params.token` on every request — this check currently runs unconditionally on every single request to the route, with no bypass.

## 3. Desired Behaviour

The proxy response includes a `Cache-Control` header instructing the browser to treat the response as cacheable for 30 minutes, private to that browser (not shareable via any intermediate/shared cache such as a CDN or corporate proxy, since the response is specific to an authenticated session). Within that 30-minute window, a reload of the portal page causes the browser to serve the PDF bytes directly from its own disk cache without making any network request to this route at all — pdf.js receives the bytes immediately, skipping both the network transfer and this server's access-gate/byte-cache logic entirely for that request. After the window elapses, the next reload behaves exactly as it does today (a real request, gated by the session cookie, served from the server-side byte cache or upstream as applicable).

This is a client-local cache: it does not change or interact with the existing server-side `pdfUrlCache`/`pdfBytesCache`, which continue to operate exactly as they do today for any request that does reach the server.

## 4. Architecture Considerations

`Cache-Control: private, max-age=1800` (1800 seconds = 30 minutes) is the specific directive to add. `private` is required (not `public`) because this response is behind session-cookie authentication — a `public` directive would permit shared/intermediary caches (corporate proxies, ISP-level caches, or a CDN if one is ever introduced in front of this route) to store and potentially serve the response to a different, unauthenticated user, which would be a real access-control leak. `private` restricts caching to the requesting browser's own local cache only.

`max-age=1800` is chosen to match the existing server-side byte cache's own 30-minute TTL, per the user's decision — this keeps a single, consistent mental model for "how stale can a viewed deck be" across both cache layers rather than introducing a second, differently-tuned staleness window that would need to be reasoned about separately.

This is a pure `max-age` (non-revalidating) cache directive, not an `ETag`/`no-cache` revalidation scheme — per the user's explicit choice, a reload within the window makes no server request at all, meaning the session-cookie access check does not run for that reload. The accepted consequence (already agreed) is that a session that becomes locked/expired mid-window will still serve the previously-cached PDF from the browser's disk for the remainder of the 30-minute window on that device — this mirrors the tradeoff already accepted for the server-side byte cache's own staleness window, just applied one layer further out (the user's own browser instead of the server's memory).

No new dependencies, no new files, and no change to the existing access-gating logic itself — this plan only adds a response header.

## 5. Data Flow

No change to how bytes are produced or where they originate. The only change is an additional header value attached to the `NextResponse` already being constructed and returned by the `GET` handler. On the browser side, once this header is present on a response, the browser's own HTTP cache implementation takes over for subsequent requests to the exact same URL (`/portal/[token]/pdf-file`) within the `max-age` window — no application code on the client (`DeckPdfViewer.js`) needs to change, since `fetch`/`Document`'s underlying network requests already go through the browser's standard HTTP cache layer automatically; this is purely a server-response-header change that the browser's existing caching behavior will honor without any client-side wiring.

## 6. Component Responsibilities

### `app/(portal)/portal/[token]/pdf-file/route.js` (modified)
**Responsible for:** adding `Cache-Control: private, max-age=1800` to every successful (200) response's headers, alongside the existing `Content-Type`/`Content-Length` headers, for both the server-cache-hit path and the upstream-fetch path.
**Not responsible for:** any change to when or how the server-side byte cache is populated or invalidated — that logic is untouched. Also not responsible for cache invalidation when a deck is revoked mid-window — this is an accepted, already-discussed tradeoff, not a gap to close in this plan.
No props/state (route handler).

## 7. Files Affected

- `app/(portal)/portal/[token]/pdf-file/route.js` — add the `Cache-Control` header to the response headers object used by both response paths (server-cache hit and upstream fetch).

No other files require changes — this is a single-header addition to an existing route handler.

## 8. Step-by-Step Implementation

**Step 1 — `app/(portal)/portal/[token]/pdf-file/route.js`: add the `Cache-Control` header**
Add a new constant near the existing `BYTES_CACHE_TTL_MS`/`BYTES_CACHE_MAX_ENTRIES` constants, e.g. `BROWSER_CACHE_MAX_AGE_SECONDS = 1800`, to keep the 30-minute value expressed once and reused rather than duplicated as a magic number. In the `headers` object that is currently built (containing `Content-Type` and the conditional `Content-Length`) — the same object used for both the server-cache-hit early return and the upstream-fetch return — add `"Cache-Control": \`private, max-age=${BROWSER_CACHE_MAX_AGE_SECONDS}\`` (or the literal string `"private, max-age=1800"`, whichever matches the file's existing style for similar constants — the file already parameterizes its other TTLs as named constants, so following that same pattern is preferred for consistency). Gotcha: because the same `headers` object is reused both for the immediate server-cache-hit response and stored in `pdfBytesCache` for the *next* cache hit (via `pdfBytesCache.set(params.token, { body, headers, cachedAt: ... })`), adding `Cache-Control` to this object once, in the single place `headers` is constructed on the upstream-fetch path, automatically ensures both response paths (fresh fetch and future cache hits) carry the header — no need to add it in two places, since the object is shared by reference between the "respond now" and "store for later" code paths as the code is currently structured. Confirm this by re-checking the current file structure at implementation time, since the goal is exactly one place to add the header, not two.
Gotcha: only add this header to the success path (`200` responses carrying the PDF body) — the existing `404`/`502` `NextResponse.json(...)` error responses must not be given a long `max-age`, since caching an error response would incorrectly prevent a retry from reaching the server for 30 minutes; this plan does not touch those responses, only the header object used for the successful PDF response.

## 9. Edge Cases

- **Deck access revoked/expired mid-window:** as already discussed and accepted, a browser that cached the PDF within the last 30 minutes will continue to serve it locally without re-contacting the server until the window elapses — no server-side enforcement is possible against an already-cached response sitting in a user's browser disk cache; this is a known and accepted limitation of this approach, not a bug to fix here.
- **User does a hard/force reload (e.g. Ctrl+Shift+R, or DevTools "Disable cache"):** browsers bypass their HTTP cache for such reloads regardless of `Cache-Control`, so this always falls through to a real request — behaving exactly as it does today, correctly re-checking access.
- **Deck content changes upstream within the 30-minute window:** the browser will continue showing the previously cached version until the window elapses, exactly mirroring the same already-accepted staleness tradeoff as the server-side byte cache — no new risk introduced beyond what was already accepted for that cache layer.
- **Multiple different decks viewed by the same browser:** each is cached independently by the browser under its own distinct URL (`/portal/<token>/pdf-file` differs per token), so caching one deck has no effect on another — no collision risk.
- **A shared/corporate proxy or future CDN sitting in front of this app:** the `private` directive explicitly instructs any such intermediary not to store or serve this response to other users, which is the correct and necessary safeguard given the route's session-cookie-gated nature — this must not be weakened to `public` under any future change without re-evaluating the access-control implications.

## 10. Test Considerations

No automated test suite exists for this app; none introduced by this plan. Manual checks:
- Load a PDF-type deck, then reload the page within a few minutes: confirm via the Network tab that the request to `/portal/[token]/pdf-file` shows as served "from disk cache" (or equivalent browser-specific indicator) rather than a real network transfer, and that the deck's first page appears noticeably faster than before this change.
- Confirm the response headers on the initial (non-cached) request include `Cache-Control: private, max-age=1800`.
- Force-reload (bypass cache) and confirm a real request is made and still correctly succeeds/fails based on current session-cookie validity.
- Simulate or reason through an expired/locked session within the 30-minute window (e.g. by manually clearing the session cookie) and confirm — as an accepted, expected limitation, not a bug — that a browser-cache-served reload still shows the PDF, while a hard reload correctly blocks access.
- Confirm error responses (`404` for an inaccessible deck, `502` for an upstream failure) are not being cached by the browser — reload after correcting the underlying condition (e.g. re-authenticating) and confirm the route is hit again rather than replaying a cached error.

## 11. Implementation Order

1. `app/(portal)/portal/[token]/pdf-file/route.js` — the only file in scope; the single header addition is made in the one place `headers` is constructed for the successful response path.
