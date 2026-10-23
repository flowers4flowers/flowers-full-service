# Deck Login Company Field

## 1. Goal

Replace the deck login's "Username" field (which only accepts `client` or `admin`) with a free-text "What company are you from?" field. Any non-empty text logs the visitor in as a client and records their company. Typing `admin` still marks the session as internal. The company name is carried through GA4, Clarity and the daily Slack report so the team can see which companies viewed each deck, not just that "a client" did.

## 2. Current System Behaviour

- **`next/app/(portal)/portal/[token]/PasswordGate.js`:**
  - Renders a "Username" text input (`deck-username`, pre-filled `client`, autoComplete `username`, autoCapitalize none, spellCheck off) above the password input.
  - POSTs `{ username, password }` to the unlock route.
  - Error messages: `incorrect_username` "Incorrect username.", `incorrect_password` "Incorrect password.", `incorrect_both` "Incorrect username and password.", plus `expired` and `network`.
  - Tracks `deck_gate_view` with role `unknown`, and `deck_unlock` with `unlock_result` and the role returned by the server.
- **`next/utility/deckSession.js`:**
  - `resolveViewerRole(username)` trims and lowercases, returning `client` or `admin` on an exact match and null otherwise.
  - `signDeckToken(deckId, passwordHash, role, expiresAt)` signs a JWT with `deckId`, `passwordHash` and `role`.
  - `buildSessionCookieOptions(expiresAt, role)` omits `expires` for admin, making a browser-session cookie. Client cookies expire at the sooner of deck expiry or 90 days.
- **`next/app/(portal)/portal/[token]/unlock/route.js`:**
  - Resolves the role and compares the password, evaluating both before responding.
  - Returns 401 with `incorrect_both`, `incorrect_username` or `incorrect_password` plus `role`.
  - On success, signs the token with the role and returns `{ ok: true, role }`.
- **`next/utility/deckAccess.js`:** `resolveDeckAccess` requires the JWT role to be `client` or `admin` for `unlocked`, and returns `{ status, meta, role }`.
- **`next/app/(portal)/portal/[token]/pdf-file/route.js`:** requires a matching `deckId` and a `client` or `admin` role.
- **`next/utility/useDeckAnalytics.ts`:** `DeckDescriptor` has `token`, `title`, `client`, `type` and `role`. Base parameters are `deck_token`, `deck_title`, `deck_client`, `deck_type` and `viewer_role`. `trackUnlock(result, attemptRole?)` can override `viewer_role` for that event.
- **`next/components/DeckAnalytics.tsx`:**
  - Calls `setGAParams({ viewer_role })`.
  - Sets Clarity tags for deck token, title, client, type and `viewer_role` (skipping empty values).
  - Links the GA client ID to Clarity and sends one `deck_view`.
- **`next/components/DeckPdfViewer.js`:** receives `role` and passes it into the hook.
- **`next/app/(portal)/portal/[token]/page.js`:** reads `role` from `resolveDeckAccess` and passes it to `DeckAnalytics` and `DeckPdfViewer`.
- **`scripts/slack-analytics-daily.js` (`getGA4DeckData`):**
  - Queries six dimensions: event name, deck token, title, client, unlock result and viewer role.
  - Counts gate views regardless of role.
  - Counts successful unlocks, views, viewers and completions for `client` only, and failed unlocks for anything except `admin`.
  - Creates deck entries lazily.

## 3. Desired Behaviour

- **The label reads "What company are you from?"** The input has placeholder "e.g. Acme Studio", starts empty, and uses browser autofill for organisation names.
- **Login rules:**
  - Trimmed input equal to `admin` (case-insensitive) logs in as admin.
  - Any other non-empty input logs in as client.
  - Empty or whitespace-only input is rejected.
- **Validation messages:**

| Error kind | When | Message |
|---|---|---|
| `missing_company` | Company empty, password correct | "Please enter your company name. Any name is fine." |
| `incorrect_password` | Company provided, password wrong | "Incorrect password." |
| `missing_company_and_password` | Company empty, password wrong | "Please enter your company name (any name is fine) and check your password." |

  `expired` and `network` messages are unchanged.
- **The server stores a cleaned company string in the JWT as `company`:**
  - `admin` for admin sessions.
  - For clients: trimmed and capped at 100 characters, or `redacted` if it contains `@`.
