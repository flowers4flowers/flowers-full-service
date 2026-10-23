# Deck Portal Analytics

## 1. Goal

Make deck portal activity queryable in GA4 and filterable in Clarity without cross-referencing Clarity user IDs by hand. Today there is no way to tell, from analytics alone, whether a visitor only saw the password screen or actually unlocked and read a deck, which deck they saw, or how far they got through it. This change adds deck-specific events with deck metadata, links each GA4 visitor to their Clarity recordings, removes the duplicate GA4 loading that inflates page view counts sitewide, and adds a deck section to the daily Slack analytics report.

## 2. Current System Behaviour

- `next/app/layout.js` loads GA4 (`G-YSM33VGFQP`) twice: once via a raw `gtag.js` script tag plus an inline `gtag('config', ...)` block in `<head>`, and again via the `<GoogleAnalytics>` component from `@next/third-parties/google` in `<body>`. Both call `config`, so each page load sends two `page_view` hits. GTM (`GTM-TNKNK842`) is also loaded and may contain a third GA4 tag; its contents are not visible from the codebase.
- Clarity (`vioyjktsk2`) is loaded via an inline snippet in `<head>`. The snippet defines a `window.clarity` stub that queues calls until the real script loads. No code calls `clarity("set" | "event" | "identify")`.
- `next/utility/analytics.ts` exposes `trackEvent`, which forwards to `sendGAEvent` from `@next/third-parties/google`. `sendGAEvent` pushes its raw `arguments` object onto `window.dataLayer` (verified in the installed v16.0.10 source), so it behaves exactly like calling `gtag(...)`. It only works after `<GoogleAnalytics>` has rendered, because that component sets the module-level data layer name.
- `next/utility/analytics-events.ts` holds the `AnalyticsEvent` and `AnalyticsCategory` enums.
- `next/components/AnalyticsPageTracker.tsx` (in the root layout, now wrapped in `<Suspense>`) sends a generic `navigation` event on every route change. This is the only analytics the portal currently produces.
- The portal route `next/app/(portal)/portal/[token]/page.js` is a server component. It calls `resolveDeckAccess(token)` and renders one of: a 404, an "expired" message, `PasswordGate` (locked), `DeckEmbed` inside `DeckSessionWatcher` (Figma), `DeckPdfViewer` inside `DeckSessionWatcher` (PDF), or a "not ready" message inside `DeckSessionWatcher`. The resolved `meta` object contains `title`, `client`, `contentType`, `figmaUrl`, `pdfUrl`, `expiry`, `password`.
- `PasswordGate.js` is a client component. It POSTs to `/portal/[token]/unlock` and branches on the response: ok triggers `router.refresh()`, 401 shows "incorrect", 410 shows "expired", anything else or a thrown error shows "network". It receives `token` and `deckTitle` only.
- `DeckPdfViewer.js` holds `currentPage`, `numPages`, `menuOpen` and other state. All page changes go through `setCurrentPage`, which is passed directly as `onNavigate` to `DeckPdfNav` (arrow buttons), `useDeckKeyboardNav` (keyboard) and `DeckPdfMenu` (thumbnail clicks). The menu is toggled by `DeckPdfNav`'s `onToggleMenu`.
- `DeckEmbed.js` renders a Figma iframe. Interaction inside the iframe is not observable from the parent page.
- `scripts/slack-analytics-daily.js` runs daily in GitHub Actions. It queries the GA4 Data API for yesterday's page views per `pagePath`, events per `pagePath`/`eventName`/`customEvent:event_label`, and traffic sources, then posts Slack blocks. Portal paths currently appear as raw `/portal/<token>` entries in the "Page Visits & Engagement" section. Each fetch function has its own try/catch and returns `null` on failure; the report still sends if at least one GA4 fetch succeeds.

## 3. Desired Behaviour

- GA4 is loaded once in code (via `<GoogleAnalytics>` only). Any GA4 tag inside GTM for the same measurement ID is paused manually.
- The portal sends six new GA4 events, each also mirrored to Clarity as a Clarity event of the same name:
  - `deck_gate_view` when the password screen mounts.
  - `deck_unlock` when a password submission resolves, with `unlock_result` of `success`, `incorrect`, `expired` or `error`.
  - `deck_view` once per page load of an unlocked Figma or PDF deck, including `visitor_id`.
  - `deck_page_view` on every PDF page change, including page 1 on first load, with `page_number`, `page_count` and `nav_source` (`initial`, `arrows`, `keyboard`, `menu`).
  - `deck_complete` the first time the last PDF page is shown in a page load, with `page_count`.
  - `deck_menu_open` each time the PDF thumbnail menu is opened (not when closed).
