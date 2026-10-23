# Deck Login Username and Viewer Role

## 1. Goal

Distinguish internal (admin) deck views from client deck views in analytics. Deck login gains a username field: clients use `client`, the internal team uses `admin`, both with the deck's existing password. The resulting role is stored in the signed session cookie and attached to every portal GA4 event as `viewer_role`, so GA4 and the daily Slack report can show decks seen by clients without hand-maintained lists of internal Clarity IDs. Admin sessions end when the browser closes; client sessions keep their current lifetime.

## 2. Current System Behaviour

- `next/app/(portal)/portal/[token]/PasswordGate.js` renders a single password field. On submit it POSTs `{ password }` to `/portal/[token]/unlock`. A 401 shows "Incorrect password.", a 410 shows "This link has expired.", anything else shows a network error. It tracks `deck_gate_view` on mount and `deck_unlock` with `unlock_result` of `success`, `incorrect`, `expired` or `error` through `useDeckAnalytics`.
- `next/app/(portal)/portal/[token]/unlock/route.js`:
  - Reads `password` from the JSON body (400 `missing` if absent or empty) and loads the deck secret from Kirby (404 if not found).
  - Checks deck expiry (410) and compares the password with `comparePassword` (401 `incorrect`).
  - On success, signs a JWT via `signDeckToken(deckId, passwordHash, expiresAt)` and sets it as the `deck_session` cookie using `buildSessionCookieOptions(expiresAt)`. `expiresAt` comes from `effectiveExpiry`: the sooner of the deck's expiry or 90 days from now.
- `next/utility/deckSession.js` holds the cookie name, JWT sign/verify (`jose`, HS256, secret from `PORTAL_SESSION_SECRET`), password hashing (sha256 of the trimmed password), the timing-safe `comparePassword`, and the cookie options. The cookie is httpOnly, sameSite lax, secure in production, path `/portal`, with an explicit `expires`.
- `next/utility/deckAccess.js` `resolveDeckAccess(token)` returns `{ status, meta }`. `unlocked` requires a valid JWT whose `deckId` matches the token and whose `passwordHash` matches the hash of the current Kirby password (so changing the password logs everyone out).
- `next/app/(portal)/portal/[token]/session-status/route.js` returns `{ valid }` from `resolveDeckAccess`. `DeckSessionWatcher` polls it every 30 seconds and reloads the page when invalid.
- `next/app/(portal)/portal/[token]/pdf-file/route.js` verifies the JWT itself and only checks `deckId`.
- `next/app/(portal)/portal/[token]/page.js` renders the gate when locked, and otherwise `DeckAnalytics` plus `DeckEmbed` or `DeckPdfViewer` inside `DeckSessionWatcher`, passing `token`, `title`, `client` and `type`.
- `next/utility/useDeckAnalytics.ts` builds the base parameters `deck_token`, `deck_title`, `deck_client`, `deck_type` and exposes one tracking function per portal event, each sending to GA4 (`trackEvent`) and Clarity (`clarityEvent`).
- `next/components/DeckAnalytics.tsx` sets four Clarity tags, links the GA client ID to Clarity via identify, and sends one `deck_view` per mount.
- `next/utility/analytics.ts` exposes `trackEvent` and `getGAClientId`, both via `sendGAEvent`, which pushes raw `arguments` to `dataLayer` (equivalent to `gtag(...)`).
- `scripts/slack-analytics-daily.js` `getGA4DeckData` queries yesterday's deck events by event name, deck token, title, client and unlock result. It aggregates gate views, unlocks, failed unlocks, views, viewers and completions per deck for the "Deck Activity" Slack section. There is no role dimension; all views are counted.

## 3. Desired Behaviour

- **The login form shows a "Username" text field above the password field,** pre-filled with `client`.
- **Accepted usernames are `client` and `admin`,** compared case-insensitively after trimming whitespace. Both use the deck's existing password.
- **Error messages are specific:**
  - unrecognised username with correct password: "Incorrect username."
  - recognised username with wrong password: "Incorrect password."
  - both wrong: "Incorrect username and password."
