# Mobile Nav Bar — Match Desktop Nav

## 1. Goal

The mobile navigation currently lives at the bottom of the screen as a single "Menu" button, and the site's wordmark logo is shown centered at the top on all screen sizes via `HomeLink`. This does not match the desktop nav (`MainNav`), which is a persistent top bar with the logo on the left and links/actions on the right. The mobile experience should adopt the same top-bar position and the same link set as desktop (Gallery, Shop, filtered social links, conditional scroll-to-top arrow), while keeping the existing tap-to-open full-screen menu pattern and keeping "Home" as an explicit link in that menu.

## 2. Current System Behaviour

- `MainNav` (desktop, `lg` and up only): a `fixed top-0` bar with the FLOWERS logo (left) and inline links (right) — Gallery, Shop (`MainNavLinks`), all social links except Instagram, and a scroll-to-top arrow shown only on `/projects` and `/gallery` routes, fading in after 300px of scroll. It hides via a `hide` class driven by `state.hideNav`.
- `HomeLink`: renders on every screen size, `fixed top-0`, centered wordmark image. On mobile it is the only persistent top element. It owns the scroll-based logic that toggles `state.hideHomeLink` (for its own hide class) and `state.hideNav` (consumed by `MainNav`) based on scroll position and direction.
- `MobileNav` (mobile only, `lg:hidden`): a `fixed bottom-0` bar containing only a "Menu" button that dispatches `SET_MOBILE_MENU_OPEN: true`.
- `MobileMenu`: a full-screen overlay (`fixed`, slides in via `.active` class tied to `state.mobileMenuOpen`) listing Home, Gallery, and Shop links with circle-bullet active-state indicators, followed by **all** social links (no Instagram filter), and a "Close Menu" button. Closes automatically on route change.
- `nav.css` defines the positioning, z-index, hide/active transforms, and a `#home-link + main { padding-top: 25.4vw }` rule that reserves vertical space under the wordmark on mobile, overridden at `lg` to `calc(20.3vw + 104px)`.
- Render order in `app/layout.js`: `MainNav`, `MobileNav`, `HomeLink`, then `<main>`, then `Footer`, then `MobileMenu`.

## 3. Desired Behaviour

- On mobile, a persistent top bar (repurposed `MobileNav`) replaces the wordmark-only `HomeLink` display: logo on the left, Menu button and (conditionally, on `/projects` and `/gallery`) a scroll-to-top arrow on the right — structurally mirroring `MainNav`.
- This top bar hides/shows using the same `state.hideNav` flag `MainNav` already uses, so scroll behavior is consistent across breakpoints.
- The scroll-to-top arrow on mobile fades in after the same 300px scroll threshold as desktop's arrow, using the same route check.
- `HomeLink` no longer renders visually on mobile (desktop-only), but stays mounted so its scroll-listener effects (which set `state.hideNav`) keep running for all breakpoints.
- Tapping Menu still opens the existing full-screen `MobileMenu` overlay, unchanged in structure (Home, Gallery, Shop, circle bullets), except its social links are filtered to exclude Instagram, matching desktop.
- Mobile page content's top padding is resized to fit the new, shorter top bar instead of the old wordmark-sized reservation.

## 4. Architecture Considerations