- Every portal event carries `deck_token`, `deck_title`, `deck_client` and `deck_type`, uses the new `portal` event category, and uses the deck title as `event_label`.
- On an unlocked deck, the Clarity session is tagged with `deck_token`, `deck_title`, `deck_client` and `deck_type`, and Clarity's `identify` is called with the GA4 client ID as both the custom ID and the friendly name. Searching Clarity's "Custom user ID" filter for a GA4 client ID returns that visitor's recordings.
- The daily Slack report gains a "Deck Activity" section listing, per deck, yesterday's deck views, unique viewers, successful unlocks, failed unlocks, password screen views and completions. `/portal/...` paths are removed from the general page list.
- No visible UI changes.

## 4. Architecture Considerations

- **Reuse the existing GA layer.** All GA4 sends go through `trackEvent` so they share its SSR guard, error handling and `event_category`/`event_label` mapping. New event names are added to the existing `AnalyticsEvent` enum and a new `PORTAL` member to `AnalyticsCategory`, matching how other events are defined. Event parameter names (`deck_token`, `page_number`, etc.) are written as string literals where used, per the agreed preference; they are only written in one place (the hook) so drift risk is low.
- **Separate Clarity wrapper (`utility/clarity.ts`).** Clarity calls are isolated in a small module mirroring `analytics.ts`: guarded for SSR, guarded for `window.clarity` not being a function (ad blockers), wrapped in try/catch. This keeps Clarity specifics out of components and makes a future sitewide use trivial.
- **One portal hook (`utility/useDeckAnalytics.ts`).** It takes the deck descriptor and returns stable, memoized tracking functions. It builds the four shared deck parameters once and sends each event to both GA4 and Clarity. Components never construct parameter objects themselves. Placing it in `utility/` alongside `useAnalytics.ts` follows the existing analytics pattern; the deck-specific `useDeckKeyboardNav` lives in `components/`, but analytics hooks live in `utility/`, so `utility/` is the better match.
- **Dedicated `DeckAnalytics` component rather than extending `DeckSessionWatcher`.** The watcher's single job is session validity polling. Putting view tracking and Clarity identification in its own render-nothing component keeps responsibilities separate and lets the server page decide exactly which branches count as a "view" (Figma and PDF only, not "not ready").
- **`deck_view` fires on unlocked mount, not on PDF render completion.** The server only renders the deck branches after verifying the session cookie, so mounting is a reliable "unlocked and shown" signal and works identically for Figma and PDF. Trade-off: a visitor whose PDF fails to download still logs a `deck_view`. Detecting load failures is out of scope.
- **GA4 client ID retrieval via `sendGAEvent("get", ...)`.** Because `sendGAEvent` pushes a real `arguments` object, it can queue a gtag `get` command for `client_id` with a callback, without touching `window.gtag` directly. The callback fires only once gtag.js has loaded and may never fire if GA is blocked, so `deck_view` must not wait indefinitely; a short timeout fallback sends it without the client ID.
- **Navigation source without changing child components.** `DeckPdfViewer` creates three stable wrapper callbacks (arrows, keyboard, menu) that record the source in a ref and then set the page. `DeckPdfNav`, `DeckPdfMenu` and `useDeckKeyboardNav` keep their current props and behaviour. A single effect on `currentPage` sends `deck_page_view`, which guarantees exactly one event per actual page change regardless of which control caused it.
- **Engagement time is not custom-built.** GA4's automatic `user_engagement` already provides engagement time per page path, which for the portal equals time per deck.
- **Removing the head gtag script, not the component.** `trackEvent` depends on `<GoogleAnalytics>` having rendered (`sendGAEvent` warns and drops events otherwise), so the component is the one that must stay. The component's inline init script still defines a global `gtag`.
- **Privacy.** Deck title and client name are sent to Google and Microsoft (confirmed acceptable). The password itself is never included in any event. Clarity masks input contents by default, so the password field is not recorded.
- **Slack report isolation.** The deck query is a separate function with its own try/catch. If the GA4 custom dimensions are not yet registered, the Data API rejects the request; the function returns `null` and the section is skipped while the rest of the report still sends.
- **Uncertainty: GTM contents.** Whether `GTM-TNKNK842` contains a GA4 tag cannot be determined from the repo. This is handled as a manual check.