- **Successful login stores the role (`client` or `admin`) in the signed JWT.**
  - Client cookies keep the current lifetime (sooner of deck expiry or 90 days).
  - Admin cookies are browser-session cookies (no `expires`), deleted when the browser closes.
- **Existing sessions without a role become invalid.** Everyone currently logged in sees the login form on their next load, or within 30 seconds if the deck is open.
- **Every portal GA4 event carries `viewer_role`:**
  - `deck_gate_view` is `unknown`.
  - `deck_unlock` is the role recognised from the typed username, or `unknown` if unrecognised.
  - `deck_view`, `deck_page_view`, `deck_complete` and `deck_menu_open` carry the session's role.
- **On unlocked deck pages, `viewer_role` is also applied page-wide** via the gtag `set` command, so later automatic events (such as `user_engagement`) and the `navigation` event usually carry it. This is best effort.
- **Clarity sessions on unlocked decks are tagged `viewer_role`.**
- **`unlock_result` values become** `success`, `incorrect_username`, `incorrect_password`, `incorrect_both`, `expired` and `error`.
- **The Slack "Deck Activity" section counts only `client` events** for views, viewers, successful unlocks and completions. Failed unlocks exclude those typed as `admin`. Gate views are counted regardless, because role is unknown at that point.

## 4. Architecture Considerations