- **Reuse `MobileNav.js` in place rather than creating a new component.** It already is the designated "mobile equivalent of `MainNav`" in the component naming scheme, and it already owns the `state.mobileMenuOpen` dispatch. Repositioning and extending it keeps naming parity (`MainNav` / `MobileNav`) and avoids introducing a redundant third top-level nav component.
- **Do not delete or unmount `HomeLink` on mobile.** `HomeLink` owns the scroll-direction/threshold logic that sets `state.hideNav`, which `MainNav` (and now `MobileNav`) both depend on. Unmounting it on mobile would silently break that shared state on small screens. Hiding it purely via a responsive class (`hidden lg:flex`) keeps its effects running while removing it from view and layout.
- **Reuse `state.hideNav` instead of adding a parallel hide flag for `MobileNav`.** `MainNav` already consumes this flag for identical hide-on-scroll-down behavior; giving `MobileNav` its own duplicate flag would be redundant state for the same visual effect.
- **Do not touch `MainNavLinks`.** Its Gallery/Shop links are desktop-specific markup (`<span>`-wrapped, active-dot styling via `::after`) tied to `#main-nav` CSS. `MobileMenu` already has its own equivalent Gallery/Shop entries with different markup (circle bullets); the two link lists are intentionally separate presentations of the same destinations, not shared components — the fix here is only to add the Instagram filter to `MobileMenu`'s existing social loop, not to unify the two menus' implementations.
- **Padding recalculation is approximate and must be visually verified.** The current `25.4vw` mobile padding was sized to reserve space for the large centered wordmark. The new top bar is a compact single row (similar in height to `MainNav`'s desktop bar, scaled down). Replace it with a fixed value sized to the new bar's rendered height; this constant should be adjusted by eye during implementation since it depends on final padding/logo-size choices.

## 5. Data Flow

- `socialLinks` (fetched once in `layout.js` via `getGlobalData`) is passed into both `MainNav` and `MobileMenu` today; no change to how it is sourced. `MobileMenu`'s render loop over `socialLinks` gains a `.filter()` step (identical to `MainNav`'s) before mapping, so the Instagram entry never reaches the DOM on mobile either.
- `usePathname()` is read independently inside `MainNav` today to decide whether to show the up-arrow; `MobileNav` will read it the same way (its own `usePathname()` call) to decide whether to render its own up-arrow, and to run its own `useScroll`/`useMotionValueEvent` pair to fade it in past 300px scroll — this mirrors `MainNav`'s local `showUp` state rather than sharing it, since the two bars are independent DOM trees that both need the same derived boolean.
- `state.hideNav` continues to originate solely from `HomeLink`'s scroll effect and is read (not written) by both `MainNav` and `MobileNav` to toggle their own `hide` class.
- `state.mobileMenuOpen` flow is unchanged: `MobileNav`'s Menu button dispatches `true`, `MobileMenu` reads it for its `.active` class and reacts to route changes to dispatch `false`.

## 6. Component Responsibilities