## 5. Data Flow

1. The browser requests `/portal/<token>`. The server page resolves `meta` from Kirby and builds a plain deck descriptor with `token` (from the route param), `title` (`meta.title`), `client` (`meta.client`) and `type` (`meta.contentType`).
2. **Locked:** the page renders `PasswordGate` with the descriptor. On mount, the gate calls the hook's gate-view function, which sends `deck_gate_view` to GA4 through `trackEvent` → `sendGAEvent` → `window.dataLayer` → gtag.js → GA4, and calls `clarity("event", "deck_gate_view")`.
3. On password submit, the gate awaits the unlock route's response, maps the status to an `unlock_result` string, and calls the hook's unlock function before acting on the result (before `router.refresh()` for success). GA4 receives `deck_unlock` with `unlock_result`; Clarity receives the `deck_unlock` event.
4. **Unlocked:** after `router.refresh()`, the server re-renders the deck branch. The page renders `DeckAnalytics` (with the descriptor) next to the deck content inside `DeckSessionWatcher`, and passes the descriptor to `DeckPdfViewer` for PDF decks.
5. `DeckAnalytics` mounts and immediately sets the four Clarity tags. It then queues a gtag `get client_id` request. When the client ID arrives, it calls `clarity("identify", clientId, undefined, undefined, clientId)` and sends `deck_view` with `visitor_id`. If the ID has not arrived within the timeout, it sends `deck_view` without `visitor_id`, and ignores a late callback for `deck_view` purposes (identify may still run).
6. **PDF only:** once `numPages` is known, `DeckPdfViewer`'s page effect sends `deck_page_view` for page 1 with `nav_source` `initial`. Each later page change via arrows, keyboard or menu sets the source ref, updates `currentPage`, and the effect sends `deck_page_view` with that source. When `currentPage` equals `numPages` for the first time, it also sends `deck_complete`. Opening the menu sends `deck_menu_open`.
7. In GA4, the events and their parameters are stored. After the parameters are registered as event-scoped custom dimensions, they are available in Explore, standard reports and the Data API as `customEvent:<name>`.
8. Daily, the Slack script queries the Data API for yesterday's portal events grouped by deck and unlock result, aggregates them per deck token, and posts them as a "Deck Activity" section.

## 6. Component Responsibilities

### `utility/clarity.ts` (new)
- **Responsible for:** safely calling Clarity's `set`, `event` and `identify` APIs from the browser.
- **Not responsible for:** deciding what to track, building parameters, GA4.
- **Exports:** a tag-setting function (key: string, value: string), an event function (name: string), and an identify function (customId: string, friendlyName: string, optional). Each returns nothing and never throws.
- **State:** none. Declares the global `window.clarity` type for TypeScript.

### `utility/analytics.ts` (modified)
- **Responsible for (addition):** retrieving the GA4 client ID asynchronously via a callback-based function that queues a gtag `get` command for `G-YSM33VGFQP` and `client_id` using `sendGAEvent`.
- **Not responsible for:** timeouts or deciding what to do with the ID; the caller handles that.
- **State:** none.

### `utility/analytics-events.ts` (modified)
- **Responsible for:** the canonical list of event names and categories. Adds `DECK_GATE_VIEW`, `DECK_UNLOCK`, `DECK_VIEW`, `DECK_PAGE_VIEW`, `DECK_COMPLETE`, `DECK_MENU_OPEN` to `AnalyticsEvent` and `PORTAL` to `AnalyticsCategory`.

### `utility/useDeckAnalytics.ts` (new)
- **Responsible for:** building the shared deck parameters and exposing one stable function per portal event that sends to both GA4 (via `trackEvent`) and Clarity (via the event function).
- **Not responsible for:** deciding when to fire events, deduplication, Clarity tags or identify (those belong to `DeckAnalytics`).
- **Input:** a deck descriptor with `token` (string, required), `title` (string, required, may be empty), `client` (string, required, may be empty), `type` (string, required, may be empty).
- **Returns:** functions for gate view (no args), unlock (result string), deck view (optional client ID string), page view (page number, page count, nav source), complete (page count), menu open (no args).
- **State:** none; memoizes on the four primitive descriptor fields, not object identity.

