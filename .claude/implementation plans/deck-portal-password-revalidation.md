# Implementation Plan: Revalidate Deck Password on Every Load

## 1. Goal

Currently, once a client unlocks a deck at `/portal/<token>`, they stay unlocked
for up to 90 days purely because their session cookie is validly signed and
matches the deck's token — the actual password is never re-checked. If staff
change a deck's password in the Kirby Panel (to revoke access for someone who
should no longer see it, or because the password leaked), everyone already
holding a valid cookie keeps full access until that cookie naturally expires.
The only current workaround is rotating `PORTAL_SESSION_SECRET`, which logs out
every client on every deck at once. This change makes a per-deck password
change immediately revoke access for anyone whose session was minted against
the old password, without affecting other decks' sessions.

## 2. Current System Behaviour

- `resolveDeckAccess(token)` (`next/utility/deckAccess.js`) is called by the
  deck page server component on every request. It fetches deck meta via
  `getDeckForRender(token)`, checks expiry, reads the `deck_session` cookie,
  and calls `verifyDeckToken(cookieValue)`. The session is considered
  `unlocked` purely if `payload.deckId === token` — the password is not part
  of this check at all.
- `signDeckToken(deckId, expiresAt)` (`next/utility/deckSession.js`) signs a
  JWT with payload `{ deckId }` via `jose`, `HS256`, using
  `PORTAL_SESSION_SECRET`. It is only called from
  `next/app/(portal)/portal/[token]/unlock/route.js`, once, right after a
  correct password is submitted.
- `getDeckSecret(token)` (`next/queries/deckQuery.js`) is the only query that
  fetches the deck's `password` field from Kirby, and it is only called from
  the unlock route — never from the page component.
- `getDeckForRender(token)` fetches title, client, expiry, `figmaUrl`,
  `contentType`, and PDF file URL — deliberately excluding the password, so
  the page component's normal per-load fetch never touches it.
- The cookie is `httpOnly`, `path: /portal`, `sameSite: lax`, and expires at
  `effectiveExpiry(deckExpiry)` (min of the deck's own expiry date and
  now + 90 days).
- `comparePassword(submitted, stored)` does a length-guarded,
  `crypto.timingSafeEqual` comparison of trimmed UTF-8 buffers. It is only
  used in the unlock route.

## 3. Desired Behaviour

- Every time `/portal/<token>` is loaded (not just at unlock time), the system
  confirms that the session cookie was minted against the password the deck
  currently has in Kirby.
- If a deck's password has been changed in the Panel since a given cookie was
  issued, that cookie stops granting access: the visitor sees the password
  screen again, the same as if they'd never unlocked the deck. This applies
  immediately — no additional TTL or grace period.
- A visitor who enters the new password gets a fresh cookie and normal access,
  identical to first-time unlock today.
- This check runs alongside the existing expiry check, not in place of it. A
  session can be rejected for either reason.
- Every other deck's sessions (for decks whose password has not changed) are
  unaffected.
- No behavior changes for the unlock flow itself from the client's point of
  view — same form, same error messages, same POST endpoint.

## 4. Architecture Considerations

**Bind the session to a password fingerprint, not the plaintext password.**
The JWT payload is signed but not encrypted — anyone able to read the raw
cookie value (e.g. via browser devtools, despite `httpOnly` blocking page JS)
could decode the base64 payload. Embedding the plaintext password there would
leak it outside the one code path (the unlock route) that is supposed to see
it. Instead, `signDeckToken` embeds a SHA-256 hash of the trimmed password
(`passwordHash`) alongside `deckId`. SHA-256 (not a slow password-hashing
scheme like bcrypt) is appropriate here: this is a change-detection
fingerprint compared server-side on every page load, not a credential store
being defended against offline brute force — the real secret (the Kirby
password field) is never exposed to this check's output, and speed matters
because it runs on every deck view.

**The page component fetches the password on every load.** This is a
deliberate expansion of what `getDeckForRender` (or a new parallel query)
touches — previously password fetching was isolated to the unlock route only.
This is accepted: it's a normal server-side KQL call identical in shape to the
existing `getDeckSecret` call, the value never leaves the server (it's hashed
immediately and only the hash used for a boolean comparison), and it costs one
more field in an existing `no-store` KQL request that already runs on every
load.

