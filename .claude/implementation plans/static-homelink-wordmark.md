# Static HomeLink Wordmark

## 1. Goal

`HomeLink` currently shrinks its wordmark image and slides it off-screen based on scroll position, which the user finds distracting. The goal is to make the wordmark image fully static — same size, same position, always visible — while preserving the existing scroll-triggered hide behavior on `MainNav` and `MobileNav`, which currently depends on scroll tracking that lives inside `HomeLink`.

## 2. Current System Behaviour

`HomeLink.js` renders a centered, fixed-position wordmark (`/FLOWERS-Full.svg`) visible only at `lg` breakpoint and above (`hidden lg:block`). On mount and on window resize, it measures its container's width and sets that as the initial `titleSize`. A `framer-motion` `useMotionValueEvent` scroll listener does two independent things on every scroll tick:

1. **Sizing**: if not on a `/gallery` page, once scroll passes 400px (`scrollTriggerVal`) the wordmark snaps to a fixed `targetSize` (170px at `lg`, 130px below `lg` — though the component never renders below `lg`, so that branch is dead). Below 400px, size is interpolated between the initial container width and `targetSize` based on scroll progress, producing the shrink-while-scrolling effect. `showCaptions` also toggles based on the 400px threshold but is not read anywhere in this file.
2. **Direction tracking**: regardless of page, it compares `latestScrollY` to `prevScroll` to detect scroll direction. Scrolling down past 600px (`scrollTriggerVal + 200`) dispatches `SET_HIDE_HOME_LINK: true` and `SET_HIDE_NAV: true`; otherwise both dispatch `false`. `state.hideHomeLink` drives HomeLink's own `hide` CSS class; `state.hideNav` is read by both `MainNav.js` and `MobileNav.js` to apply their own `hide` class and slide away.

`MainNav.js` and `MobileNav.js` each also run their own independent `useMotionValueEvent` listener, but only to toggle a local `showUp` state (opacity of their own up-arrow scroll-to-top buttons on `/projects`/`/gallery`). They do not track direction or dispatch `hideNav` themselves — they only consume it.

`context/index.js` holds `hideHomeLink` and `hideNav` as separate reducer fields, each set by its own action (`SET_HIDE_HOME_LINK`, `SET_HIDE_NAV`), both currently written only from `HomeLink.js`.

## 3. Desired Behaviour

The wordmark image in `HomeLink` renders at a single fixed width (170px, matching the current `lg`+ `targetSize`) at all scroll positions — no shrinking, no interpolation, no hide/slide. It remains desktop-only (`hidden lg:block`) and centered, same as today. Width scales down responsively only through CSS if the viewport is a narrow desktop width (e.g. `max-width` behavior), not through JS recalculation.

`MainNav` and `MobileNav` continue to hide/slide away on fast scroll-down exactly as before — this behavior is preserved, just driven by a new shared hook instead of by `HomeLink`.

The `/projects` up-arrow button inside `HomeLink` is unchanged.

## 4. Architecture Considerations