### `components/DeckAnalytics.tsx` (new)
- **Responsible for:** on mount of an unlocked deck, setting Clarity tags, linking the GA4 client ID to Clarity via identify, and sending exactly one `deck_view` per mount.
- **Not responsible for:** page-level PDF tracking, gate or unlock events, rendering anything.
- **Props:** `token` (string, required), `title` (string, required), `client` (string, required), `type` (string, required). Flat props rather than one object, to keep memoization keyed on primitives.
- **State:** a ref flag ensuring `deck_view` is sent once even if both the callback and the timeout resolve, and a ref holding the timeout handle for cleanup. Renders `null`.

### `PasswordGate.js` (modified)
- **Responsible for (addition):** sending `deck_gate_view` once on mount and `deck_unlock` with the mapped result after each submission.
- **Not responsible for:** Clarity tags or identify (the session is not yet unlocked).
- **Props:** existing `token` and `deckTitle`, plus new `client` (string, required, may be empty) and `type` (string, required, may be empty). The hook descriptor is built from `token`, `deckTitle`, `client`, `type`.
- **State (addition):** a ref flag guarding the single gate-view send.

### `DeckPdfViewer.js` (modified)
- **Responsible for (addition):** tracking page views with navigation source, completion, and menu opens.
- **Props:** existing `pdfUrl`, plus new `token`, `title`, `client`, `type` (all strings, required).
- **State (addition):** a ref for the pending navigation source (default `initial`), a ref for the last tracked page number, and a ref flag for completion sent.

### `page.js` (portal route, modified)
- **Responsible for (addition):** passing deck metadata to `PasswordGate`, `DeckPdfViewer` and the new `DeckAnalytics`, and rendering `DeckAnalytics` only in the Figma and PDF branches.

### `next/app/layout.js` (modified)
- **Responsible for:** loading GA4 exactly once via `<GoogleAnalytics>`. The raw `gtag.js` head script and inline config script are removed. GTM and Clarity remain.

### `scripts/slack-analytics-daily.js` (modified)
- **Responsible for (addition):** fetching and formatting deck activity, and excluding portal paths from the general page list.

## 7. Files Affected

- `next/utility/analytics-events.ts`: add six portal event names and the `PORTAL` category.
- `next/utility/analytics.ts`: add the GA4 client ID retrieval function.
- `next/utility/clarity.ts` (new): safe Clarity API wrapper.
- `next/utility/useDeckAnalytics.ts` (new): portal tracking hook sending to GA4 and Clarity.
- `next/components/DeckAnalytics.tsx` (new): deck view, Clarity tags and identify on unlocked mount.
- `next/app/(portal)/portal/[token]/PasswordGate.js`: gate view and unlock result tracking; accept `client` and `type`.
- `next/components/DeckPdfViewer.js`: page view, completion and menu open tracking; accept deck props.
- `next/app/(portal)/portal/[token]/page.js`: pass deck metadata down; render `DeckAnalytics` in Figma and PDF branches.
- `next/app/layout.js`: remove duplicate head GA4 scripts.
- `scripts/slack-analytics-daily.js`: new deck query and "Deck Activity" section; exclude `/portal/` from page list.
- GA4 Admin (manual, no file): register custom dimensions.
- GTM container `GTM-TNKNK842` (manual, no file): pause any GA4 tag for `G-YSM33VGFQP`.

## 8. Step-by-Step Implementation

### Step 1: Register GA4 custom dimensions (manual, do first)
- In GA4 Admin → Data display → Custom definitions → Create custom dimension, create event-scoped dimensions whose event parameter and dimension name are both: `deck_token`, `deck_title`, `deck_client`, `deck_type`, `unlock_result`, `page_number`, `nav_source`, `visitor_id`.
- Confirm `event_label` already exists as an event-scoped dimension (the Slack script already queries `customEvent:event_label`, so it should).
- **Why first:** dimensions are not retroactive and take 24–48 hours to become usable. Registering before deploy means the first real deck visits are queryable.
- **Gotchas:** parameter names are case-sensitive and must match exactly what the hook sends. Standard properties allow 50 event-scoped dimensions; this uses 8. GA4 treats number-like string values as numbers; tokens are random 16-character alphanumerics, so a fully numeric-looking token is possible but very unlikely.