- **Cookie lifetimes are unchanged.** Admin is a browser-session cookie; client lasts the sooner of deck expiry or 90 days.
- **Sessions issued by the previous username version stay valid.** They have a role but no company; their company is reported as `not provided`.
- **Every portal GA4 event carries `viewer_company`:**
  - On the gate it is `unknown`.
  - A successful `deck_unlock` carries the stored company.
  - Failed unlocks carry `unknown`.
  - All unlocked-deck events carry the session's company.
- **`viewer_company` is also applied page-wide** with gtag `set` alongside `viewer_role`, and set as a Clarity tag.
- **`unlock_result` values become** `success`, `incorrect_password`, `missing_company`, `missing_company_and_password`, `expired` and `error`.
- **Each Slack "Deck Activity" line ends with "Viewed by:"** and the client companies with a `deck_view` that day. The list is capped at 10 names plus "and N more".

## 4. Architecture Considerations

- **Server-authoritative company.** The company is cleaned on the server and stored in the signed, httpOnly JWT alongside the role. Analytics therefore uses the same value on every later page load without trusting client storage, and the browser code never duplicates the cleaning rules.
- **Role rule simplification.** `resolveViewerRole` changes meaning: null for empty, `admin` for an exact case-insensitive match, `client` for anything else. A separate `normalizeCompany` function in `deckSession.js` produces the stored company string. Keeping both in `deckSession.js` matches the agreed placement of login rules next to `comparePassword`.
- **Validation kept server-side only.** The input does not use the HTML `required` attribute, because browser-native validation would show a generic browser message instead of the agreed wording. The unlock route remains the single source of truth.
- **Backward-compatible sessions.** `deckAccess.js` keeps requiring only a valid role, so previous-version client sessions stay unlocked. Their missing `company` claim is defaulted to `not provided` when read. `pdf-file/route.js` therefore needs no change.
- **PII guard.** GA4 prohibits sending personally identifiable information such as email addresses. A free-text field invites people to type an email, so any value containing `@` is replaced with `redacted`. This is a minimal heuristic: it does not catch personal names or phone numbers. That limitation is accepted as consistent with the field's purpose.
- **100-character cap.** GA4 truncates event parameter values at 100 characters. Capping server-side makes the stored value, the GA4 value and the Clarity tag identical.
- **Slack companies.** Adding `customEvent:viewer_company` brings the deck query to 7 dimensions, within the Data API's per-request limit of 9. Collecting companies from client `deck_view` rows only keeps the "Viewed by" list consistent with the client-only view counts. The 10-name cap keeps each Slack field well under Slack's 2000-character field limit.

## 5. Data Flow

1. **The visitor loads a locked deck.** `PasswordGate` renders with role `unknown` and company `unknown`, and sends `deck_gate_view` carrying both.
2. **The visitor submits the form.** The company text and the password are POSTed as `{ company, password }`.
3. **The unlock route checks the deck** (404) and expiry (410). It resolves the role from the company text (null if empty) and compares the password.
   - If either check fails, it returns 401 with the matching error kind and `role` (null, or the role the text would resolve to).
   - If both pass, it cleans the company, signs a JWT with `deckId`, `passwordHash`, `role` and `company`, and sets the cookie (session-scoped for admin). It returns `{ ok: true, role, company }`.
4. **The gate handles the response.**
   - On success it sends `deck_unlock` with `viewer_role` and `viewer_company` from the response, then refreshes the route.
   - On failure it sends `deck_unlock` with the error kind as `unlock_result`, the returned role (or `unknown`) and the base company `unknown`, then shows the matching message.
5. **On render of an unlocked deck, `resolveDeckAccess` returns the role and company.** The company comes from the JWT, or `not provided` for older tokens. `page.js` passes both to `DeckAnalytics` and `DeckPdfViewer`.
6. **`DeckAnalytics` sets up tracking for the session.** It applies `viewer_role` and `viewer_company` page-wide via gtag `set`, sets both as Clarity tags, and sends `deck_view`. All `DeckPdfViewer` events carry both through the hook's base parameters.
7. **The daily Slack script groups by company.** It adds `customEvent:viewer_company` to the deck query and collects distinct company values from client `deck_view` rows per deck. It appends them to each deck's Slack field.

## 6. Component Responsibilities