**No new Kirby fields or blueprint changes.** The existing plaintext
`password` field is sufficient; hashing happens entirely in Next.

**No explicit cookie invalidation on mismatch.** Deleting/expiring the cookie
from within a mismatch detection that happens inside a React Server Component
is not straightforward — Next.js only allows setting cookies from Route
Handlers and Server Actions, not from render. Rather than adding a Server
Action or an extra round-trip just to clear the cookie, a mismatch is simply
treated as `locked` (same code path as "no cookie at all"). The stale cookie
sits inertly in the browser — it will keep failing the hash check on every
future load until the visitor unlocks again with the new password, at which
point the unlock route overwrites it with a fresh, valid cookie. This has no
functional downside; it's a purely cosmetic non-issue (the cookie is httpOnly
and never inspected by anything else).

**Old sessions minted before this change ship are treated as locked.** Their
JWT payload has no `passwordHash` field. The comparison is written so that a
missing or non-matching hash both fail identically — no special-cased
migration branch is needed. Practically, this means every currently-unlocked
client across every deck will see the password screen once after this ships,
even if their deck's password hasn't changed. This is treated as an
acceptable one-time side effect of shipping the fix, not a bug to design
around.

**Trade-off accepted:** this still doesn't add an audit log or a way to
selectively revoke a single client's session while leaving others on the same
password intact (impossible without per-client tokens, which the studio has
not asked for). Revocation granularity remains "whoever knows the current
password."

## 5. Data Flow

**Unlock (modified):** `PasswordGate` POSTs `{ password }` to
`/portal/<token>/unlock`, unchanged from today. The route calls
`getDeckSecret(token)`, compares the submitted password against
`deck.password` with `comparePassword` as before. On match, it now also
computes `passwordHash = hashPassword(deck.password)` and passes it into
`signDeckToken(token, passwordHash, expiresAt)`, which embeds
`{ deckId, passwordHash }` in the JWT. The cookie is set exactly as before.

**Page load (modified):** `resolveDeckAccess(token)` calls
`getDeckForRender(token)` as before for meta, and now also fetches the deck's
current password (either via an extended `getDeckForRender` result or a new
lightweight query — see Architecture) purely to compute its hash server-side.
It reads and verifies the cookie as before. If verification succeeds, it now
additionally computes `hashPassword(currentPassword)` and compares it against
`payload.passwordHash`. Both `deckId` match and `passwordHash` match are
required for `unlocked`. If either the token is missing/invalid, `deckId`
doesn't match, or `passwordHash` doesn't match (including when it's absent
from an old token), the result is `locked`, identical in downstream behaviour
to a visitor who never unlocked at all — they see `PasswordGate` again.

**Return visit after a password change:** Same as any other locked visit. The
visitor re-enters the (new) password, which produces a new hash embedded in a
freshly signed cookie, restoring normal access.

## 6. Component Responsibilities

### `next/utility/deckSession.js` (modified)

- **Responsible for:** (new) `hashPassword(password: string): string` — a pure
  SHA-256 hex digest of the trimmed password, using Node's `crypto` module
  (already imported for `timingSafeEqual`). (Modified) `signDeckToken(deckId,
  passwordHash, expiresAt)` — now takes and embeds `passwordHash` in the JWT
  payload alongside `deckId`. (Unmodified) `verifyDeckToken`, `comparePassword`,
  `effectiveExpiry`, `buildSessionCookieOptions`, `DECK_SESSION_COOKIE`.