### Step 2: `next/utility/analytics-events.ts`
- Add the six enum members with lowercase snake_case string values matching the event names in section 3. Add `PORTAL = "portal"` to `AnalyticsCategory`.
- **Why:** the hook in Step 5 references these, and it keeps all event names in the existing single source.
- **Gotcha:** GA4 event names must be 40 characters or fewer and start with a letter; all of these comply.

### Step 3: `next/utility/analytics.ts`
- Add an exported function that accepts a callback and calls `sendGAEvent` with the arguments `"get"`, the measurement ID `G-YSM33VGFQP` (hardcoded, matching `layout.js`), `"client_id"`, and the callback. Wrap in the same SSR guard and try/catch as `trackEvent`.
- **Why:** `DeckAnalytics` needs the client ID to link GA4 and Clarity, and this keeps all gtag interaction in the GA module.
- **Gotchas:** do not call `window.gtag` directly; `sendGAEvent` already pushes a real `arguments` object, which is what gtag.js requires for commands. The callback is not guaranteed to fire (ad blockers, gtag.js failing to load), so callers must not depend on it.

### Step 4: `next/utility/clarity.ts` (new)
- Add a `declare global` block typing `window.clarity` as an optional variadic function.
- Implement three exported functions: set a tag, send an event, and identify. Each returns early if `window` is undefined or `window.clarity` is not a function, and wraps the call in try/catch that logs to `console.error` (matching `trackEvent`'s pattern).
- Identify passes the custom ID as the first argument, `undefined` for custom session ID and custom page ID, and the friendly name as the fifth argument.
- **Why:** gives the hook and `DeckAnalytics` a safe API, matching the GA wrapper's shape.
- **Gotchas:** the Clarity snippet in `layout.js` defines the `window.clarity` queueing stub synchronously in `<head>`, so calls before Clarity finishes loading are queued, not lost. Clarity hashes the custom ID before sending; filtering by the raw ID in the dashboard still works because Clarity hashes the search input.

### Step 5: `next/utility/useDeckAnalytics.ts` (new)
- Mark as a client module like `useAnalytics.ts`.
- Accept the deck descriptor. Memoize the base parameter object (`deck_token`, `deck_title`, `deck_client`, `deck_type`) on the four primitive values.
- Create one `useCallback` per event. Each calls `trackEvent` with the matching `AnalyticsEvent` member, `AnalyticsCategory.PORTAL`, the deck title as `label`, the base parameters, and any event-specific parameters (`unlock_result`; `visitor_id` only when provided; `page_number`, `page_count`, `nav_source`; `page_count`), then calls the Clarity event function with the same event name string.
- Return the six functions.
- **Why:** components get simple, stable calls and never assemble parameters, so naming stays consistent between GA4 and the dimensions registered in Step 1.
- **Gotchas:** memoize on primitives, not the descriptor object, because callers may create a new object each render, which would break the stability that `DeckPdfViewer`'s effects rely on. Do not pass `undefined` values for `visitor_id`; omit the key instead so GA4 shows "(not set)" cleanly.

### Step 6: `next/components/DeckAnalytics.tsx` (new)
- Client component taking `token`, `title`, `client`, `type`. Calls `useDeckAnalytics` with them.
- In a mount effect: set the four Clarity tags (`deck_token`, `deck_title`, `deck_client`, `deck_type`). Then request the GA client ID via the Step 3 function and start a timeout of about 2 seconds.
  - On client ID callback: always call Clarity identify with the ID as custom ID and friendly name. If `deck_view` has not been sent yet, send it with the ID, mark as sent and clear the timeout.
  - On timeout: if not yet sent, send `deck_view` without the ID and mark as sent.
- Cleanup clears the timeout.
- Return `null`.
- **Why:** this is the "real viewer" signal and the GA4–Clarity link, placed where the server has already confirmed the session is unlocked.
- **Gotchas:** in development, React Strict Mode runs mount effects twice. The sent-flag ref persists across the simulated remount, so `deck_view` is not doubled, but the Clarity tag and identify calls may run twice; they are idempotent so this is harmless. Skip Clarity tags whose value is an empty string (for example a deck with no client) to avoid empty filter values.

### Step 7: `next/app/(portal)/portal/[token]/PasswordGate.js`
- Accept new `client` and `type` props. Call `useDeckAnalytics` with `token`, `deckTitle`, `client`, `type`.
- Add a mount effect that sends gate view once, guarded by a ref.
- In `handleSubmit`, call the unlock function at each existing branch: `success` immediately before `router.refresh()`; `incorrect` in the 401 branch; `expired` in the 410 branch; `error` in the fallthrough branch and in the catch block.
- **Why:** this is the only place that knows the unlock outcome on the client.
- **Gotchas:** send the success event before `router.refresh()`. The refresh re-renders the route server-side and unmounts the gate, and the event must be queued first. `sendGAEvent` pushes synchronously to `dataLayer`, so queuing before refresh is sufficient. A 400 (empty password) falls into the fallthrough branch and logs as `error`; the input has no `required` attribute, so this can happen. Never include the password in any parameter.

### Step 8: `next/components/DeckPdfViewer.js`
- Accept new props `token`, `title`, `client`, `type`. Call `useDeckAnalytics` with them.
- Add three refs: pending nav source (initial value `initial`), last tracked page (initial value null) and completion sent (initial value false).
- Create a stable navigate helper (via `useCallback`) taking a page and a source, which writes the source to the ref and then calls `setCurrentPage`. Create three stable wrappers for arrows, keyboard and menu sources.
- Pass the arrows wrapper to `DeckPdfNav`'s `onNavigate`, the keyboard wrapper to `useDeckKeyboardNav`'s `onNavigate`, and the menu wrapper to `DeckPdfMenu`'s `onNavigate`.
- Add an effect depending on `currentPage`, `numPages` and the page view and complete functions. It returns early until `numPages` is set, and also if `currentPage` equals the last tracked page. Otherwise it sends page view with `currentPage`, `numPages` and the current source ref, stores `currentPage` as last tracked, and if `currentPage` equals `numPages` and completion has not been sent, sends complete and sets the flag.
- Replace the inline `onToggleMenu` arrow function with a handler that reads the current `menuOpen` value. If the menu is currently closed (so this toggle opens it), it sends menu open, then toggles the state.
- **Why:** captures reading depth and how people navigate, without changing child components.
- **Gotchas:**
  - `useDeckKeyboardNav` re-binds its keydown listener whenever `onNavigate` changes identity, so the keyboard wrapper must be memoized.
  - Do not put the analytics side effect inside the `setMenuOpen` functional updater, because updaters may run twice in Strict Mode.
  - Selecting the current page in the menu does not change state and must not log a page view; the last-tracked guard and React's bail-out cover this.
  - A one-page PDF sends page view and complete together on load, which is correct.
  - The menu's close button, backdrop and thumbnail selection go through `onClose`, not `onToggleMenu`, so they never send menu open.

### Step 9: `next/app/(portal)/portal/[token]/page.js`
- Pass `client={meta.client}` and `type={meta.contentType}` to `PasswordGate`.
- In the Figma branch, render `DeckAnalytics` (with `token`, `title`, `client`, `type` from `params.token` and `meta`) as a sibling of `DeckEmbed` inside `DeckSessionWatcher`.
- In the PDF branch, do the same next to `DeckPdfViewer`, and also pass the four deck props to `DeckPdfViewer`.
- Do not add `DeckAnalytics` to the "not ready" branch.
- **Why:** this is the only place with server-resolved metadata; it wires Steps 6–8 into the route.
- **Gotchas:** `DeckSessionWatcher` returns `children` directly, so passing two children is fine. `DeckPdfViewer` is loaded with `ssr: false`, but `DeckAnalytics` is a normal client component and will hydrate immediately, so `deck_view` fires before the PDF finishes loading. That is intended.

### Step 10: `next/app/layout.js`
- Remove the `<script async src=".../gtag/js?id=G-YSM33VGFQP">` tag and the following inline `gtag('js'...)`/`gtag('config'...)` script from `<head>`. Keep the GTM snippet, the Clarity snippet, `<GoogleAnalytics gaId="G-YSM33VGFQP" />` and the GTM noscript iframe.
- **Why:** removes the duplicate `page_view` hit on every page sitewide.
- **Gotchas:** after this change, `window.gtag` is defined by `<GoogleAnalytics>`'s `afterInteractive` init script rather than in `<head>`. Nothing in the codebase calls `window.gtag` directly (confirmed by search), so no other code is affected. Expect GA4 page view counts to drop by roughly half from the deploy date onward. This is a correction, not lost traffic; note the date for anyone comparing trends.

### Step 11: GTM container (manual)
- In Google Tag Manager, open container `GTM-TNKNK842` and look for any Google tag or GA4 Configuration/Event tag using `G-YSM33VGFQP`. If one exists, pause it (do not delete) and publish the container. Leave GTM installed for any other tags.
- **Why:** a GA4 tag in GTM would still double-count after Step 10.
- **Gotcha:** if GTM holds GA4 event tags that other code relies on, pausing them stops those events. Review each tag's trigger before pausing.

### Step 12: `scripts/slack-analytics-daily.js`
- Add a new async function that fetches deck data, following the existing GA4 fetch functions (OAuth client, `BetaAnalyticsDataClient`, `retryWithBackoff`, own try/catch returning `null` and logging on failure). Query yesterday with dimensions `eventName`, `customEvent:deck_token`, `customEvent:deck_title`, `customEvent:deck_client`, `customEvent:unlock_result`, and metrics `eventCount` and `totalUsers`. Filter `eventName` to `deck_gate_view`, `deck_unlock`, `deck_view`, `deck_complete` using an in-list filter.
- Aggregate rows into an object keyed by deck token, holding title, client, gate views, successful unlocks, failed unlocks (any `deck_unlock` whose result is not `success`), views (`eventCount` of `deck_view`), viewers (`totalUsers` of `deck_view` rows) and completions. Return the per-deck object and a total view count.
- Add the function to the `Promise.all` in `main` with the same `.catch` pattern, and pass its result as a new final argument to `formatSlackBlocks`.
- In `formatSlackBlocks`, add the new parameter. When building `regularPages`, skip any path starting with `/portal/`. After the "Project & Gallery Views" section and before "Website Traffic by Source", if deck data exists and has at least one deck, add a "*Deck Activity:*" heading section. Then add one field per deck, sorted by views descending, showing title and client (client omitted if empty) followed by views, viewers, unlocks, failed unlocks, gate views and completions. Chunk fields into sections of 10, as existing sections do, then add a divider.
- Add the deck view total to the final "Report Summary" console log.
- **Why:** surfaces deck activity daily without opening GA4.
- **Gotchas:**
  - The Data API rejects queries that reference unregistered custom dimensions. Until Step 1 has propagated, the function returns `null` and the section is skipped. This is the desired behaviour, and why the deck fetch must not be merged into the existing event query.
  - `totalUsers` summed across rows can double-count. Only sum it across `deck_view` rows for one token, where `unlock_result` is always "(not set)", so there is one row per token per title/client combination.
  - If a deck's title or client changed during the day, a token may appear with two titles. Keep the first non-"(not set)" value.
  - Slack section fields have a 2000-character limit; titles are short, so this is not a concern.
  - Dates use GA4 property time, consistent with the rest of the report.

## 9. Edge Cases

- **Analytics blocked (ad blocker or privacy browser):** `sendGAEvent` pushes to `dataLayer` harmlessly. The client ID callback never fires, so `deck_view` is sent after the timeout (and is itself blocked). Clarity calls are skipped by the function guard. No errors surface to the user.
- **Client ID callback arrives after the timeout:** `deck_view` has already been sent without the ID. Identify still runs, so the Clarity link exists, but that particular `deck_view` lacks `visitor_id`. This is acceptable.
- **Session expires mid-view:** `DeckSessionWatcher` reloads the page, which shows the gate again and sends a new `deck_gate_view`. A later unlock sends a new `deck_view`. This correctly reflects what the user saw.
- **Expired link:** the server renders a static message with no client component, so no event is sent. GA4's automatic `page_view` on `/portal/<token>` still records the visit. Tracking expired visits is out of scope.
- **Deck missing client or content type in Kirby:** parameters are sent as empty strings, which GA4 shows as empty. Clarity tags with empty values are skipped (Step 6).
- **Rapid page clicks:** React may batch state updates. The effect fires for the final rendered page, and intermediate pages that never rendered are not logged. The source ref reflects the last control used. This is acceptable.
- **Same visitor opens deck in multiple tabs:** each tab sends its own `deck_view`; GA4 deduplicates users by client ID in the viewer count.
- **Deck token looks numeric to GA4:** unlikely with 16-character random alphanumerics. If it happens, the token would display in scientific notation in GA4. Mitigation, if ever needed, is prefixing tokens in the parameter; not done now.
- **GTM also contains GA4:** counts remain doubled until Step 11 is done.
- **Slack report before dimensions propagate:** deck section omitted, rest of report unaffected.
- **Duplicate events in development:** Strict Mode double-mounting is guarded by refs for all GA4 sends; local testing on `localhost` still sends real events to the production property (as it does today), so test sessions will appear in GA4 and Clarity.

## 10. Test Considerations

There is no automated test suite for analytics in this repo, so validation is manual.

- **GA4 DebugView:** enable debug mode using Google Tag Assistant (tagassistant.google.com) connected to the local or preview URL. Then:
  - Load a locked deck and confirm one `deck_gate_view`.
  - Enter a wrong password and confirm `deck_unlock` with `unlock_result: incorrect`.
  - Enter the correct password and confirm `deck_unlock` (`success`) followed by one `deck_view` carrying `visitor_id` and all four deck parameters.
- **PDF navigation:**
  - Confirm `deck_page_view` for page 1 with `nav_source: initial`.
  - Use the arrows, keyboard and a thumbnail, and confirm the matching `nav_source` values.
  - Open the menu and confirm `deck_menu_open`; closing it sends nothing.
  - Reach the last page and confirm a single `deck_complete`; going back and forward again does not resend it.
  - Re-select the current page in the menu and confirm no page view is sent.
- **Figma deck:** confirm `deck_view` only, and no page events.
- **Network tab:** filter requests to `google-analytics.com/g/collect`. Confirm each page load sends exactly one `page_view` after the layout change (previously two). Confirm `en=deck_view` requests include `ep.deck_token` and the other parameters.
- **Clarity:**
  - After a test session has processed (can take up to around 2 hours), filter Recordings by custom tag `deck_token` and by Smart/custom event `deck_view`.
  - Filter by Custom user ID using the `visitor_id` value seen in DebugView, and confirm the session appears with that ID as friendly name.
- **Strict Mode:** in `npm run dev`, confirm `deck_view` and `deck_gate_view` each appear once, not twice.
- **Slack script:** run `node scripts/slack-analytics-daily.js` locally with `.env` credentials pointed at a test webhook. Confirm that:
  - before dimension registration, the deck query logs a failure and the report still posts without the section
  - after registration and a day of data, the section lists decks correctly
  - `/portal/` paths no longer appear under Page Visits
- **Regression:** confirm existing `link_click`, `social_link_click` and `navigation` events still arrive after removing the head gtag script.

## 11. Implementation Order

1. **GA4 Admin custom definitions:** manual, no file. Registers the eight event parameters first so the 24–48 hour propagation runs in parallel with development.
2. **`next/utility/analytics-events.ts`:** existing file. Adds the event names and `PORTAL` category that every later step references.
3. **`next/utility/analytics.ts`:** existing file. Adds the GA client ID function needed by `DeckAnalytics`.
4. **`next/utility/clarity.ts`:** new file. Provides the Clarity wrapper used by the hook and `DeckAnalytics`.
5. **`next/utility/useDeckAnalytics.ts`:** new file. Combines Steps 2–4 into the per-event tracking functions the components call.
6. **`next/components/DeckAnalytics.tsx`:** new file. Uses the hook and Clarity wrapper to send `deck_view`, set tags and identify.
7. **`next/app/(portal)/portal/[token]/PasswordGate.js`:** existing file. Adds gate and unlock tracking using the hook; needs the new `client` and `type` props wired in Step 9.
8. **`next/components/DeckPdfViewer.js`:** existing file. Adds page, completion and menu tracking using the hook; needs deck props wired in Step 9.
9. **`next/app/(portal)/portal/[token]/page.js`:** existing file. Passes metadata to the components changed above and renders `DeckAnalytics`, connecting everything end to end.
10. **`next/app/layout.js`:** existing file. Removes the duplicate GA4 head scripts once portal tracking is verified to flow through `<GoogleAnalytics>`.
11. **GTM container `GTM-TNKNK842`:** manual, no file. Pauses any GA4 tag for the same ID after the code deploy, so there is never a window with zero GA4 loading.
12. **`scripts/slack-analytics-daily.js`:** existing file. Adds the Deck Activity section last, because it depends on the events existing in production and the dimensions from Step 1 being registered.