- **Extracting scroll-direction tracking into a hook** avoids duplicating the direction-detection logic (comparing current vs. previous scroll position, threshold, dispatch) in both `MainNav` and `MobileNav`. A single hook, called from each nav component, keeps the behavior in one place and decouples it from `HomeLink`, which should no longer own navigation-chrome concerns once it's just a static logo.
- **Why not keep the dispatch in HomeLink**: `HomeLink` becoming fully static means it has no more scroll listener at all. If the hide-on-scroll-down behavior for the nav bars is to survive, the logic must move somewhere still mounted on every page — a hook invoked by `MainNav`/`MobileNav` themselves is the natural owner, since those are the only consumers of `hideNav`.
- **`hideHomeLink` removal**: once `HomeLink` is static, nothing reads or writes `hideHomeLink`. Leaving dead reducer state around invites confusion later, so it is removed along with its action.
- **Fixed width via CSS, not JS measurement**: Using `next/image` with static `width`/`height` props (170 and `Math.round(170 / WORDMARK_ASPECT_RATIO)`) removes the need for `container.current.offsetWidth` measurement, the `container` ref, and the resize listener entirely. A `max-width: 100%` / responsive utility class on the wrapping `Link` handles narrow-desktop scaling without any JS.
- **Trade-off**: the hook introduces a second `useMotionValueEvent` scroll subscription (in addition to each nav component's own `showUp` listener), rather than one shared listener for both direction and up-arrow visibility. This is acceptable because the two concerns (nav hide-on-scroll vs. per-component up-arrow opacity) are logically distinct and already implemented as separate listeners in `MainNav`/`MobileNav` today — merging them is out of scope for this change.

## 5. Data Flow

Scroll position originates from `framer-motion`'s `useScroll()` inside the new hook, called once each by `MainNav` and `MobileNav`. Each call maintains its own `prevScroll` ref/state internally to detect direction, compares against the same 600px threshold used today, and dispatches `SET_HIDE_NAV` to the shared `AppStateContext` reducer (`context/index.js`). Both `MainNav` and `MobileNav` read `state.hideNav` back out via `useAppState()` to compute their own `hide` class, exactly as before. `HomeLink` no longer participates in this data flow at all — it renders unconditionally from static constants and no longer reads or writes any scroll-related context state.

## 6. Component Responsibilities

### `HomeLink.js`
- **Responsible for**: rendering the fixed-position, centered, static wordmark link to `/`, desktop-only visibility, and the `/projects` scroll-to-top up-arrow button.
- **NOT responsible for**: measuring container width, resizing on scroll or window resize, tracking scroll direction, dispatching any hide-related context actions.
- **Props**: none (unchanged).
- **Internal state**: none related to sizing/scroll. Retains only what the up-arrow button needs (nothing new).

### `useScrollDirection` (new hook, e.g. `next/utility/useScrollDirection.js`)
- **Responsible for**: subscribing to `useScroll()`, tracking previous scroll position, determining scroll direction, dispatching `SET_HIDE_NAV` when the down-scroll threshold is crossed and clearing it otherwise.
- **NOT responsible for**: rendering anything, managing per-component up-arrow visibility (`showUp`), or any sizing logic.
- **Props/args**: none required; reads `dispatch` from `useAppState()` internally.
- **Internal state**: previous scroll value (ref or state), mirroring the current `prevScroll` logic from `HomeLink`.
- **Returns**: nothing (side-effect only), matching the pattern of a subscription hook. Both `MainNav` and `MobileNav` call it purely for its dispatch side effects.

### `MainNav.js`
- **Responsible for**: (unchanged) rendering the desktop nav bar, its own small logo, links, social links, and up-arrow; applying `hide` class from `state.hideNav`. Additionally now calls `useScrollDirection()` once to keep that state alive.
- **NOT responsible for**: computing scroll direction itself inline (delegated to the hook).

### `MobileNav.js`
- **Responsible for**: (unchanged) rendering the mobile nav bar; applying `hide` class from `state.hideNav`. Additionally now calls `useScrollDirection()` once.
- **NOT responsible for**: computing scroll direction itself inline (delegated to the hook).

### `context/index.js`
- **Responsible for**: holding `hideNav`, `currentProjectCaptions`, `mobileMenuOpen` state and their actions.
- **NOT responsible for**: `hideHomeLink` (removed).

## 7. Files Affected

- `next/components/HomeLink.js` — strip sizing/resize/scroll-direction logic, render static-size image.
- `next/utility/useScrollDirection.js` — new file; extracted scroll-direction hook.
- `next/components/MainNav.js` — call new hook to keep `hideNav` behavior alive.
- `next/components/MobileNav.js` — call new hook to keep `hideNav` behavior alive.
- `next/context/index.js` — remove `hideHomeLink` field and `SET_HIDE_HOME_LINK` action.

## 8. Step-by-Step Implementation

**Step 1 — Create `next/utility/useScrollDirection.js`.**
Check the existing `next/utility/` directory naming conventions (e.g. `useAnalytics.js`) before naming the file, to match casing/style already in use. The hook should: import `useMotionValueEvent`, `useScroll` from `framer-motion`, `useState` (or `useRef`) from React, and `useAppState` from `../context`. Internally replicate the direction-and-threshold logic currently in `HomeLink.js` lines 100–124 (compare `latestScrollY` to previous value, threshold at 600px, dispatch `SET_HIDE_NAV` true/false). Do not port the sizing-related branch (that logic is being deleted, not moved). This step must come first since both nav components will depend on it.

**Step 2 — Update `next/components/MainNav.js`.**
Import and call `useScrollDirection()` once near the top of the component body, alongside the existing `useAppState()` call. No other changes needed here — `state.hideNav` consumption and the `hide` class logic stay exactly as they are.

**Step 3 — Update `next/components/MobileNav.js`.**
Same as Step 2: import and call `useScrollDirection()`. `state.hideNav` consumption stays unchanged.

**Step 4 — Rewrite `next/components/HomeLink.js`.**
Remove: `useScroll`, `useMotionValueEvent` imports (no longer needed since no scroll listener remains here); the `container` ref and `handleResize` callback and both `useEffect`s that call it; `maxTitleSize`, `titleSize`, `prevScroll`, `showCaptions` state; the `isLargeQuery`/`targetSize` window-matchMedia branch at the top (replaced by a single constant, see below); the entire scroll-direction dispatch block. Keep: the `pathname` check for the `/projects` up-arrow button, the `Link`/`Image` structure, `WORDMARK_ASPECT_RATIO`.

Replace the dynamic `targetSize` logic with a single constant, e.g. `const WORDMARK_WIDTH = 170;`. Render the `Image` unconditionally (no more `{titleSize && (...)}` guard, since there's no async measurement to wait for) with `width={WORDMARK_WIDTH}` and `height={Math.round(WORDMARK_WIDTH / WORDMARK_ASPECT_RATIO)}`. Give the wrapping `Link` a responsive width via Tailwind classes instead of an inline `style` (e.g. `w-[170px] max-w-full`), so it never recalculates in JS but can still shrink via CSS if the container is ever narrower than 170px. Remove the now-unused `classNames` `hide`/`show-captions` conditional on the outer `<nav>` — simplify the `classes` constant to a plain string, since `state.hideHomeLink` no longer exists.

**Step 5 — Remove `hideHomeLink` from `next/context/index.js`.**
Delete the `hideHomeLink: false` field from `initialState` and the `SET_HIDE_HOME_LINK` case from the reducer. Do this last, after confirming (via search) that no other file in the codebase reads `state.hideHomeLink` or dispatches `SET_HIDE_HOME_LINK` — the earlier grep already confirmed these only appear in `HomeLink.js`, but re-check after Step 4's edits to be safe before deleting the reducer case.

## 9. Edge Cases

- **Narrow desktop viewports**: since `HomeLink` only renders at `lg` and above, the minimum viewport width where it appears is generally wide enough for 170px, but the `max-w-full` class on the `Link` ensures no horizontal overflow if a `lg`-and-up viewport is ever narrower than expected (e.g. browser zoom).
- **Gallery pages**: the old code had a `pathname.includes("/gallery")` guard that skipped the *sizing* animation only (direction tracking still ran on gallery pages). Since sizing is removed entirely, this guard has no remaining purpose in `HomeLink` and should not be ported into the new hook — the hook should apply on all pages, matching the original direction-tracking behavior which was never gallery-gated.
- **Double-mounted hook**: with `useScrollDirection()` called independently in both `MainNav` and `MobileNav`, both will dispatch `SET_HIDE_NAV` on every scroll tick. Since both components are conditionally rendered by breakpoint (`hidden lg:flex` vs `flex lg:hidden`) but both stay mounted in the DOM simultaneously (just visually hidden via CSS), both hook instances will run and dispatch redundantly but harmlessly (same value, no conflict) — confirm this by checking whether `MainNav`/`MobileNav` are both always mounted or conditionally rendered by JS before assuming this is a non-issue.
- **`mobileMenuOpen` interaction**: unrelated to this change, but verify scrolling behavior while the mobile menu overlay is open doesn't unexpectedly trigger `hideNav` in a way that hides the close/menu button — this risk already exists today and is not introduced by this change.

## 10. Test Considerations

**Manual checks:**
- Load the homepage at `lg`+ width, scroll down slowly and quickly: confirm the wordmark image stays the exact same size and position throughout (no shrink, no movement).
- Confirm `MainNav` still hides when scrolling down fast past the threshold, and reappears when scrolling up — on at least two different pages (e.g. home and a `/projects` page).
- Confirm `MobileNav` still hides/shows identically on a mobile viewport width.
- Confirm the `/projects` up-arrow button in `HomeLink` still appears and functions (scrolls to top) as before.
- Confirm no console errors related to removed context state (`hideHomeLink`) or removed hook imports.
- Resize the browser window across the `lg` breakpoint to confirm `HomeLink` still only appears at `lg`+ and the image doesn't jump or flash.

**Automated tests**: none exist currently for these components based on the files reviewed; no new automated tests are required unless the project's conventions call for one, but flag this to the user before skipping if a test suite is later found.

## 11. Implementation Order

1. `next/utility/useScrollDirection.js` — new file; must exist before either nav component references it.
2. `next/components/MainNav.js` — modified to call the new hook.
3. `next/components/MobileNav.js` — modified to call the new hook.
4. `next/components/HomeLink.js` — modified to strip sizing/scroll logic and render the static image; done after the hook exists so `hideNav` behavior is never broken mid-change.
5. `next/context/index.js` — modified last to remove `hideHomeLink`, once nothing references it.