### `next/utility/deckSession.js` (modified)
- **Responsible for:** role resolution from company text, company cleaning, and the company in the signed token.
- **Not responsible for:** HTTP responses or analytics.
- **Changes:**
  - **`resolveViewerRole`:** input is any value. It returns null if the input is not a string or is empty after trimming, `admin` if the trimmed lowercase value equals `admin`, and `client` otherwise.
  - **New `normalizeCompany`:** inputs are the raw company text and the resolved role. It returns `admin` when the role is admin. Otherwise it trims the value, returns `redacted` if it contains `@`, and else returns the first 100 characters.
  - **`signDeckToken`:** gains a `company` argument after `role` (before `expiresAt`), added to the payload as `company`.
  - **`buildSessionCookieOptions`:** unchanged.

### `next/app/(portal)/portal/[token]/unlock/route.js` (modified)
- **Responsible for:** validating that a company is provided and the password is correct, issuing the cookie with role and company, and returning both.
- **Request body:** `company` (string; missing, non-string or blank are treated as not provided) and `password` (string, required; unchanged 400 if missing).
- **Responses:**
  - 200 `{ ok, role, company }`
  - 401 `{ error, role }` with error `missing_company`, `incorrect_password` or `missing_company_and_password`
  - 400, 404, 410 and 500 unchanged

### `next/utility/deckAccess.js` (modified)
- **Return shape:** `{ status, meta, role, company }`. `company` is the JWT `company` claim or `not provided` when unlocked, and null otherwise. The unlock condition is unchanged.

### `next/utility/useDeckAnalytics.ts` (modified)
- **Changes:**
  - `DeckDescriptor` gains `company` (string, required).
  - The base parameters gain `viewer_company`.
  - `trackUnlock` gains a third optional argument, a company, which overrides `viewer_company` for that event when provided.

### `next/app/(portal)/portal/[token]/PasswordGate.js` (modified)
- **Responsible for:** the company field UI, sending `company`, showing the new messages, and tracking with role and company.
- **Props:** unchanged.
- **State:** `username` is renamed to `company`, with initial value an empty string.
- **Error map:** the three username-era keys are replaced by `missing_company`, `incorrect_password` and `missing_company_and_password`, with the messages in section 3.

### `next/components/DeckAnalytics.tsx` (modified)
- **Props:** gains `company` (string, required) via `DeckDescriptor`.
- **Responsible for (addition):** including `viewer_company` in the page-wide GA set and in the Clarity tags.

### `next/components/DeckPdfViewer.js` (modified)
- **Props:** gains `company` (string, required), forwarded to the hook.

### `next/app/(portal)/portal/[token]/page.js` (modified)
- **Responsible for (addition):** reading `company` from `resolveDeckAccess` and passing it to `DeckAnalytics` and `DeckPdfViewer`.

### `next/app/(portal)/portal/[token]/pdf-file/route.js`
- **No change.** It already requires a valid role, which previous and new sessions both carry.

### `scripts/slack-analytics-daily.js` (modified)
- **Responsible for (addition):** querying `viewer_company`, collecting client companies per deck, and printing "Viewed by".

## 7. Files Affected

- GA4 Admin (manual): register `viewer_company` as an event-scoped custom dimension.
- `next/utility/deckSession.js`: new role rule, company cleaning, company in the JWT.
- `next/app/(portal)/portal/[token]/unlock/route.js`: read `company`, new error kinds, sign and return company.
- `next/utility/deckAccess.js`: return company with a `not provided` default.
- `next/utility/useDeckAnalytics.ts`: `company` in the descriptor, `viewer_company` in the base params, company override on unlock.
- `next/app/(portal)/portal/[token]/PasswordGate.js`: company field, new messages, tracking with company.
- `next/components/DeckAnalytics.tsx`: page-wide and Clarity `viewer_company`.
- `next/components/DeckPdfViewer.js`: accept and forward `company`.
- `next/app/(portal)/portal/[token]/page.js`: pass company down.
- `scripts/slack-analytics-daily.js`: company dimension and "Viewed by" output.

## 8. Step-by-Step Implementation

### Step 1: Register `viewer_company` in GA4 (manual, do first)
- **What:** Admin → Data display → Custom definitions → Create custom dimension. Set name and event parameter to `viewer_company`, scope Event.
- **Why first:** dimensions are not retroactive, and the Slack query fails (the section is skipped) until it is registered.
- **Gotcha:** GA4 will warn about high cardinality. That is expected and acceptable for a company name.

### Step 2: `next/utility/deckSession.js`
- **What:**
  - Rewrite `resolveViewerRole` per section 6.
  - Add the exported `normalizeCompany` per section 6, using simple slicing to cap at 100 characters.
  - Add a `company` argument to `signDeckToken` between `role` and `expiresAt`, and include it in the JWT payload.