- **Not responsible for:** deciding what counts as a match (that's the
  caller's job, in `deckAccess.js`); fetching the password from Kirby.
- **Exports (new/changed):** adds `hashPassword`; changes `signDeckToken`'s
  signature from `(deckId, expiresAt)` to `(deckId, passwordHash, expiresAt)`.

### `next/utility/deckAccess.js` (modified)

- **Responsible for:** (expanded) after verifying the token and matching
  `deckId` as today, also fetching the deck's current password, hashing it
  with `hashPassword`, and comparing it to `payload.passwordHash`. Returns
  `unlocked` only when deckId matches, the deck isn't expired, and the
  password hash matches.
- **Not responsible for:** setting or clearing cookies (unchanged — still only
  the unlock route does that); rendering.
- **Props/Input:** `token: string` (unchanged signature:
  `resolveDeckAccess(token)`).
- **State:** none (server-side function, unchanged).

### `next/queries/deckQuery.js` (modified)

- **Responsible for:** (new, or extended) exposing the deck's current
  password to `resolveDeckAccess` for hashing. Two implementation shapes are
  viable — see Step 3 for the chosen one.
- **Not responsible for:** hashing (stays in `deckSession.js`); this module
  only ever returns the raw password value to server-side callers, same
  guarantee as today's `getDeckSecret`.

### `next/app/(portal)/portal/[token]/unlock/route.js` (modified)

- **Responsible for:** (same as today) verifying the submitted password,
  checking expiry, plus now computing `passwordHash` from the same
  `deck.password` value it already fetched via `getDeckSecret`, and passing it
  into `signDeckToken`.
- **Not responsible for:** anything new — no behavioural change from the
  client's perspective.

### `next/app/(portal)/portal/[token]/page.js` (unmodified)

- Still calls `resolveDeckAccess(token)` and branches on `status`. No changes
  needed here — the extra check is fully encapsulated inside
  `resolveDeckAccess`.

### `PasswordGate.js`, `deckQuery.js`'s other exports, everything else

- Unmodified. No new props, no new client-visible behaviour.

## 7. Files Affected

| File | New/Mod | Why |
| --- | --- | --- |
| `next/utility/deckSession.js` | Mod | Add `hashPassword`; change `signDeckToken` to accept and embed `passwordHash`. |
| `next/utility/deckAccess.js` | Mod | Fetch current password, hash it, compare against the token's `passwordHash` before granting `unlocked`. |
| `next/queries/deckQuery.js` | Mod | Expose the deck's current password to `deckAccess.js` (extend `getDeckForRender` or add a new minimal query — decided in Step 3). |
| `next/app/(portal)/portal/[token]/unlock/route.js` | Mod | Compute `passwordHash` from the already-fetched `deck.password` and pass it to `signDeckToken`. |

No other files change. `page.js`, `PasswordGate.js`, blueprints, and Kirby
content are untouched.

## 8. Step-by-Step Implementation

### Step 1 — Add `hashPassword` to `deckSession.js`

- Add `import { createHash, timingSafeEqual } from "crypto";` (extend the
  existing `crypto` import rather than adding a new one).
- `export function hashPassword(password)`: guard `typeof password ===
  "string"`; return `createHash("sha256").update(password.trim(),
  "utf8").digest("hex")`. For a non-string input, return a fixed sentinel
  value that can never match a real hash (e.g. an empty string), so callers
  don't need to special-case invalid input separately.
- Why first: both the unlock route and `deckAccess.js` will depend on this
  same function producing identical output for the same password — it must
  exist and be correct before either caller is wired up.
- Gotcha: must trim the password exactly the same way `comparePassword` does,
  so a password compared as "equal" at unlock time always hashes to the same
  value it's compared against later. Reuse the same `.trim()` semantics, don't
  reimplement it differently.

### Step 2 — Change `signDeckToken`'s signature

- Change `export async function signDeckToken(deckId, expiresAt)` to
  `export async function signDeckToken(deckId, passwordHash, expiresAt)`.
- Change the payload from `{ deckId }` to `{ deckId, passwordHash }`.
- Why now: this is a breaking signature change — every call site must be
  updated in the same change (there is exactly one call site today, in the
  unlock route, updated in Step 4).
- Gotcha: `jose`'s `SignJWT` takes the payload object in its constructor; just
  widen that object, the rest of the chain (`setProtectedHeader`,
  `setIssuedAt`, `setExpirationTime`, `.sign`) is unchanged.

### Step 3 — Expose the current password to `deckAccess.js`

- Decision: extend `getDeckForRender(token)`'s KQL `select` to also pull
  `password: "page.password.value"`, and add `password: result.password ||
  ""` to its returned object. This avoids a second KQL round trip on every
  page load (the page component already awaits `getDeckForRender` first in
  `resolveDeckAccess`), at the cost of `getDeckForRender`'s result now
  carrying the password value in-process.
- Because `meta` (the object `getDeckForRender` returns) is passed from
  `page.js` into client components like `DeckPdfViewer`/`DeckEmbed` today,
  confirm in Step 5 that the `password` field is never spread or forwarded
  into any prop passed to a client component — only `deckAccess.js` reads it,
  and `page.js` must be checked to ensure it doesn't pass the full `meta`
  object into a client component wholesale (it currently passes
  `meta.title`, `meta.figmaUrl`, `meta.contentType`, `meta.pdfUrl`
  individually — confirm this stays itemized, not `{...meta}`).
- Why this shape over a new separate query: `getDeckForRender` already runs
  once per load; adding one field to its existing `select` is cheaper and
  simpler than a second KQL request purely to fetch a password for hashing.
- Gotcha: this field must never be included in any query result that flows
  into `generateMetadata` or any other output ultimately serialized to the
  client. Server components can leak data by passing full objects into props
  of "use client" children — verify `page.js` still destructures
  individual fields when rendering `DeckPdfViewer`/`DeckEmbed`.

### Step 4 — Update the unlock route to compute and pass the hash

- In `next/app/(portal)/portal/[token]/unlock/route.js`, import
  `hashPassword` from `deckSession.js` alongside the existing imports.
- After the existing `comparePassword` check succeeds, add
  `const passwordHash = hashPassword(deck.password);` before signing.
- Change the `signDeckToken` call from `signDeckToken(params.token,
  expiresAt)` to `signDeckToken(params.token, passwordHash, expiresAt)`.
- Why after Step 2: this is the call site that must match the new signature.
- Gotcha: use `deck.password` (the value already fetched via
  `getDeckSecret`), not a re-fetch — there is no reason to hit Kirby twice in
  the same request.

### Step 5 — Update `deckAccess.js` to compare hashes

- Import `hashPassword` from `deckSession.js` alongside the existing
  `DECK_SESSION_COOKIE`, `verifyDeckToken` imports.
- After `const meta = await getDeckForRender(token);` (which now includes
  `password`), continue with the existing expiry check unchanged.
- Where `unlocked` is currently computed as `payload?.deckId === token`,
  change it to also require the hash to match:
  `const currentHash = meta.password ? hashPassword(meta.password) : null;`
  `const unlocked = payload?.deckId === token && currentHash !== null &&
  payload?.passwordHash === currentHash;`
- The `currentHash !== null` guard handles a deck with an empty/blank password
  field (already unreachable in practice because the blueprint requires it,
  per the original plan's edge cases, but keeps this function safe if that
  ever changes) — never treat a blank stored password as matching a blank or
  missing token hash.
- Return `{ status: unlocked ? "unlocked" : "locked", meta }` exactly as
  today; `meta` still shouldn't include `password` in what ultimately reaches
  `page.js`'s downstream client-facing usage (see Step 3's gotcha) — `meta`
  itself can retain the field in the server-side return value of
  `resolveDeckAccess`, since `page.js` only forwards specific fields onward,
  but confirm that remains true.
