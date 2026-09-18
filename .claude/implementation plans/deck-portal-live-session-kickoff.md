# Implementation Plan: Kick Off Active Viewers on Password Change

## 1. Goal

`deck-portal-password-revalidation.md` made a session invalid on the *next*
page load once a deck's password changes in Kirby — but a client who already
has the deck open in their browser, and does not navigate or reload, keeps
looking at a server-rendered page from before the change. Nothing tells that
already-open tab its session is now stale. This plan makes an actively open
deck view detect a password change while it's being viewed and kick the
visitor back to the password screen without them needing to reload or
navigate manually.

## 2. Current System Behaviour

- `next/app/(portal)/portal/[token]/page.js` is a server component. It calls
  `resolveDeckAccess(token)` once per request, which (as of the prior plan)
  checks deck expiry, verifies the session cookie's signature, and confirms
  both `payload.deckId === token` and `payload.passwordHash` matches a fresh
  SHA-256 hash of the deck's current Kirby password (`hashPassword` in
  `next/utility/deckSession.js`). If any check fails, it returns `status:
  "locked"` and `page.js` renders `PasswordGate`.
- This check only runs when the page is requested — i.e. on first load or a
  full navigation/reload. Once `page.js` has rendered the unlocked branch
  (`DeckEmbed` for a figma deck, `DeckPdfViewer` for a pdf deck, or the "not
  ready yet" fallback), nothing in the browser re-checks access again unless
  the visitor manually reloads or navigates away and back.
- `resolveDeckAccess` is a plain async function in
  `next/utility/deckAccess.js`, callable from any server context (route
  handler or server component) — it is not tied to `page.js` specifically.
- There is no existing polling, websocket, or any other live-update mechanism
  anywhere in the `next/` app. All existing "freshness" is achieved by
  `force-dynamic` + `no-store` KQL fetches evaluated fresh on every full
  request.
- `page.js` currently renders exactly one of three branches directly as the
  return value once unlocked — there is no shared wrapper element around
  them today:
  - `<DeckEmbed figmaUrl={meta.figmaUrl} />` (figma content)
  - `<DeckPdfViewer pdfUrl={...} />` (pdf content, loaded via
    `nextDynamic` with `ssr: false`)
  - a plain "This deck is not ready yet." message (neither content type set)
- `PasswordGate.js` is a `"use client"` component. It already uses
  `useRouter` from `next/navigation` and calls `router.refresh()` on a
  successful unlock POST — this refresh mechanism is the existing precedent
  for "get the server component to re-run and re-decide the status".
- No GET route exists under `/portal/[token]/`. The only route handler is
  `unlock/route.js`, which handles `POST` only and expects a password in the
  body.

## 3. Desired Behaviour

- While a visitor is actively viewing an unlocked deck (any content type),
  the page periodically checks, in the background, whether its session is
  still valid against the deck's current password.
- If the deck's password is changed in the Kirby Panel while a visitor has
  the page open, that visitor is returned to the password screen within
  about 30 seconds, without needing to manually reload or navigate.
- The check must not interrupt or flicker the page while the session remains
  valid — it runs silently in the background with no visible UI unless it
  detects a mismatch.
- On detecting a mismatch, the current page is fully reloaded (a real
  navigation), which re-runs `page.js`, re-evaluates `resolveDeckAccess`, and
  naturally renders `PasswordGate` exactly as it would for a first-time
  locked visitor. No new "you were logged out" messaging is required —
  `PasswordGate` appearing in place of the deck is sufficient signal.
- This behaviour applies to every unlocked content branch (`DeckEmbed`,
  `DeckPdfViewer`, and the "not ready yet" fallback) — it must not be
  content-type-specific.
- The password screen itself (`PasswordGate`) does not need this polling —
  there is no session to invalidate while locked.
- Expired decks are unaffected by this plan — expiry is already re-checked on
  every full load and is out of scope here; this plan only adds a live check
  for the password-hash mismatch case while a session is already open.

## 4. Architecture Considerations

**A new lightweight GET route reuses `resolveDeckAccess` rather than
duplicating its logic.** `resolveDeckAccess(token)` already contains the
exact check needed (cookie verification, `deckId` match, password hash
match, expiry). A new route handler,
`next/app/(portal)/portal/[token]/session-status/route.js`, calls it and
maps the result to a minimal boolean response. This avoids re-implementing
cookie parsing or hash comparison a second time, and keeps `deckAccess.js` as
the single source of truth for "is this session currently valid."

**The endpoint deliberately returns only a boolean, never deck content or
meta.** The whole point of this plan is defense against a session that
should no longer see anything; the status-check response itself must not
leak `title`, `client`, `figmaUrl`, or any other field. `{ valid: true }` or
`{ valid: false }` is the entire response body.

**A new client component owns the polling, not `page.js` itself.**
`page.js` is a server component and cannot run a `setInterval` or make
client-side `fetch` calls. A new `"use client"` component,
`DeckSessionWatcher`, is introduced purely to own this timer. It renders
nothing visible (returns `null` or wraps `children` transparently) and its
only job is the poll-and-reload loop. This keeps the polling concern fully
isolated from the three existing content-rendering paths, so `DeckEmbed` and
`DeckPdfViewer` need no changes at all.

**Wrapping, not modifying, the existing content branches.** `page.js` wraps
whichever unlocked branch it already returns inside
`<DeckSessionWatcher token={...}>...</DeckSessionWatcher>`, passing the
existing branch as `children`. This satisfies "must not be
content-type-specific" without touching `DeckEmbed`, `DeckPdfViewer`, or the
fallback markup.

**Hard reload, not client-side state swap.** A full `window.location.reload()`
is chosen over trying to swap in `PasswordGate` client-side. A pdf viewer or
figma embed may hold significant in-memory/DOM state (loaded pages, iframe
content); a reload guarantees a clean slate and guarantees the server
re-runs `resolveDeckAccess` as the single source of truth, rather than
trusting client-side state to reflect "locked" correctly. This mirrors the
existing precedent of `PasswordGate` using `router.refresh()` (itself a
re-run of the server component) rather than any client-only state change on
successful unlock.

**Poll interval of 30 seconds, no backoff or visibility-awareness in v1.**
This is a low-traffic, small-scale portal (client decks, not a
high-concurrency product), so a flat 30-second `setInterval` while the tab is
open is an acceptable cost — one extra lightweight GET request every 30
seconds per open deck tab. No pause-on-tab-hidden logic is added; simplicity
is preferred over saving a small amount of background request volume, and a
paused timer would reintroduce the original problem (a visitor who leaves
the tab backgrounded stays "logged in" indefinitely once they return, for as
long as they were away, defeating the intent of prompt revocation).

**No changes to session issuance, hashing, or the unlock flow.** This plan
is purely additive on top of `deck-portal-password-revalidation.md` — it does
not change how tokens are signed, how passwords are hashed, or how unlock
works. It only adds a way for an already-rendered page to notice that a
previously-valid session has since become invalid.

## 5. Data Flow

**Normal viewing (session still valid):** `page.js` renders
`DeckSessionWatcher` wrapping the deck content. On mount, and then every 30
seconds, `DeckSessionWatcher` issues a `GET` request (with credentials, so
the `deck_session` cookie is sent) to `/portal/<token>/session-status`. The
route handler reads the cookie via `resolveDeckAccess(token)` (identical
inputs/logic to what `page.js` itself used to decide `unlocked` originally)
and responds `{ valid: true }`. `DeckSessionWatcher` does nothing further and
waits for the next tick.

**Password changed mid-view:** A staff member changes the deck's password in
the Kirby Panel. On the next poll tick (within ~30 seconds),
`DeckSessionWatcher`'s `GET` request reaches `session-status/route.js`, which
calls `resolveDeckAccess(token)` — this recomputes the current password's
hash from a fresh KQL fetch and compares it against the session cookie's
embedded `passwordHash`, finds a mismatch, and the route responds
`{ valid: false }`. `DeckSessionWatcher` receives this and calls
`window.location.reload()`.

**Reload:** The browser performs a full navigation back to
`/portal/<token>`. `page.js` runs again from scratch, calls
`resolveDeckAccess(token)` itself (as it always does), gets `status:
"locked"` (same mismatch, now detected the normal way), and renders
`PasswordGate`. The visitor sees the password screen and must enter the new
password to regain access, exactly as any newly-locked visitor would.

**Network failure during a poll:** If the `session-status` fetch itself
fails (offline, transient network error), `DeckSessionWatcher` treats this as
inconclusive, not as `valid: false` — it does not reload. It simply waits for
the next tick, since a network hiccup is not evidence the session was
revoked, and forcing a reload on every transient failure would be
disruptive.

## 6. Component Responsibilities

### `next/app/(portal)/portal/[token]/session-status/route.js` — route handler (new)

- **Responsible for:** handling `GET`, calling `resolveDeckAccess(params.token)`,
  responding with `{ valid: true }` when `status === "unlocked"` and
  `{ valid: false }` for every other status (`locked`, `expired`,
  `notfound`), always with a `200` response (the validity is communicated in
  the body, not the HTTP status, since this is a routine polling check, not
  an error condition).
- **Not responsible for:** setting or clearing cookies, returning any deck
  meta or content, handling `POST` (not implemented on this route).
- **Input:** `Request` (no body needed) and route param `token`.
- **State:** none.

### `next/components/DeckSessionWatcher.js` — client component (new)

- **Responsible for:** on mount, starting a 30-second `setInterval` that
  `fetch`es `/portal/<token>/session-status`; on a successful response with
  `{ valid: false }`, calling `window.location.reload()`; clearing the
  interval on unmount; rendering `children` unchanged (transparent wrapper,
  no visible markup of its own).
- **Not responsible for:** deciding what counts as valid (that's the route
  handler / `resolveDeckAccess`'s job), rendering any UI, showing errors on
  network failure, handling the initial page load's own access decision
  (that stays with `page.js`/`resolveDeckAccess` as today).
- **Props:** `token: string` (required) — used to build the status-check URL;
  `children: ReactNode` (required) — the existing content branch being
  wrapped.
- **State:** none exposed; internally holds the interval reference via
  `useRef` or relies on `useEffect`'s own cleanup, not surfaced as component
  state.

### `next/app/(portal)/portal/[token]/page.js` — server component (modified)

- **Responsible for:** (unchanged) resolving access, branching on `status`,
  fetching content only when unlocked. (New) wrapping whichever unlocked
  branch it returns in `<DeckSessionWatcher token={params.token}>...
  </DeckSessionWatcher>`.
- **Not responsible for:** (unchanged) the polling itself, comparing
  passwords, rendering block markup for the watcher.
- **Props:** unchanged, `{ params: { token } }`.
- **State:** none (server component, unchanged).

### `next/utility/deckAccess.js` — unmodified

- `resolveDeckAccess` is reused as-is by the new route handler. No changes
  needed; it already returns exactly the information required
  (`status === "unlocked"` or not).

## 7. Files Affected

| File | New/Mod | Why |
| --- | --- | --- |
| `next/app/(portal)/portal/[token]/session-status/route.js` | New | GET endpoint the client polls; wraps `resolveDeckAccess` and returns a boolean only. |
| `next/components/DeckSessionWatcher.js` | New | Client component owning the polling loop and triggering a reload on invalidation. |
| `next/app/(portal)/portal/[token]/page.js` | Mod | Wrap the unlocked content branches in `DeckSessionWatcher`. |

No changes to `deckAccess.js`, `deckSession.js`, `deckQuery.js`,
`unlock/route.js`, or `PasswordGate.js` — this plan is purely additive on top
of the existing revalidation logic.

## 8. Step-by-Step Implementation

### Step 1 — Build the `session-status` route handler

- Create `next/app/(portal)/portal/[token]/session-status/route.js`.
- Mirror the relative import depth used by the sibling `unlock/route.js`
  (same nesting level under `[token]/`), importing `resolveDeckAccess` from
  `../../../../../utility/deckAccess`.
- `export async function GET(request, { params })`: call
  `const { status } = await resolveDeckAccess(params.token);` and
  `return NextResponse.json({ valid: status === "unlocked" });`.
- Wrap in `try/catch` mirroring `unlock/route.js`'s pattern; on a thrown
  error, respond `{ valid: false }` (fail closed — an error resolving access
  should not be treated as "still valid") rather than a 500, since the
  client-side watcher only branches on the `valid` boolean, not on HTTP
  status.
- Why first: the client component built in Step 2 depends on this endpoint
  existing to poll against.
- Gotcha: this route must not be cached — confirm the response isn't
  eligible for any default route-handler caching. Since `resolveDeckAccess`
  itself calls `getDeckForRender`, which goes through `kirbyFetch`'s
  `cache: "no-store"`, and this handler reads `cookies()` (which already
  forces dynamic rendering for route handlers that use it, same as it does
  for `page.js`), no explicit `export const dynamic = "force-dynamic"` should
  be required — but verify by checking the response is not stale after a
  real password change during manual testing in Step 5.

### Step 2 — Build `DeckSessionWatcher.js`

- Create `next/components/DeckSessionWatcher.js`.
- `"use client"`. Props: `token`, `children`.
- Use `useEffect` with a dependency array of `[token]`: inside it, create
  `const interval = setInterval(async () => { ... }, 30000);` and return a
  cleanup function calling `clearInterval(interval)`.
- Inside the interval callback: `fetch(\`/portal/${token}/session-status\`)`
  inside a `try/catch`; on success, parse the JSON body and check
  `data.valid === false`; if so, call `window.location.reload()`. On a
  thrown error (network failure) or a non-OK response, do nothing and let
  the next tick retry — do not reload on failure, per the Data Flow section's
  "network failure" case.
- Render `return children;` — no wrapping DOM element, so it introduces no
  layout or styling changes to whatever it wraps.
- Why after Step 1: this component's fetch target must exist to test against.
- Gotcha: use a plain `fetch` (cookies are sent automatically for
  same-origin requests by default; no need for explicit `credentials:
  "include"` since this is same-origin, but confirm during manual testing
  that the `deck_session` cookie is actually being sent — if not, add
  `credentials: "same-origin"` explicitly).
- Gotcha: guard against firing an extra reload loop — after calling
  `window.location.reload()`, the component will unmount as the page
  navigates away, so no explicit "stop polling after first failure" flag is
  needed; the interval is naturally cleared on unmount along with everything
  else on the page.

### Step 3 — Wrap the unlocked branches in `page.js`

- In `next/app/(portal)/portal/[token]/page.js`, import
  `DeckSessionWatcher` from `../../../../components/DeckSessionWatcher`
  (same relative depth as the existing `DeckEmbed` import).
- Wrap each of the three unlocked-branch returns
  (`meta.contentType === "figma"`, `meta.contentType === "pdf"`, and the
  final "not ready yet" fallback) in
  `<DeckSessionWatcher token={params.token}>...</DeckSessionWatcher>`,
  passing the existing JSX for each branch as children unchanged.
- Do not wrap the `notfound()` call, the `"expired"` branch, or the
  `"locked"` (`PasswordGate`) branch — polling only matters once content is
  actually being shown; the plan in section 3 explicitly excludes the
  password screen from needing this.
- Why last: this is the integration point tying the new route and component
  into the actual page render, and depends on both prior steps existing.
- Gotcha: `DeckSessionWatcher` renders `children` transparently with no
  wrapping element, so no CSS/layout regression is expected from this
  wrapping — verify visually in Step 5 regardless, since `DeckPdfViewer` is
  loaded via `nextDynamic` with `ssr: false` and interacts with viewport
  sizing that could be sensitive to an unexpected wrapping element (it
  should not be, given `DeckSessionWatcher` returns `children` directly, but
  confirm no layout shift appears).

## 9. Edge Cases

- **Password changed and changed back before the next poll tick:** the poll
  at that point sees a hash that once again matches the session's
  `passwordHash` (assuming it changed back to the exact original value) and
  responds `valid: true` — no reload happens. Consistent with the earlier
  plan's equivalent edge case; the check is a live comparison each tick, not
  a sticky revocation flag.
- **Deck expires while being actively viewed:** already covered by the
  underlying `resolveDeckAccess` call inside `session-status` — expiry
  causes `status: "expired"`, which is not `"unlocked"`, so `valid: false`
  is returned and the same reload-and-redirect-to-locked-state flow applies.
  (`page.js` will then show the "This link has expired" block instead of
  `PasswordGate`, per its own existing branching — this plan does not change
  that branching, it only triggers the reload that lets it run again.)
- **Deck deleted/unpublished while being actively viewed:**
  `resolveDeckAccess` returns `status: "notfound"` (via `getDeckForRender`
  returning `null`), which is also not `"unlocked"` — same `valid: false` /
  reload path, landing on the standard 404 page after reload.
- **Visitor's network drops entirely for an extended period:** poll requests
  fail repeatedly; per Step 2's gotcha, failures are silently ignored and
  never force a reload. When connectivity returns, the next successful poll
  resumes normal behaviour. This means a visitor who is offline is not
  incorrectly kicked out purely due to connectivity loss — a deliberate
  choice, since a failed request is not evidence of an invalid session.
- **Multiple tabs/windows open to the same deck:** each runs its own
  independent `DeckSessionWatcher` instance and polls independently; each
  reloads independently once it detects the mismatch. No cross-tab
  coordination is needed or added.
- **Visitor unlocks a second, different deck in another tab while viewing
  this one:** irrelevant to this deck's watcher — the poll is scoped to
  `token`, checking only this deck's session validity, unaffected by
  activity on any other deck.
- **`session-status` route itself throws (e.g. Kirby temporarily
  unreachable):** per Step 1, the handler fails closed and returns
  `{ valid: false }` rather than propagating a 500. This means a transient
  Kirby outage could cause a live viewer to be reloaded and shown
  `PasswordGate` even though their password hasn't actually changed — a
  deliberate fail-closed trade-off consistent with the portal's existing
  "fails closed" philosophy (see the original deck-portal plan's handling of
  a missing `PORTAL_SESSION_SECRET`). If this proves too disruptive in
  practice (e.g. flaky KQL connectivity causing spurious reloads), a retry-
  before-reload could be added later, but is not in this plan's scope.
- **The reload itself happens mid-interaction (e.g. visitor is scrolling
  through a pdf or mid-figma-interaction):** an unavoidable consequence of
  reload-based kickoff, an accepted trade-off per Architecture Considerations
  section (hard reload chosen over a soft in-place swap). Any in-progress
  scroll position or embed state is lost, same as any other full page
  reload.

## 10. Test Considerations

**Manual (local dev against the real Kirby):**

1. Unlock a test deck, confirm content renders normally (figma and pdf decks
   both, to cover both wrapped branches).
2. With the tab still open and no manual reload, change that deck's password
   in the Kirby Panel. Wait up to ~30 seconds: confirm the tab automatically
   reloads and lands on `PasswordGate`, without any manual action.
3. Confirm the network tab shows periodic `GET
   /portal/<token>/session-status` requests roughly every 30 seconds while
   the deck is open, and that they stop once the page reloads into
   `PasswordGate` (since `DeckSessionWatcher` is not rendered on the locked
   branch).
4. Confirm a session-status request while the password has *not* changed
   returns `{ valid: true }` and causes no visible change.
5. Repeat step 2 for a deck whose content type is "not ready yet" (neither
   figma nor pdf configured) to confirm that branch is also wrapped and
   triggers a reload correctly.
6. Set a deck's expiry to the past while a session is open on that deck:
   confirm the same automatic reload occurs and lands on the "This link has
   expired" message (not `PasswordGate`).
7. Unpublish or delete a deck while a session is open on it: confirm the
   automatic reload lands on the standard 404 page.
8. Open the same unlocked deck in two separate tabs; change the password;
   confirm both tabs independently reload within ~30 seconds.
9. Simulate a network failure (e.g. browser devtools "offline" toggle)
   while viewing an unlocked deck without changing the password: confirm no
   reload happens while offline, and normal polling resumes once back
   online.
10. Regression: confirm decks whose password has *not* changed remain
    viewable indefinitely with periodic polling running quietly in the
    background, and that PDF scrolling/figma embed interaction is not
    visually disrupted by `DeckSessionWatcher` being present (no layout
    shift, no flicker).

**Automated (recommended, not blocking):**

- A route handler test for `session-status/route.js`: returns `{ valid: true
  }` for a valid session, `{ valid: false }` for a mismatched/missing/expired
  one, mirroring the existing `resolveDeckAccess` test cases from the prior
  plan.
- A component test for `DeckSessionWatcher` (e.g. with a mocked `fetch` and
  fake timers): confirms it polls at the expected interval, calls
  `window.location.reload()` only on an explicit `{ valid: false }` response,
  and does not reload on a fetch rejection.

## 11. Implementation Order

1. `next/app/(portal)/portal/[token]/session-status/route.js` — **new** — the
   endpoint the client will poll; built first since nothing else can be
   tested without it.
2. `next/components/DeckSessionWatcher.js` — **new** — the polling client
   component; depends on the route from step 1 existing to fetch against.
3. `next/app/(portal)/portal/[token]/page.js` — **modify** — wrap the three
   unlocked content branches in `DeckSessionWatcher`; the final integration
   step, done last since it depends on both prior files.
4. Manual QA pass per Test Considerations — in particular, confirm the
   live-reload behaviour actually fires within ~30 seconds of a real
   password change in the Kirby Panel, and that no other portal behaviour
   (expiry, 404, normal unlock) regressed.