### `MobileNav` (edited)
- Responsible for: rendering the mobile-only (`lg:hidden`) fixed top bar; showing the logo (linking to `/`); rendering the Menu button (dispatches `SET_MOBILE_MENU_OPEN: true`); conditionally rendering a scroll-to-top button on `/projects`/`/gallery` routes; applying the `hide` class from `state.hideNav`.
- NOT responsible for: opening/closing logic beyond dispatching the open action; the contents of the menu overlay (that's `MobileMenu`); desktop rendering (guarded out via `lg:hidden`).
- Props: none (unchanged — it reads global state and pathname directly, consistent with `MainNav`'s existing pattern of not receiving `socialLinks`-derived UI props for its own chrome).
- Internal state: a local `showUp` boolean (scroll-position-derived, mirrors `MainNav`'s), not shared via context.

### `HomeLink` (edited)
- Responsible for: desktop-only rendering of the animated wordmark; continuing to run its scroll-based effects that set `state.hideHomeLink` and `state.hideNav` on every breakpoint (needed by both `MainNav` and `MobileNav`).
- NOT responsible for: any mobile-visible UI going forward.
- Props: none (unchanged).
- Internal state: unchanged (`maxTitleSize`, `titleSize`, `prevScroll`, `showCaptions`).

### `MobileMenu` (edited)
- Responsible for: the full-screen overlay UI; Home/Gallery/Shop links with active-state circle indicators; the (now Instagram-filtered) social links list; the Close Menu button; closing itself on pathname change.
- NOT responsible for: opening itself (triggered externally by `MobileNav`'s dispatch) or matching desktop's link markup pixel-for-pixel — only the underlying set of destinations must match.
- Props: `socialLinks` (array, required, unchanged) — passed through from `layout.js`.
- Internal state: none of its own (uses shared `state.mobileMenuOpen` via context).

## 7. Files Affected

- `next/components/MobileNav.js` — repositioned from bottom to top bar, gains logo, conditional up-arrow, and `hideNav`-driven hide behavior.
- `next/components/HomeLink.js` — gains a responsive class so it no longer renders visually below `lg`.
- `next/components/MobileMenu.js` — social links list gains the Instagram-exclusion filter used by `MainNav`.
- `next/styles/nav.css` — `#mobile-nav` rules updated for top positioning, hide transform, and up-arrow sizing; mobile `padding-top` rule for `<main>` updated to match the new bar's height instead of the old wordmark reservation.

No changes are needed to `app/layout.js` (render order of `MainNav`, `MobileNav`, `HomeLink`, `<main>` stays the same — see Architecture Considerations for why `HomeLink`'s DOM position relative to `<main>` must not change), `MainNav.js`, `MainNavLinks.js`, or `context/index.js`.

## 8. Step-by-Step Implementation

1. **`HomeLink.js` — restrict to desktop.** Add `hidden lg:flex` (or equivalent) to the `classNames(...)` call that builds the outer `<nav id="home-link">` classes, alongside the existing `hide`/`show-captions` conditionals. Leave every hook, effect, and piece of internal logic untouched — the component must stay mounted and keep dispatching `SET_HIDE_NAV`/`SET_HIDE_HOME_LINK` regardless of viewport, since `MobileNav` (and `MainNav`) depend on `state.hideNav`. Watch out for: Tailwind's `flex` vs the element's current implicit display — check what display type the inner layout needs before choosing which utility to hide (`hidden lg:flex` vs `hidden lg:block`) so desktop layout doesn't shift.

2. **`nav.css` — repurpose `#mobile-nav` for a top bar.** Add `transition: transform .3s;` to `#mobile-nav` (matching `#main-nav`) and add a new `#mobile-nav.hide { transform: translateY(-100%); }` rule (bottom-bar positioning never needed a hide transform since it wasn't wired to `hideNav` before). Add a `#mobile-nav .up svg { width: 1.4rem; }` rule mirroring `#main-nav .up svg` for the new arrow icon's size. This step must land before or alongside step 3 so the class names the JSX will reference already resolve.

3. **`nav.css` — fix the mobile padding-top.** The existing `#home-link + main { padding-top: 25.4vw; }` rule reserved space for the large wordmark that mobile no longer shows. Replace this base (non-`lg`) value with a fixed size proportioned to the new top bar (a starting point close to the bar's own vertical padding, to be confirmed visually — see Edge Cases). Leave the `lg` media-query override (`calc(20.3vw + 104px)`) untouched, since desktop's `HomeLink` rendering is unchanged. Gotcha: this rule is keyed off `#home-link` being the DOM sibling immediately before `<main>` — that adjacency is unaffected by `HomeLink` being visually hidden via CSS, so no selector changes are needed here beyond the value itself.

4. **`MobileNav.js` — rebuild the JSX.** Change the outer `<header id="mobile-nav">`'s classes from `fixed bottom-0 ... py-6 px-5` to a `fixed top-0` layout using `justify-between items-center` (mirroring `MainNav`'s `flex justify-between items-center`) with padding sized to match the new reserved space from step 3 (e.g. `px-5 py-5`, consistent with `HomeLink`'s prior mobile padding). Wrap the class list in `classNames(...)` (import `classnames`, matching `MainNav`'s pattern) so the `hide` class can be conditionally applied from `state.hideNav`. Add a `Link href="/"` wrapping a small `next/image` logo on the left (reuse `/FLOWERS.png`, sized down from `MainNav`'s 50×40, e.g. 40×32 — exact size to be confirmed visually). Keep the existing Menu `<button>` but move it into a right-hand group. Gotcha: `MobileNav` currently only destructures `dispatch` from `useAppState()` — it must now also destructure `state` to read `hideNav`.

5. **`MobileNav.js` — add the scroll-to-top arrow.** Import `usePathname` from `next/navigation`, `useScroll`/`useMotionValueEvent` from `framer-motion`, and `UpArrow` from `./Icons` (all already used by `MainNav` for the identical feature — copy the pattern, not the component). Add local `showUp` state toggled by a `useMotionValueEvent(scrollY, "change", ...)` callback using the same 300px threshold `MainNav` uses. Conditionally render an up-arrow `<button>` (scrolls to top smoothly) next to the Menu button when `pathname.includes("/projects") || pathname.includes("/gallery")`, with opacity classes toggling on `showUp`. This must come after step 4 since it extends the same right-hand button group.

6. **`MobileMenu.js` — filter social links.** In the second `<ul>`'s `socialLinks.map(...)` call, add a `.filter((link) => !link.link.toLowerCase().includes("instagram"))` before `.map`, identical to the filter already used in `MainNav.js`. This is an isolated, low-risk change independent of the other steps and can be done at any point, but is listed last since it touches a different file/concern (social link parity vs. layout repositioning).

## 9. Edge Cases

- **New top bar height doesn't match the padding constant.** Because the padding-top value chosen in step 3 is an estimate, a mismatch will show as either a visible gap or content tucked under the fixed bar. Verify by scrolling to the top of each page type (home, gallery, project) on a real mobile viewport and adjusting the constant.
- **`state.hideNav` hides the bar while the menu is open.** If a user scrolls down before opening the menu, `hideNav` may already be `true`; if `MobileNav` remains hidden while `MobileMenu` is open (e.g. user scrolls the overlay's own content), the Menu button used to close it could become inaccessible. Check the interaction and, if needed, force the bar visible whenever `state.mobileMenuOpen` is true regardless of `hideNav`.
- **Logo tap while menu is open.** Confirm that tapping the logo link while `MobileMenu` is open navigates home and that the menu-close-on-route-change effect in `MobileMenu` fires correctly (it already listens to `pathname`, so this should work unchanged, but verify since the logo is a new interactive element in this bar).
- **Up-arrow double-existing.** Both `HomeLink` (hidden but mounted) and the new `MobileNav` arrow reference `pathname` and `scrollY` independently — confirm no duplicate/orphaned scroll listeners cause jank, since two separate `useMotionValueEvent` subscriptions to the same `scrollY` motion value now exist on mobile (one in `HomeLink`, one in `MobileNav`) plus the existing one in `MainNav` (inert on mobile since hidden via `lg:flex` but still mounted/subscribed).
- **z-index stacking.** `#mobile-menu` is `z-index: 3500`, above `#mobile-nav`'s `3000` — confirm the overlay still visually sits above the repositioned top bar (it should, since only the position changed, not the stacking values), and that the top bar doesn't visually clash with `MainNav`'s `z-index: 3000` given both could theoretically be in the DOM at once at breakpoint boundaries (mitigated by `lg:hidden`/`hidden lg:flex` guards, but worth a resize-across-breakpoint check).

## 10. Test Considerations

- Manually verify on a real mobile viewport (or responsive dev tools) at minimum: home, gallery, and a project page.
- Confirm the top bar hides on scroll-down and reappears on scroll-up, matching `MainNav`'s desktop behavior at the same scroll thresholds.
- Confirm the up-arrow only appears on `/projects` and `/gallery`, fades in after 300px of scroll, and scrolls smoothly to top on tap.
- Confirm Menu button still opens `MobileMenu`, and that Instagram no longer appears in its social list while other social links still do.
- Confirm no visible layout gap or content overlap at the top of the page across the tested routes.
- Confirm desktop (`lg` and up) rendering is fully unaffected — `MainNav` and `HomeLink` should look and behave exactly as before.
- No automated test suite currently covers nav components in this codebase; this change should be validated manually rather than via new unit tests unless the project's testing conventions say otherwise.

## 11. Implementation Order

1. `next/components/HomeLink.js` — existing file, modified: add the responsive hide class first, since every other step assumes `HomeLink` is no longer visually competing for the mobile top area.
2. `next/styles/nav.css` — existing file, modified: add the new `#mobile-nav` transform/hide/arrow rules and fix the mobile `padding-top` value before the JSX changes that depend on those classes land.
3. `next/components/MobileNav.js` — existing file, modified: rebuild the bar's layout and hide behavior (step 4 of the walkthrough), since this is the core structural change.
4. `next/components/MobileNav.js` — same file, modified further: add the scroll-to-top arrow, layered on top of the repositioned bar from the previous step.
5. `next/components/MobileMenu.js` — existing file, modified: add the Instagram filter; independent of the above and safe to do last.