- **Why:** this centralises the new rules every later server step depends on.
- **Gotchas:**
  - The `signDeckToken` argument order changes again, and its only caller is the unlock route (Step 3). Logins break until Step 3 is done.
  - Only an exact `admin` match is admin; for example, "Admin Ltd" is a client.

### Step 3: `next/app/(portal)/portal/[token]/unlock/route.js`
- **What:**
  - Read `company` from the body instead of `username`. Resolve the role from it and compare the password, both before responding.
  - Return 401 `missing_company_and_password` when there is no role and the password is wrong, 401 `missing_company` when there is no role only, and 401 `incorrect_password` when the password is wrong only. Each 401 includes `role`.
  - On success, compute the cleaned company with `normalizeCompany`, pass it to `signDeckToken`, and return `{ ok: true, role, company }`.
- **Why:** this produces the new validation and stores the company.
- **Gotcha:** a browser still showing the previous page version sends `username`, not `company`. It receives `missing_company`, which the old page displays as the generic network message. A reload fixes it. This is acceptable.

### Step 4: `next/utility/deckAccess.js`
- **What:**
  - Add `company: null` to the not-found and expired returns.
  - In the final return, set `company` to the payload's `company` (if it is a non-empty string) or `not provided` when unlocked, and null when locked.
- **Why:** it exposes the company to `page.js` without logging out existing sessions.
- **Gotcha:** do not add company to the unlock condition. That would force-log-out sessions from the previous version, which was explicitly rejected.

### Step 5: `next/utility/useDeckAnalytics.ts`
- **What:**
  - Add `company: string` to `DeckDescriptor`, add `viewer_company` to the base parameters, and add `company` to the memo dependencies.
  - Extend `trackUnlock` with an optional third argument, the attempt company, which sets `viewer_company` in the event-specific params when provided (the same pattern as the role override).
- **Why:** every portal event carries the company.
- **Gotcha:** TypeScript flags `DeckAnalytics.tsx` until Step 7. The JavaScript callers (Steps 6, 8 and 9) are not type-checked, so they must be updated manually.

### Step 6: `next/app/(portal)/portal/[token]/PasswordGate.js`
- **What:**
  - Pass `company: "unknown"` into `useDeckAnalytics`.
  - Rename the `username` state to `company`, with initial value an empty string.
  - Change the label to "What company are you from?" with `htmlFor` `deck-company`.
  - Input changes:
    - id `deck-company`
    - placeholder "e.g. Acme Studio"
    - `autoComplete` set to `organization`
    - `autoCapitalize` set to `words`
    - `spellCheck` off, same classes
    - no `required` attribute
  - Send `{ company, password }`.
  - Replace the error message map entries and the known-kind check with the three new kinds.
  - On success, call `trackUnlock` with `success`, the returned role (or `unknown`) and the returned company (or `unknown`).
  - On 401, call it with the kind (or `error`) and the returned role (or `unknown`), without a company override.
- **Why:** this is the user-facing change, and it records company on successful logins.
- **Gotchas:**
  - Keep the password field's `autoFocus`. Moving focus to the company field would be friendlier now that it starts empty, but it was not requested, so leave it.
  - Placeholder text is not a label; the visible label remains for accessibility.

### Step 7: `next/components/DeckAnalytics.tsx`
- **What:**
  - Destructure `company` from props and pass it to `useDeckAnalytics`.
  - Include `viewer_company` in the existing `setGAParams` call.
  - Add `["viewer_company", company]` to the Clarity tags list, and add `company` to the effect dependencies.
- **Why:** this applies the company page-wide and in Clarity.

### Step 8: `next/components/DeckPdfViewer.js`
- **What:** add `company` to the destructured props and to the `useDeckAnalytics` descriptor.

### Step 9: `next/app/(portal)/portal/[token]/page.js`
- **What:** destructure `company` from `resolveDeckAccess`. Pass `company={company}` to both `DeckAnalytics` instances and to `DeckPdfViewer`.
- **Why:** this connects the server-known company end to end.

### Step 10: `scripts/slack-analytics-daily.js`
- **What:**
  - In `getGA4DeckData`, append `customEvent:viewer_company` to the dimensions and read it at index 6.
  - Add a `companies` collection (a set) to each deck entry created in `getDeck`.
  - In the client `deck_view` branch, add the company when it is not empty and not "(not set)".
  - Before returning, convert each deck's set to a sorted array.
  - In `formatSlackBlocks`, when a deck has companies, append a new line to its field text: "Viewed by: " followed by up to 10 names joined with commas, plus " and N more" when there are over 10.