- Why last: this is the actual behavioural change; it must land after
  `hashPassword` exists (Step 1), `signDeckToken` embeds the hash (Step 2),
  the unlock route populates it (Step 4), and the password is available on
  `meta` (Step 3).
- Gotcha: this function now does a hash computation on every single deck page
  load, including for expired/notfound decks where it's wasted work — order
  the checks so hashing only happens after the existing `notfound`/`expired`
  early returns, not before, to avoid unnecessary work on those paths (mirrors
  the existing check ordering, just confirming it isn't disturbed).

## 9. Edge Cases

- **Password unchanged:** hash matches on every load exactly as before;
  behaviourally identical to today for the common case.
- **Password changed while a client is actively viewing a deck (no new page
  load yet):** no effect until their next navigation/reload — this is a
  static server-rendered page per request, not a live-updating session; access
  revokes on the next request, not instantly mid-view. This is consistent
  with how `force-dynamic` + per-request auth normally behaves and is not
  something this plan changes.
- **Password changed to the same value it already was:** hash is identical,
  no effect — indistinguishable from "not changed" and correctly so.
- **Password field cleared to blank in the Panel:** `meta.password` is falsy,
  `currentHash` is `null`, so `unlocked` is always `false` regardless of the
  cookie — consistent with `comparePassword`'s existing guard against blank
  stored passwords at unlock time (deck can never be unlocked while blank,
  same as today).
- **Old cookie from before this change ships (no `passwordHash` in
  payload):** `payload?.passwordHash === currentHash` is `undefined ===
  <hex string>`, always `false` — treated as locked, forcing a one-time
  re-unlock. Documented in Architecture Considerations as an accepted,
  one-time side effect of the rollout, not an ongoing edge case to design
  around.
- **Two different decks, one password changed:** each deck's `deckId` scoping
  is unaffected — only cookies whose `deckId` matches the changed deck are
  subject to that deck's new hash; other decks' sessions are untouched, since
  the hash comparison is always against that specific deck's current
  password.
- **KQL request for `getDeckForRender` fails or times out:** unchanged from
  today's behaviour — whatever `kirbyFetch`'s existing retry/error handling
  does upstream of `resolveDeckAccess` is inherited as-is; no new failure mode
  introduced by adding one field to an existing select.
- **Stale cookie lingering in the browser after a mismatch:** as covered in
  Architecture Considerations, no explicit clearing; it fails the check every
  time until overwritten by a successful unlock. No functional impact.

## 10. Test Considerations

**Manual (local dev against the real Kirby):**

1. Unlock a test deck with its current password. Confirm normal access
   (unchanged from today).
2. Without touching the browser session, change that deck's password in the
   Kirby Panel. Reload `/portal/<token>` in the same browser: expect the
   password screen to reappear (previously it would have stayed unlocked).
3. Enter the new password: expect normal unlocked access again, with a fresh
   cookie.
4. Confirm a second, unrelated deck's existing session is unaffected by the
   first deck's password change — reload that deck's URL in the same browser
   session and confirm it's still unlocked.
5. Change the password back to its original value: reload with the *original*
   cookie still present (if not yet overwritten) — expect it to unlock again
   automatically, since the hash now matches again (confirms the check is a
   live comparison, not a one-time invalidation flag).
6. Confirm `view-source` on a locked page still shows no deck content, no
   password, consistent with the original plan's guarantees.
7. Test the blank-password edge case only if it's reachable in the actual
   Panel (it should be blocked by `required: true` on the field) — otherwise
   skip, documented as unreachable.
8. Regression: run through the original deck-portal manual test list (correct
   password, wrong password, expired deck, unknown token, layout switches) to
   confirm nothing else broke.

**Automated (recommended, not blocking):**

- Unit test for `hashPassword`: same input produces same output; different
  input produces different output; trims whitespace the same way
  `comparePassword` does.
- Unit test for the modified `signDeckToken`/`verifyDeckToken` round trip:
  payload now includes `passwordHash` and it survives sign/verify intact.
- Unit test (or an integration test against a mocked `getDeckForRender`) for
  `resolveDeckAccess`: unlocked when hash matches, locked when it doesn't,
  locked when the token predates this change (`passwordHash` absent), locked
  when the deck password is blank.

## 11. Implementation Order

1. `next/utility/deckSession.js` — **modify** — add `hashPassword`; change
   `signDeckToken`'s signature to accept and embed `passwordHash`. Pure logic,
   no dependents broken yet since nothing calls the new signature until Step
   2 below.
2. `next/app/(portal)/portal/[token]/unlock/route.js` — **modify** — update
   the one call site to compute `passwordHash` from the already-fetched
   `deck.password` and pass it into `signDeckToken`. Must happen right after
   Step 1 or the build breaks (signature mismatch).
3. `next/queries/deckQuery.js` — **modify** — extend `getDeckForRender`'s
   `select`/return shape to include `password`. Needed before Step 4 can read
   it.
4. `next/utility/deckAccess.js` — **modify** — import `hashPassword`, fetch
   the current password via `meta.password`, and require the hash match
   alongside the existing `deckId` match for `unlocked`. This is the step
   that actually turns the feature on.
5. Manual QA pass per Test Considerations — verify the password-change
   revocation works end-to-end and that no existing portal behaviour
   regressed.
