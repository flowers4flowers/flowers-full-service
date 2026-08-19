# Project Page Back Button Returns to Origin (Gallery or Home)

## 1. Goal

On `/projects/[slug]`, the "Back" link is hardcoded to `/`. When a user arrives at a project page from the Gallery (`/gallery`), pressing Back should return them to the Gallery — and to the same scroll position they left it at. When they arrive from the Home page's project list, Back should return to Home at the same scroll position. Direct visits (shared link, refresh, new tab) should still fall back to `/`.

## 2. Current System Behaviour

`ProjectContent.js` renders a static `<Link href="/">&larr; Back</Link>`. It has no awareness of how the user reached the page. Two components link into `/projects/[slug]`:

- `GalleryImage.js` (used by `GalleryContent.js` on `/gallery`) — links via `<Link href="/projects/{slug}{#itemSlug}">`, with `onClick` calling `handleGalleryClick`, which dispatches `SET_HIDE_NAV` to the shared `AppStateContext` (`context/index.js`).
- `ProjectLink.js` (used by `ProjectsList.js` on `/` / Home) — links via `<Link href="/projects/{slug}">`, with `onClick` calling `handleProjectClick`, which only fires an analytics event (no dispatch).

`context/index.js` holds a single global reducer (`AppStateContext`) with `hideNav`, `currentProjectCaptions`, and `mobileMenuOpen`. It is wrapped around the app (`AppWrapper`) so state persists across route navigations, since Next.js does a client-side transition rather than a full reload for `Link` navigations.

Scroll position is not tracked anywhere. Both Home (`app/page.js`) and Gallery (`app/gallery/page.js`) scroll the window itself (no internal scroll container), unlike the project page's text column which scrolls internally via `textColumnRef`.

## 3. Desired Behaviour