- **Why:** shows which companies viewed each deck.
- **Gotchas:**
  - Converting to an array before returning keeps the data shape plain, in case the summary is ever logged or serialised.
  - Rows from the first day after deploy may have "(not set)" for company. These are excluded from the list but still counted as views when the role is `client`.
  - Sessions from the previous version report `not provided`, which appears in the list as-is. That is intended.

## 9. Edge Cases

- **Company typed as `Admin` or ` ADMIN `:** treated as admin, with company `admin`.
- **Company "Admin Ltd" or "the admin team":** client, with that company text.
- **Client types `admin`:** recorded as admin, excluded from client counts. This is the accepted shared-password trade-off.
- **Company with an email address** ("jane@acme.com"): logs in as client, company stored and sent as `redacted`.
- **Very long company text:** stored and sent as its first 100 characters.
- **Whitespace-only company:** rejected as `missing_company`.
- **Browser autofill fills an organisation name:** works as intended.
- **Session from the previous username version:** stays unlocked; analytics shows `viewer_company: not provided` until the next login.
- **Old cached page posting `username`:** gets `missing_company`; the old page shows the generic error; a reload shows the new form.
- **Same company typed in different capitalisation** ("acme" vs "Acme"): stored as typed, so these appear as separate values in GA4 and Slack. Normalising capitalisation was not requested; note as a possible follow-up if it becomes noisy.
- **GA4 treats numeric-looking company text as a number:** cosmetic only.

## 10. Test Considerations

- **Login matrix (manual, local):**
  - "Acme" with the correct password: unlocks as client.
  - "admin" and " Admin " with the correct password: unlock as admin, with a session cookie.
  - Empty company with the correct password: "Please enter your company name. Any name is fine."
  - "Acme" with a wrong password: "Incorrect password."
  - Empty company with a wrong password: the combined message.
  - Empty password: unchanged 400, showing the network message.
- **JWT inspection (locally only):** decode the cookie and confirm `role` and `company`.
  - "jane@acme.com" stores `redacted`.
  - A 150-character string stores 100 characters.
- **Backward compatibility:** with a cookie issued by the previous version (role but no company), confirm the deck stays unlocked and events carry `viewer_company: not provided`.
- **GA4 (Tag Assistant or DebugView):**
  - The gate view has `viewer_company: unknown`.
  - A successful unlock has the cleaned company.
  - `deck_view`, `deck_page_view` and `deck_complete` carry the company.
  - Failed unlocks carry the new `unlock_result` values.
- **Clarity:** after processing, filter by tag `viewer_company`.
- **Slack:** after `viewer_company` is registered and populated, run the script against a test webhook. Confirm the "Viewed by" lines list client companies only, and the more-than-10 truncation (testable by temporarily lowering the cap locally, then restoring it).
- **Automated tests:** none exist for the portal. `resolveViewerRole` and `normalizeCompany` are pure functions and the best candidates if tests are added later.

## 11. Implementation Order

1. **GA4 Admin custom dimension `viewer_company`:** manual. Registered first because of propagation time and the Slack query dependency.
2. **`next/utility/deckSession.js`:** existing file. New role rule, company cleaning and company in the JWT, which the server steps depend on.
3. **`next/app/(portal)/portal/[token]/unlock/route.js`:** existing file. Uses the new session functions for validation and to issue company-bearing cookies, restoring working logins.
4. **`next/utility/deckAccess.js`:** existing file. Returns the company for rendering, without invalidating existing sessions.
5. **`next/utility/useDeckAnalytics.ts`:** existing file. Adds `viewer_company` to all portal events so the components can pass it.
6. **`next/app/(portal)/portal/[token]/PasswordGate.js`:** existing file. Company field, new messages and company-aware unlock tracking, matching Step 3's API.
7. **`next/components/DeckAnalytics.tsx`:** existing file. Applies the company page-wide and in Clarity.
8. **`next/components/DeckPdfViewer.js`:** existing file. Forwards the company to the hook.
9. **`next/app/(portal)/portal/[token]/page.js`:** existing file. Passes the server company to the deck components, connecting everything.
10. **`scripts/slack-analytics-daily.js`:** existing file. Adds "Viewed by" last, once events carry `viewer_company` in production.