- **Role lives in the signed JWT, not a separate cookie.** The JWT is signed with `PORTAL_SESSION_SECRET` and httpOnly, so the role cannot be forged or altered client-side. The server reads it during render and passes it down as a prop, which keeps analytics tagging server-authoritative.
- **Role resolution is one server-side function in `deckSession.js`,** next to `comparePassword`, mapping a raw username to `client`, `admin` or null. Usernames are written as literals there, per the agreed "hardcoded" preference. The client never duplicates this logic: the unlock route returns the recognised role (or null) in every 401 and success response, and the gate uses that for analytics.
- **Revealing which credential was wrong is acceptable here.** The username is not a secret (clients are given `client`, and it is pre-filled), so naming it in errors leaks nothing meaningful. The password comparison remains timing-safe. The trade-off is slightly less defence against password guessing on a known username, which is no worse than today's single-field form.
- **Same password for both roles (confirmed).** Any client who types `admin` is recorded as admin. This is an accepted data-quality trade-off; no separate admin secret is added.
- **Forced logout via role validation.** `resolveDeckAccess` and the PDF route treat a JWT without a valid role as locked. No secret rotation is needed, and the existing `DeckSessionWatcher` polling surfaces it to open tabs within 30 seconds.
- **Admin session cookie.** Omitting `expires` makes a browser-session cookie. The JWT inside still carries the normal `exp` (sooner of deck expiry or 90 days) so server-side validation is unchanged.
  - **Known limitation:** browsers with session restore enabled (for example Chrome's "Continue where you left off") may keep session cookies across restarts. This was accepted when choosing option (a).
- **Page-wide `viewer_role` via gtag `set`.** Google's documentation states `set` applies to subsequent events on the page but "may not reliably propagate custom parameters". The automatic `page_view` usually fires before React effects run, so it is generally not tagged. The explicit per-event parameter on the deck events is the reliable signal; the `set` is supplementary.
- **`viewer_role` added to the descriptor in `useDeckAnalytics`.** It becomes a fifth base parameter, so every portal event carries it without call-site changes beyond passing the role. `trackUnlock` accepts an optional role override, because the gate's base role is `unknown` but each attempt may resolve a role.
- **Slack filtering in aggregation, not in the GA4 query.** The deck query adds `customEvent:viewer_role` as a dimension (6 of the 9 dimensions the Data API allows per request) and filters during aggregation. This keeps one query and lets gate views be counted regardless of role.

## 5. Data Flow

1. **The visitor loads `/portal/<token>`.** `resolveDeckAccess` reads the cookie. A JWT with no role, an invalid role, a wrong deck or a stale password hash means locked, and the gate renders with `role` `unknown` for analytics. `deck_gate_view` is sent with `viewer_role: unknown`.
2. **The visitor submits the form.** The username (pre-filled `client`, editable) and the password are POSTed as JSON to the unlock route.
3. **The unlock route checks the deck** (404) and expiry (410). It resolves the role from the username and compares the password. Both results are evaluated before responding.
   - If either fails, it returns 401 with an error kind (`incorrect_username`, `incorrect_password` or `incorrect_both`) and `role` (the recognised role or null).
   - If both pass, it signs a JWT with `deckId`, `passwordHash` and `role`. It sets the cookie (with `expires` for client, without for admin) and returns `{ ok: true, role }`.
4. **The gate reads the JSON response.** It sends `deck_unlock` with `unlock_result` and `viewer_role` (the returned role, or `unknown` when null). It then shows the matching error message, or calls `router.refresh()` on success.
5. **On refresh, `resolveDeckAccess` returns `unlocked` and the role from the JWT.** `page.js` passes `role` to `DeckAnalytics` and `DeckPdfViewer`.
6. **`DeckAnalytics` applies the role page-wide and tags the session.** It applies `viewer_role` to subsequent GA4 events on the page via gtag `set`, sets the Clarity tag `viewer_role`, and sends `deck_view` with `viewer_role`. `DeckPdfViewer`'s page, completion and menu events carry `viewer_role` through the hook's base parameters.
7. **`DeckSessionWatcher` keeps checking the session.** It polls `session-status`; old role-less cookies return `valid: false`, causing a reload to the gate.
8. **The Slack script reads the role back from GA4.** It queries yesterday's deck events including `customEvent:viewer_role` and aggregates client-only counts per deck.

## 6. Component Responsibilities

### `next/utility/deckSession.js` (modified)
- **Responsible for:**
  - resolving a username to a role
  - including the role in signed tokens
  - building cookie options that differ by role
- **Not responsible for:** HTTP responses, Kirby access, analytics.
- **Changes:**
  - New export: role resolver (input: unknown value; output: `"client"`, `"admin"` or null; trims and lowercases strings, returns null for non-strings).
  - `signDeckToken` gains a role argument, added to the payload as `role`.
  - `buildSessionCookieOptions` gains a role argument and omits `expires` when the role is `admin`.
- **State:** none.

### `next/app/(portal)/portal/[token]/unlock/route.js` (modified)
- **Responsible for:** validating username and password, issuing the role-bearing session cookie, and returning the role and error kind.
- **Not responsible for:** analytics, rendering.
- **Request body:**
  - `username`: string, optional. A missing or non-string value is treated as unrecognised.
  - `password`: string, required. Unchanged 400 if missing.
- **Responses:**
  - 200 `{ ok, role }`
  - 401 `{ error, role }`
  - 400, 404, 410 and 500 unchanged

### `next/utility/deckAccess.js` (modified)
- **Responsible for:** determining locked or unlocked status, and exposing the session role.
- **Return shape:** `{ status, meta, role }`, where `role` is `"client"` or `"admin"` when unlocked, otherwise null. A token without a valid role is treated as locked.

### `next/app/(portal)/portal/[token]/pdf-file/route.js` (modified)
- **Responsible for (addition):** also requiring a valid role in the JWT before serving bytes, so the PDF cannot be fetched with a pre-change cookie.

### `next/utility/analytics.ts` (modified)
- **Responsible for (addition):** a function that applies parameters page-wide via gtag `set`, using `sendGAEvent("set", params)` with the same SSR guard and try/catch as the other functions.

### `next/utility/useDeckAnalytics.ts` (modified)
- **Changes:**
  - `DeckDescriptor` gains `role` (string, required: `client`, `admin` or `unknown`).
  - The base parameters gain `viewer_role`.
  - `trackUnlock` gains an optional role argument that overrides `viewer_role` for that event only.
- **Not responsible for:** deciding the role.

### `next/app/(portal)/portal/[token]/PasswordGate.js` (modified)
- **Responsible for:** rendering the username field, sending the username, and showing specific error messages. Tracks gate views (role `unknown`) and unlock attempts (role from the server response).
- **Props:** unchanged (`token`, `deckTitle`, `client`, `type`).
- **State (addition):** `username` (string, initial `"client"`).
- **Error message map:** `incorrect` is replaced by `incorrect_username`, `incorrect_password` and `incorrect_both`. `expired` and `network` are unchanged.

### `next/components/DeckAnalytics.tsx` (modified)
- **Responsible for (addition):** applying `viewer_role` page-wide via the new GA set function and setting the Clarity tag `viewer_role`, both before `deck_view` is sent.
- **Props:** gains `role` (string, required) via `DeckDescriptor`.

### `next/components/DeckPdfViewer.js` (modified)
- **Props:** gains `role` (string, required), passed into `useDeckAnalytics`.

### `next/app/(portal)/portal/[token]/page.js` (modified)
- **Responsible for (addition):** reading `role` from `resolveDeckAccess` and passing it to `DeckAnalytics` and `DeckPdfViewer`.

### `scripts/slack-analytics-daily.js` (modified)
- **Responsible for (addition):** adding the `customEvent:viewer_role` dimension and filtering aggregation to client activity.

## 7. Files Affected

- GA4 Admin (manual): register `viewer_role` as an event-scoped custom dimension.
- `next/utility/deckSession.js`: role resolver; role in JWT; role-dependent cookie lifetime.
- `next/app/(portal)/portal/[token]/unlock/route.js`: accept username; specific 401 error kinds; return role; sign and set cookie with role.
- `next/utility/deckAccess.js`: require a valid role for unlocked; return role.
- `next/app/(portal)/portal/[token]/pdf-file/route.js`: require a valid role to serve the PDF.
- `next/utility/analytics.ts`: add the page-wide GA parameter function.
- `next/utility/useDeckAnalytics.ts`: add `role` to the descriptor and `viewer_role` to the base params; unlock role override.
- `next/app/(portal)/portal/[token]/PasswordGate.js`: username field, specific errors, role-aware unlock tracking.
- `next/components/DeckAnalytics.tsx`: page-wide `viewer_role` and Clarity tag.
- `next/components/DeckPdfViewer.js`: accept and forward `role`.
- `next/app/(portal)/portal/[token]/page.js`: pass role to deck components.
- `scripts/slack-analytics-daily.js`: role dimension and client-only aggregation.

## 8. Step-by-Step Implementation

### Step 1: Register `viewer_role` in GA4 (manual, do first)
- **What:** in GA4 Admin, go to Data display → Custom definitions → Create custom dimension. Set name and event parameter to `viewer_role`, scope Event.
- **Why first:** dimensions are not retroactive and take 24–48 hours to become usable. The Slack query in Step 12 fails (and the section is skipped) until it is registered.
- **Gotcha:** the name must not start with `ga_`, `google_` or `firebase_`; `viewer_role` is fine.

### Step 2: `next/utility/deckSession.js`
- **What:**
  - Add an exported role resolver. If the input is not a string, return null. Otherwise trim and lowercase it, then return `client` or `admin` if it matches one of them, and null otherwise.
  - Extend `signDeckToken` to accept a role (after `passwordHash`) and include it in the JWT payload as `role`.
  - Extend `buildSessionCookieOptions` to accept a role (second argument). Include `expires` only when the role is not `admin`.
- **Why:** this centralises the username rules and role persistence that every later server step depends on.
- **Gotchas:**
  - Changing `signDeckToken`'s argument order affects its only caller (the unlock route, Step 3). Update both together before testing.
  - The JWT `exp` for admins is still `effectiveExpiry`; only the cookie becomes session-scoped.
  - Use plain lowercase rather than locale-aware lowercasing so the result is predictable.

### Step 3: `next/app/(portal)/portal/[token]/unlock/route.js`
- **What:**
  - Read `username` from the body alongside `password`. Keep the existing 400 for a missing or empty password.
  - After the existing 404 and 410 checks, compute the role via the resolver and the password result via `comparePassword`.
  - If neither is valid, return 401 with error `incorrect_both`. If only the role is invalid, return `incorrect_username`. If only the password is invalid, return `incorrect_password`. Each 401 body includes `role` (the resolved role or null).
  - On success, sign the token with the role, set the cookie using options built with `expiresAt` and the role, and return `{ ok: true, role }`.
- **Why:** this produces the specific errors and the role-bearing session.
- **Gotchas:**
  - Always evaluate both checks before responding, so `incorrect_both` is possible and the response does not reveal password validity through timing differences.
  - Leave the 500 path and its logging unchanged.
  - A missing `username` key (an older cached page still sending only the password) resolves to null and yields `incorrect_username` or `incorrect_both`, which correctly prompts for a username.

### Step 4: `next/utility/deckAccess.js`
- **What:** extend the `unlocked` condition to also require that the payload's `role` is `client` or `admin`. Return `role` in the result: the payload role when unlocked, otherwise null. Include `role: null` in the `notfound` and `expired` returns for a consistent shape.
- **Why:** this forces logout of all pre-change sessions and exposes the role to `page.js`.
- **Gotcha:** `session-status/route.js` uses this function and needs no change. Its `valid` becomes false for old cookies, which triggers `DeckSessionWatcher`'s reload.

### Step 5: `next/app/(portal)/portal/[token]/pdf-file/route.js`
- **What:** extend the `unlocked` check to also require a `client` or `admin` role in the payload.
- **Why:** keeps PDF access consistent with page access, so old cookies cannot fetch the file directly.
- **Gotcha:** this route does not compare the password hash today. Leave that behaviour as is; it is out of scope.

### Step 6: `next/utility/analytics.ts`
- **What:** add an exported function that takes a parameter object and calls `sendGAEvent("set", params)`, with the same SSR guard and try/catch pattern as `getGAClientId`.
- **Why:** `DeckAnalytics` needs to apply `viewer_role` page-wide.
- **Gotcha:** values set this way persist for the rest of the page lifetime, including any client-side navigation within the same tab. The portal has no links into the main site, so this is not expected to leak admin tagging elsewhere.

### Step 7: `next/utility/useDeckAnalytics.ts`
- **What:**
  - Add `role: string` to `DeckDescriptor`. Add `viewer_role` (from `role`) to the memoized base parameters, and include `role` in the memo dependencies.
  - Change `trackUnlock` to accept an optional second argument, a role. When provided, it overrides `viewer_role` for that event by passing it in the event-specific params, which are spread after the base params.
- **Why:** every portal event automatically carries the role.
- **Gotcha:** `DeckAnalytics`, `DeckPdfViewer` and `PasswordGate` must all pass `role` after this step. TypeScript flags `DeckAnalytics`; the two JavaScript files will not be flagged, so update them in Steps 8 and 10.

### Step 8: `next/app/(portal)/portal/[token]/PasswordGate.js`
- **What:**
  - Pass `role: "unknown"` into `useDeckAnalytics`.
  - Add `username` state initialised to `"client"`.
  - Render a "Username" label and text input above the password label, with the same classes as the password input:
    - id `deck-username`
    - `autoComplete` set to `username`
    - `autoCapitalize` set to `none`
    - `spellCheck` false
  - Keep `autoFocus` on the password input.
  - Include `username` in the POST body.
  - Replace the `incorrect` entry in `ERROR_MESSAGES` with:
    - `incorrect_username`: "Incorrect username."
    - `incorrect_password`: "Incorrect password."
    - `incorrect_both`: "Incorrect username and password."
- **Response handling:**
  - Parse the JSON body for 200 and 401 responses.
  - On success: track unlock `success` with the returned role, then `router.refresh()`.
  - On 401: use the body's `error` as both the error kind and the `unlock_result`, and track with the returned role, or `unknown` if null. If the body cannot be parsed or the error kind is not one of the three, fall back to `network` for display and `error` for tracking.
  - 410 and other statuses keep their current behaviour, tracked with role `unknown`.
- **Why:** this is the user-facing change, and it records each attempt's role.
- **Gotchas:**
  - Track before `router.refresh()`, as today.
  - The pre-filled `client` value means existing clients only need the password, as before.
  - The `login` form semantics, with username and password fields, may cause browsers to offer to save credentials for the site. This is harmless.

### Step 9: `next/components/DeckAnalytics.tsx`
- **What:**
  - Destructure `role` from props and pass it to `useDeckAnalytics`.
  - At the start of the mount effect, before the existing tags and client ID request, call the new GA set function with `viewer_role` equal to the role.
  - Add `["viewer_role", role]` to the Clarity tags list.
  - Add `role` to the effect dependencies.
- **Why:** this tags later automatic GA4 events on the page and the Clarity session.
- **Gotcha:** the GA set is queued on `dataLayer` before `deck_view` is sent, so ordering is preserved.

### Step 10: `next/components/DeckPdfViewer.js`
- **What:** add `role` to the destructured props and to the `useDeckAnalytics` descriptor.
- **Why:** page, completion and menu events carry `viewer_role`.

### Step 11: `next/app/(portal)/portal/[token]/page.js`
- **What:** destructure `role` from `resolveDeckAccess` alongside `status` and `meta`. Pass `role={role}` to both `DeckAnalytics` instances and to `DeckPdfViewer`. `PasswordGate` is unchanged (it uses `unknown` internally).
- **Why:** this connects the server-known role to the client components.
- **Gotcha:** on the "not ready" branch, nothing receives the role; this is unchanged.

### Step 12: `scripts/slack-analytics-daily.js`
- **What:** in `getGA4DeckData`, add the `customEvent:viewer_role` dimension at the end of the dimension list and read it from the corresponding row index. In aggregation:
  - `deck_gate_view`: count regardless of role.
  - `deck_unlock`: count as successful only when the result is `success` and the role is `client`. Count as failed when the result is not `success` and the role is not `admin`.
  - `deck_view` and `deck_complete`: count only when the role is `client`, including the viewers and total views tallies.
- **Why:** the report shows client activity only.
- **Gotchas:**
  - Until `viewer_role` is registered, the whole deck query fails and the section is skipped. Do Step 1 first.
  - Yesterday's events from before deploy have `viewer_role` "(not set)" and are excluded from client counts on the first report after deploy.
  - Do not create a deck entry for a token whose only rows are excluded admin rows: either create entries lazily only when a counted row exists, or skip decks whose counts are all zero during formatting.

## 9. Edge Cases

- **Client types `Admin`:** recognised as admin; their views are excluded from client counts. Accepted trade-off of a shared password.
- **Username with surrounding spaces or mixed case** (`  CLIENT `): accepted as client.
- **Empty username:** treated as unrecognised; shows "Incorrect username." (or "Incorrect username and password.").
- **Browser autofill overwriting the pre-filled username** with a saved value: if the saved value is `admin` or `client`, it works; otherwise the specific error tells the user what to fix.
- **Old cookie on an open deck tab:** within 30 seconds, `DeckSessionWatcher` sees `valid: false` and reloads to the gate.
- **Admin browser with session restore:** the admin cookie may survive a restart. This was accepted when choosing option (a); the admin can clear cookies or use a private window.
- **Admin and client in the same browser:** only one `deck_session` cookie exists for `/portal`, so the last login wins and the role follows it.
- **Deck password changed in Kirby:** the existing password-hash check still logs everyone out, regardless of role.
- **Unlock response not JSON** (proxy error page): falls back to the network error message and `unlock_result: error`.
- **Automatic `page_view` on an unlocked deck lacks `viewer_role`:** expected; use the `deck_view` event for role-filtered view counts.
- **Gate views by admins** are counted in Slack gate views, because role is unknown before login. This is documented in the report semantics.

## 10. Test Considerations

- **Login matrix (manual, local):**
  - `client`, `Client`, `  CLIENT  ` and `admin`, each with the correct password: all unlock.
  - `clinet` with the correct password: "Incorrect username."
  - `client` with a wrong password: "Incorrect password."
  - `clinet` with a wrong password: "Incorrect username and password."
  - Empty password: unchanged 400 behaviour, showing the network message.
- **Cookie inspection (DevTools, Application tab):**
  - After a client login, `deck_session` has an expiry date.
  - After an admin login, it shows "Session".
  - Decode the JWT payload (for example with jwt.io, locally only) to confirm `role` is present.
- **Forced logout:** with a cookie issued before this change, load the deck and confirm the gate appears. With the deck already open, confirm it reloads to the gate within 30 seconds. Confirm a direct request to `/portal/<token>/pdf-file` with the old cookie returns 404.
- **Admin session end:** log in as admin, fully quit the browser (with session restore off), reopen, and confirm the gate appears. Repeat as client and confirm the deck stays unlocked.
- **GA4 (Tag Assistant or DebugView):**
  - `deck_gate_view` has `viewer_role: unknown`.
  - A failed `deck_unlock` with username `admin` has `viewer_role: admin` and `unlock_result: incorrect_password`.
  - A successful unlock, then `deck_view`, `deck_page_view` and `deck_complete`, all carry the session role.
  - `user_engagement` events after unlock show `viewer_role`; this is best effort, so note if absent.
- **Clarity:** after processing, filter recordings by tag `viewer_role` = `admin` and `client`.
- **Slack:** after `viewer_role` has been registered and populated for a day, run the script against a test webhook. Confirm admin-only decks do not show views, and client views are counted.
- **Automated tests:** none exist for the portal. If added later, the role resolver in `deckSession.js` and the unlock route's error matrix are the highest-value unit targets.

## 11. Implementation Order

1. **GA4 Admin custom dimension `viewer_role`:** manual. Registered first because of the 24–48 hour propagation and because the Slack query depends on it.
2. **`next/utility/deckSession.js`:** existing file. Adds the role resolver, the role in the JWT and role-based cookie lifetime that all server steps rely on.
3. **`next/app/(portal)/portal/[token]/unlock/route.js`:** existing file. Uses the new session functions to validate the username and issue role-bearing cookies.
4. **`next/utility/deckAccess.js`:** existing file. Requires and returns the role, which forces logout of old sessions and feeds `page.js`.
5. **`next/app/(portal)/portal/[token]/pdf-file/route.js`:** existing file. Applies the same role requirement to PDF access, completing the server side.
6. **`next/utility/analytics.ts`:** existing file. Adds the page-wide GA set function needed by `DeckAnalytics`.
7. **`next/utility/useDeckAnalytics.ts`:** existing file. Adds `role` and `viewer_role` to the shared tracking so all components can pass it.
8. **`next/app/(portal)/portal/[token]/PasswordGate.js`:** existing file. Adds the username field, specific errors and role-aware unlock tracking, using Steps 3 and 7.
9. **`next/components/DeckAnalytics.tsx`:** existing file. Applies the role page-wide and in Clarity, using Steps 6 and 7.
10. **`next/components/DeckPdfViewer.js`:** existing file. Forwards `role` to the hook.
11. **`next/app/(portal)/portal/[token]/page.js`:** existing file. Passes the server role to the deck components, connecting everything end to end.
12. **`scripts/slack-analytics-daily.js`:** existing file. Adds client-only filtering last, once events carry `viewer_role` in production.
