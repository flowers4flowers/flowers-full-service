# PDF Proxy Kirby Call Reduction

## 1. Goal

Stop the `/portal/[token]/pdf-file` proxy route from making a full network round-trip to Kirby's KQL API on every single HTTP range request. With `rangeChunkSize` now at 1MB, a single deck page can still require many range requests for its embedded images, and each one currently re-verifies the deck against Kirby from scratch — this is the dominant remaining cause of slow perceived load time.

## 2. Current System Behaviour

`app/(portal)/portal/[token]/pdf-file/route.js` calls `resolveDeckAccess(params.token)` at the top of every `GET` request. `resolveDeckAccess` (`utility/deckAccess.js`) always calls `getDeckForRender(token)` (`queries/deckQuery.js`), which always calls `kirbyFetch` (`queries/kirbyFetch.js`) — a `POST` to Kirby's KQL endpoint with Basic auth, including up to 3 retry attempts with a 2-second delay between them if Kirby's response isn't valid JSON. This happens unconditionally, once per incoming request, regardless of whether the deck's metadata has changed since the last check a moment ago.

`resolveDeckAccess` also reads the `deck_session` cookie and calls `verifyDeckToken` (`utility/deckSession.js`), which uses `jose`'s `jwtVerify` — a local, synchronous-style cryptographic check with no network call. `signDeckToken` (called from `/unlock/route.js` at the time a deck is unlocked) sets the JWT's expiration (`exp`) to `effectiveExpiry(deckExpiry)`, which caps the session to the earlier of the deck's own `expiry` field or 90 days from unlock. This means an expired deck already fails `jwtVerify` on its own once the token's `exp` has passed, independent of any fresh Kirby lookup — `resolveDeckAccess`'s separate `meta.expiry` check is therefore redundant for a route that only needs to serve the file, not render page content.

`pdf.js`, via `react-pdf`, issues one `GET` to `/portal/[token]/pdf-file` per range chunk while loading a page's content (previously in 64KB chunks, now 1MB after the prior fix) — for an image-heavy page, this can still mean many requests fired in quick succession, each currently paying the full Kirby round-trip cost before even reaching the actual file-proxying logic.

## 3. Desired Behaviour

The route verifies the session cookie locally (via `verifyDeckToken`) on every request, exactly as before — this remains fast and enforces both "is this deck unlocked" and "has this link's session expired" without any network call. For resolving the actual `pdfUrl` to fetch from Kirby, the route checks an in-memory cache first; if a recent value exists for that deck token, it's reused immediately with no Kirby call. If not (first request for that deck in a while, or the cached entry has expired), the route calls `getDeckForRender(token)` once, stores the result in the cache, and proceeds. Under normal viewing — a burst of range requests for one deck within a short window — only the first request in that burst incurs the Kirby round-trip; the rest reuse the cached value.

## 4. Architecture Considerations

This route stops using `resolveDeckAccess` entirely and instead performs its own, narrower access check: cookie verification via `verifyDeckToken`, plus a token-vs-`deckId` match (mirroring the same check `resolveDeckAccess` already does), without re-fetching deck metadata from Kirby on every call. `resolveDeckAccess` itself is not modified and continues to be used unchanged by `page.js` (which legitimately needs fresh title/content-type/figma-url/expiry data on every real page load, a much lower-frequency operation than range-chunked file fetches).

The cache is a plain module-level `Map`, keyed by deck token, storing `{ pdfUrl, cachedAt }`. A lookup checks whether `Date.now() - cachedAt` is under a fixed TTL (5 minutes) before reusing a cached value; an expired or missing entry triggers a fresh `getDeckForRender` call, which repopulates the cache. This is deliberately simple: no eviction policy beyond time-based staleness, no shared/external cache service. On Vercel, a module-level variable persists only for the lifetime of a warm serverless instance and is not shared across concurrent instances or cold starts — this is an accepted limitation, not a bug, since the worst case of a cache miss is identical to today's behavior (one Kirby round-trip), and the cache exists purely to collapse the common case of dozens of near-simultaneous requests for the same deck, not to provide a durable or cross-instance guarantee. No external cache infrastructure (Redis, Vercel KV) is introduced, since none currently exists in this stack and the module-level approach is sufficient for the actual problem (bursty, same-instance request patterns).