- Clicking a project from the Gallery, then clicking Back on the project page, returns to `/gallery` scrolled to the same position the user was at when they clicked (not the item's position, just where the page was scrolled to).
- Clicking a project from the Home project list, then clicking Back, returns to `/` scrolled to the same position.
- Visiting `/projects/[slug]` directly (no recorded origin), Back goes to `/`, matching current behaviour.
- The existing hash-scroll behaviour (`/projects/slug#itemSlug`, used to jump within the project media column) is untouched.
- Behaviour must survive Next.js client-side navigation (no full page reload) since that's how `Link` navigates in this app.

## 4. Architecture Considerations

**Where to store the origin:** the existing `AppStateContext` (`context/index.js`) is the natural place — it already persists across route changes and is already written to by `GalleryImage.js`. Using it avoids adding a second state mechanism (e.g. sessionStorage or query params) alongside the existing one.

**Why not `router.back()`:** as already agreed, `router.back()` depends on the real browser history stack, which is unreliable here — hovering/prefetching, the `#itemSlug` hash on gallery links, or a user who navigated by other means (browser back/forward across several pages first) could all point it somewhere unexpected. An explicit, app-controlled value is deterministic regardless of history state.

**Why capture scroll on click, not on unmount:** the scroll position must be recorded at the moment the user leaves the origin page, i.e. inside the `onClick` handlers already present on `GalleryImage.js` and `ProjectLink.js`. Capturing on unmount is unnecessary complexity and less precise (unmount can be delayed or batched by React/Next transitions); reading `window.scrollY` synchronously in the click handler is simple and exact.

**Data shape:** store a single `backNavigation` object with `origin` (`"gallery"` | `"home"` | `null`) and `scrollY` (number). A single object (rather than two separate fields, or a per-page object) keeps the "where do I go back to" concept atomic and easy to reset.

**Restoring scroll:** both `/gallery` and `/` are Server Components (`app/gallery/page.js`, `app/page.js`) that render client components (`GalleryContent.js`, home page body has no dedicated client wrapper today for this purpose). Scroll restoration must happen in a client component effect after the page's content is present in the DOM, so the target scroll height exists. `GalleryContent.js` is already a client component and is a natural place to add this for Gallery. For Home, `ProjectsList.js` is already a client component and renders on every load of `/`, so it is the natural equivalent — the effect belongs there, not in `app/page.js` (which is a Server Component and cannot use hooks/effects).

**One-time consumption:** once the stored scroll position is used to restore the page, it should be cleared from state (or at least not be reapplied if the user manually scrolls and later returns via a normal navigation, e.g. clicking the logo). Reset `backNavigation` to `{ origin: null, scrollY: 0 }` immediately after applying it in the restoring effect.

**Trade-off accepted:** if the user opens a project in a new tab (middle-click) or the Gallery/Home component unmounts and its scroll-restoring effect never runs (e.g. user closes tab), stale state could in theory linger in memory — but since this is in-memory React state (not persisted to storage), it is wiped on full reload/new tab anyway, so this is a non-issue in practice.

## 5. Data Flow

1. User is on `/gallery` or `/` and scrolls to some position.
2. User clicks a project link (`GalleryImage.js` or `ProjectLink.js`).
3. The click handler reads `window.scrollY` and dispatches an action to `AppStateContext` recording `{ origin: "gallery" | "home", scrollY }`.
4. Next.js performs a client-side transition to `/projects/[slug]`. `ProjectContent.js` reads `backNavigation.origin` from `AppStateContext` (via `useAppState`) to compute the Back link's `href`: `/gallery` if `origin === "gallery"`, `/` otherwise (covers `"home"` and `null`).
5. User clicks Back, navigating to `/gallery` or `/`.
6. On mount, the destination page's client component (`GalleryContent.js` or `ProjectsList.js`) reads `backNavigation` from state. If `origin` matches its own page and `scrollY` is present, it calls `window.scrollTo(0, scrollY)` in an effect, then dispatches an action to reset `backNavigation` to its initial empty value.
7. If the user instead arrived at either page through normal navigation (not a Back click), `origin` will be `null` (either never set, or already cleared by step 6), so no scroll adjustment happens and the page behaves as it does today.

## 6. Component Responsibilities

### `context/index.js`
- Responsible for: holding `backNavigation` in `initialState`; handling a new reducer action to set it and a new (or reused) action to reset it.
- Not responsible for: reading `window.scrollY`, deciding when to apply scroll restoration — that's the caller's job.
- No new props (it's a context provider, unchanged signature).
- Internal state addition: `backNavigation: { origin: null, scrollY: 0 }`.

### `GalleryImage.js`
- Responsible for: in `handleGalleryClick`, additionally dispatching the `SET_BACK_NAVIGATION` action with `origin: "gallery"` and the current `window.scrollY`.
- Not responsible for: reading state back or restoring scroll — that happens on the Gallery page itself, and on the project page.
- No prop changes.

### `ProjectLink.js`
- Responsible for: in `handleProjectClick`, additionally dispatching `SET_BACK_NAVIGATION` with `origin: "home"` and current `window.scrollY`. Requires importing `useAppState` (not currently imported here).
- Not responsible for: anything beyond recording origin/scroll at click time.
- No prop changes.

### `ProjectContent.js`
- Responsible for: reading `backNavigation.origin` from `useAppState()` and using it to compute the Back link's `href` (`/gallery` vs `/`).
- Not responsible for: clearing `backNavigation` (that happens on the destination page after it's used) or restoring any scroll itself.
- No prop changes; `data` prop usage is unchanged.

### `GalleryContent.js`
- Responsible for: on mount, checking `backNavigation.origin === "gallery"`; if so, scrolling the window to `backNavigation.scrollY` and dispatching the reset action.
- Not responsible for: setting `backNavigation` (that's the click handlers' job) or restoring Home's scroll.
- No prop changes.
- New internal behaviour only (via `useEffect` + `useAppState`), no new state owned locally.

### `ProjectsList.js`
- Responsible for: on mount, checking `backNavigation.origin === "home"`; if so, scrolling the window to `backNavigation.scrollY` and dispatching the reset action.
- Not responsible for: setting `backNavigation`, or Gallery's restoration.
- No prop changes.
- New internal behaviour only (via `useEffect` + `useAppState`), no new state owned locally.

## 7. Files Affected

- `next/context/index.js` — add `backNavigation` to `initialState` and a reducer case to set/reset it.
- `next/components/GalleryImage.js` — capture scroll position and origin on project click.
- `next/components/ProjectLink.js` — capture scroll position and origin on project click; add `useAppState` import.
- `next/components/ProjectContent.js` — compute Back link `href` from `backNavigation.origin` instead of hardcoding `/`.
- `next/components/GalleryContent.js` — restore scroll position on mount if returning from a project.
- `next/components/ProjectsList.js` — restore scroll position on mount if returning from a project.

## 8. Step-by-Step Implementation

**Step 1 — `next/context/index.js`: add state shape and reducer action.**
Add `backNavigation: { origin: null, scrollY: 0 }` to `initialState`. Add a `case "SET_BACK_NAVIGATION"` that replaces `state.backNavigation` with `action.payload` (the reducer stays generic — both "set on click" and "reset after restoring" dispatch this same action type, with the reset dispatching `{ origin: null, scrollY: 0 }` as the payload). This keeps the reducer small: no separate reset action type needed.
Gotcha: keep this action name distinct from `SET_HIDE_NAV`, which `GalleryImage.js` already dispatches separately on the same click — both actions will be dispatched from the same handler in Step 2, as two separate `dispatch` calls (the reducer only handles one action per call).

**Step 2 — `next/components/GalleryImage.js`: record origin on click.**
Inside `handleGalleryClick`, before or after the existing `dispatch({ type: "SET_HIDE_NAV", ... })` call, add `dispatch({ type: "SET_BACK_NAVIGATION", payload: { origin: "gallery", scrollY: window.scrollY } })`. `window` is safe to reference here since this is an event handler that only runs in the browser (component is already `"use client"` and the handler only fires after a user interaction).
Connects to: Step 1 (needs the action type to exist) and Step 4 (needs `ProjectContent.js` to read this).

**Step 3 — `next/components/ProjectLink.js`: record origin on click.**
Add `import { useAppState } from "../context";` and destructure `dispatch` from it (`const { dispatch } = useAppState();`) near the other hooks at the top of the component. Inside `handleProjectClick`, after the existing `trackLink` call, add `dispatch({ type: "SET_BACK_NAVIGATION", payload: { origin: "home", scrollY: window.scrollY } });`.
Gotcha: this component currently has no context dependency at all — verify `AppWrapper` actually wraps the tree that renders Home (it wraps the whole app per `context/index.js` usage elsewhere), so `useAppState()` won't throw.
Connects to: Step 1 (action type) and Step 6 (`ProjectsList.js` reads this on return).

**Step 4 — `next/components/ProjectContent.js`: compute Back link target.**
Add `import { useAppState } from "../context";` and `const { state } = useAppState();` near the top of the component. Replace the hardcoded `<Link href="/">` with a computed value, e.g. `const backHref = state.backNavigation?.origin === "gallery" ? "/gallery" : "/";`, and use `backHref` as the `Link`'s `href`. Leave the link's label/markup and the `&larr; Back` text unchanged.
Gotcha: don't clear `backNavigation` here — the value must still be available for the Gallery/Home mount effect to consume after the user actually clicks Back. Clearing on the project page would erase it before it's used, since the project page unmounts before the destination page's effect runs (state is set based on the value present in the context at Back-click time, but the actual restoration read happens after navigation completes on the destination page).
Connects to: Step 2/3 (produces the value read here) and Steps 5/6 (consume `backNavigation` again on the far side).

**Step 5 — `next/components/GalleryContent.js`: restore scroll on return.**
Import `useEffect` from `react` and `useAppState` from `../context`. Add `const { state, dispatch } = useAppState();`. Add a `useEffect` with an empty dependency array that: checks `if (state.backNavigation?.origin === "gallery")`; if true, calls `window.scrollTo(0, state.backNavigation.scrollY)` and then `dispatch({ type: "SET_BACK_NAVIGATION", payload: { origin: null, scrollY: 0 } })` to reset, so a later normal (non-Back) navigation to Gallery won't reapply a stale scroll position.
Gotcha: this component conditionally returns `null` when `mediaItems.length === 0` before reaching the main render — the effect must still run regardless of that branch (hooks must be called unconditionally, before any early return), so add the `useEffect` above the `if (mediaItems.length > 0)` check, not inside it.
Gotcha: scrolling must happen after the gallery grid has laid out (images loaded/sized) or `scrollY` may exceed the not-yet-full document height and clamp short. Images use `DefImage`/`GalleryImage` with explicit `width`/`height` props, so layout should already reserve the correct space before paint even before images finish loading — no additional wait should be needed, but verify visually in Step 10 (manual test) that restoration lands at the correct spot, not short.
Connects to: Step 2 (produces the stored value) and Step 4 (only reachable if `ProjectContent.js` pointed Back at `/gallery`).

**Step 6 — `next/components/ProjectsList.js`: restore scroll on return.**
Import `useEffect` from `react` (alongside the existing `useState` import) and `useAppState` from `./context` — check relative path from `components/` (same level, so `"../context"` as used elsewhere, not `"./context"`). Add `const { state, dispatch } = useAppState();`. Add a `useEffect` with an empty dependency array performing the same check/scroll/reset as Step 5, but gated on `state.backNavigation?.origin === "home"`.
Gotcha: `ProjectsList` is rendered conditionally in `app/page.js` only when `orderedProjectsByClient.length > 0`, but that's a server-side condition on the parent — once `ProjectsList` itself mounts, the effect runs unconditionally same as Step 5, no early-return concern inside this component itself.
Connects to: Step 3 (produces the stored value) and Step 4 (only reachable when origin was not `"gallery"`, i.e. Back points at `/`).

**Step 7 — Cross-check hash behaviour is untouched.**
Confirm no changes were made to how `item.slug` hash fragments are appended to gallery links in `GalleryImage.js`, and that `ProjectContent.js`'s existing `window.scrollTo(0, 0)` effect (used for project text-column reset) still runs as before — this plan does not touch that effect, only the Back link's `href`. No code change in this step; it's a verification checkpoint before moving to testing.

## 9. Edge Cases

- **Direct visit to `/projects/[slug]`** (new tab, shared link, refresh): `backNavigation.origin` is `null` from `initialState`, so `ProjectContent.js` falls back to `/`. Matches current behaviour.
- **User navigates Gallery → Project → Back → Gallery → Home** (clicks logo/nav instead of a project link): after Back restores Gallery's scroll, `backNavigation` is reset to `null`. Navigating onward to Home via a non-`ProjectLink` link does not set `backNavigation`, so Home's restoring effect finds `origin !== "home"` and does nothing — Home loads at its natural top scroll. Correct.
- **User clicks a project, then clicks Back, then clicks the same project again, then Back again**: each click on `GalleryImage.js`/`ProjectLink.js` re-dispatches `SET_BACK_NAVIGATION` with a fresh `scrollY`, overwriting the previous value, so repeated cycles stay correct.
- **User opens a project link in a new tab** (middle-click / cmd-click): the click handler still fires (React `onClick` fires on middle-click in most browsers) and dispatches state — but the *current* tab's context is unaffected in the new tab (separate JS runtime), and the original tab's Gallery/Home page never navigated away, so its own scroll position is simply preserved as-is by the browser (no restoration needed since it never left). No adverse effect.
- **Two components could restore scroll on the same mount if both origins were somehow true**: not possible, since `origin` is a single string value (`"gallery"` XOR `"home"` XOR `null`) in one shared object — only one of the two effects' conditions can be true at a time.
- **Race between Back-link navigation and the destination page's effect firing before layout is ready**: mitigated by keeping `width`/`height` on gallery images (already in place) so layout doesn't shift after the effect runs; if visual testing in Step 10 reveals clamping, revisit with a slight deferral (e.g. `requestAnimationFrame`) rather than assuming it up front.

## 10. Test Considerations

Manual testing (no automated test suite currently covers navigation/scroll in this codebase, based on files reviewed):

1. From `/gallery`, scroll partway down, click a project image, then click Back — verify URL is `/gallery` and scroll position visually matches where you were.
2. From `/` (Home), scroll partway down the client/project list, click a project, then click Back — verify URL is `/` and scroll position matches.
3. Visit `/projects/some-slug` directly (paste URL fresh, or hard refresh on the project page) — verify Back goes to `/` (top).
4. From `/gallery`, click a project link that includes a hash (`#itemSlug`) — verify the project page still behaves as before (whatever the existing hash behaviour is) and Back still returns to `/gallery` with restored scroll.
5. Click through Gallery → Project → Back → Gallery → click nav logo to Home — verify Home does not incorrectly jump/restore any scroll (should load fresh at top).
6. Repeat a Gallery → Project → Back cycle twice in a row to confirm scroll restores correctly each time, not just the first.
7. Check mobile viewport (this site has explicit `lg:` breakpoints and a `MobileMenu.js`) — confirm Back link is visible/tappable and behaves the same on small screens.

No automated tests appear to exist for `context/index.js`, `GalleryContent.js`, `ProjectsList.js`, or `ProjectContent.js` in the reviewed files; adding automated coverage is out of scope unless the project introduces a test runner, which was not observed.

## 11. Implementation Order

1. `next/context/index.js` — existing file, modified. Must go first: adds the `backNavigation` state shape and `SET_BACK_NAVIGATION` action that every other file depends on.
2. `next/components/GalleryImage.js` — existing file, modified. Adds the Gallery-side write to `backNavigation`; depends on step 1's action type.
3. `next/components/ProjectLink.js` — existing file, modified. Adds the Home-side write to `backNavigation`; depends on step 1's action type, independent of step 2.
4. `next/components/ProjectContent.js` — existing file, modified. Reads `backNavigation.origin` to compute the Back link target; depends on steps 2 and 3 having a value to read (though it can be written/tested against step 1 alone with a manually seeded value).
5. `next/components/GalleryContent.js` — existing file, modified. Consumes and resets `backNavigation` for the Gallery-origin case; depends on step 2 producing the value and step 4 routing Back to `/gallery`.
6. `next/components/ProjectsList.js` — existing file, modified. Consumes and resets `backNavigation` for the Home-origin case; depends on step 3 producing the value and step 4 routing Back to `/`.