Skipping `resolveDeckAccess`'s Kirby-sourced expiry check is intentional and safe: the JWT's own `exp` claim already enforces the same expiry boundary, set once at unlock time and cryptographically verified locally on every request via `jwtVerify`. A deck whose Kirby `expiry` field changes after a session is already unlocked would not retroactively invalidate that session either way under the current system (the cookie's `exp` is fixed at unlock time), so this plan does not change that existing behavior.

## 5. Data Flow

An incoming `GET` request to `/portal/[token]/pdf-file` first has its `deck_session` cookie read and verified locally via `verifyDeckToken`; if invalid, missing, or its `deckId` doesn't match the URL's token, the route responds `404` exactly as `resolveDeckAccess`'s "locked"/mismatched case does today (this route has no separate password-prompt UI to redirect to, so any non-unlocked state is a `404`, consistent with the existing `status !== "unlocked"` check). If the cookie is valid, the route checks the in-memory cache for that token; on a hit, `pdfUrl` comes from the cache with no further network activity. On a miss, `getDeckForRender(token)` is called once, its `pdfUrl` is stored in the cache alongside the current timestamp, and execution proceeds exactly as on a hit. From there, the existing range-forwarding/upstream-fetch/response-mirroring logic (unchanged from the previous plan) takes over using the resolved `pdfUrl`.

## 6. Component Responsibilities

### `app/(portal)/portal/[token]/pdf-file/route.js` (modified)
- Responsible for: verifying the session cookie locally, resolving `pdfUrl` via the new cache (falling back to a live Kirby lookup on a miss), forwarding range requests, and mirroring the upstream response — all as a single route handler module.
- NOT responsible for: rendering any UI, handling the password-gate flow, or any deck state beyond what's needed to serve the file (title, content type, etc. are irrelevant here and not fetched).
- No props (route handler). Module-level state: the cache `Map` itself, persisting only for the life of the serverless instance.

### `utility/deckAccess.js` (unchanged)
- Continues to be used exactly as before by `page.js`; not modified by this plan, and not used by the PDF proxy route going forward.

## 7. Files Affected

- `app/(portal)/portal/[token]/pdf-file/route.js` — replace the `resolveDeckAccess` call with local cookie verification plus a cached `getDeckForRender` lookup.

No other files change. `utility/deckAccess.js`, `utility/deckSession.js`, `queries/deckQuery.js`, and `queries/kirbyFetch.js` are all used as-is, imported differently by this one route.

## 8. Step-by-Step Implementation

**Step 1 — `app/(portal)/portal/[token]/pdf-file/route.js`**
Replace the `import { resolveDeckAccess } from "../../../../../utility/deckAccess";` line with two imports: `verifyDeckToken` and `DECK_SESSION_COOKIE` from `../../../../../utility/deckSession`, and `getDeckForRender` from `../../../../../queries/deckQuery`. Add `import { cookies } from "next/headers";`, since cookie reading was previously handled inside `resolveDeckAccess` and must now happen directly in this route. Declare a module-level `const pdfUrlCache = new Map();` above the `GET` export, and a `const CACHE_TTL_MS = 5 * 60 * 1000;` constant. Add a small helper function (co-located in this file, not extracted, since it is only used here) that, given a token, returns a cached `pdfUrl` if present and within `CACHE_TTL_MS`, otherwise calls `getDeckForRender(token)`, stores `{ pdfUrl: result?.pdfUrl, cachedAt: Date.now() }` in the cache, and returns the resolved `pdfUrl` (handling the case where `getDeckForRender` returns `null` for an unknown deck by not caching a null/undefined entry, so a genuinely missing deck doesn't get "stuck" cached as absent and is re-checked on the next request — though in practice this route is only ever reached after a successful unlock, so this is a defensive rather than expected case). Inside `GET`, replace the `resolveDeckAccess` call with: read the cookie value via `cookies().get(DECK_SESSION_COOKIE)?.value`, call `verifyDeckToken` on it, and check `payload?.deckId === params.token` — mirroring exactly what `resolveDeckAccess` currently does internally, so the same access rule (valid signature, unexpired, deckId matches this route's token) is preserved. If that check fails, return the same `404 { error: "not_found" }` response as before. If it passes, call the new cached-lookup helper to get `pdfUrl`, and if it's falsy, also return the `404`. The rest of the function (range header forwarding, upstream fetch, response header mirroring) is unchanged. Watch for: `cookies()` from `next/headers` must be called within the route handler's synchronous setup exactly as `resolveDeckAccess` already calls it (both are Node runtime route handlers, so no Edge-compatibility concern applies here, matching the earlier decision to keep this route on the default Node runtime). Watch for: this route now duplicates a small piece of logic that also lives in `resolveDeckAccess` (the deckId-matches-token check) — this duplication is deliberate and scoped to this one file, not extracted into a shared helper, since `resolveDeckAccess` also does additional work (fetching full deck metadata, expiry-from-Kirby checking) that this route intentionally no longer wants on every call; extracting a shared "verify cookie only" helper is a reasonable future cleanup but not required for this fix and is left out to keep this change minimal and contained.

## 9. Edge Cases

Deck's PDF file is replaced in Kirby (new upload) while a client has an active viewing session: the cached `pdfUrl` could be stale for up to `CACHE_TTL_MS` (5 minutes), during which the client continues fetching the old file's ranges — acceptable, since Kirby's uploaded-file URLs are typically content-addressed/versioned by upload (a re-upload usually changes the underlying file path), and even in the worst case this only affects a single active viewer for a few minutes, not a durable inconsistency.

Serverless cold start / new instance spun up mid-session: cache is empty, first request after the cold start pays one Kirby round-trip (same as current behavior for every request), then repopulates and speeds up subsequent requests on that instance — no error state, just a temporary reversion to today's per-request cost for a single request.

Invalid or expired cookie arrives mid-burst (e.g. a session that expires while a deck is actively being viewed): every request, cached `pdfUrl` or not, still independently verifies the cookie first — an expired/invalid cookie always results in `404` regardless of cache state, so caching `pdfUrl` never weakens the access check itself.

Two different decks being viewed concurrently (e.g. two browser tabs, or two different clients on the same warm serverless instance): the cache is keyed by token, so entries don't collide or leak between decks.

Unbounded cache growth over the lifetime of a long-lived warm instance across many different decks: not addressed by this plan (no eviction beyond time-based staleness of individual entries, and stale entries are only overwritten on next access, not proactively removed) — acceptable given Vercel serverless instances are recycled periodically on their own and the realistic number of distinct decks viewed by one warm instance in its lifetime is small; flagged here as a known, low-risk simplification rather than an oversight.

## 10. Test Considerations

Manual checks:
- Load a PDF deck and watch the Network tab: confirm only the first range request (or the first after a period of inactivity) takes noticeably longer; subsequent range requests within the same viewing burst should return fast, with no visible per-request Kirby-lookup delay.
- Add a temporary `console.log` (removed before finishing, unless the user asks to keep it) inside the cache-miss branch to confirm it's hit once per burst, not once per range request, during manual testing.
- Confirm an already-expired or never-unlocked session still receives `404` from this route (test by clearing the `deck_session` cookie and requesting the PDF URL directly).
- Confirm switching between two different PDF decks (two tokens) in the same browser session still resolves each correctly, with independent caching.
- Wait past the 5-minute TTL during a manual test (or temporarily lower the constant for testing) and confirm a subsequent request correctly falls back to a fresh Kirby lookup rather than erroring.
- Re-run the earlier throttled-network test (Chrome DevTools "Slow 4G") to confirm overall page-load time has measurably improved compared to before this change.

No automated test suite exists for this app; no new automated tests are introduced by this plan.

## 11. Implementation Order

1. `app/(portal)/portal/[token]/pdf-file/route.js` — existing file, modified. The only file in scope; the cookie-verification replacement and caching helper are added together since they are small and interdependent within this single route handler.
