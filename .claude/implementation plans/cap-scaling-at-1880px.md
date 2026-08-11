# Cap Fluid/vw-Based Scaling at 1880px Viewport Width

## 1. Goal

All responsive work on this site so far has been designed and tested against screens *smaller* than the developer's own monitor. The developer's screen (and screens like it, above roughly 1880px) is now revealed to be a second, unaddressed extreme: several layout values are defined as unbounded percentages or `vw` units with no upper limit, so they keep growing indefinitely on very large viewports instead of leveling off. This plan caps every such value so that nothing on the site scales larger once the viewport exceeds 1880px — the layout should look identical at 1880px and at 3000px.

## 2. Current System Behaviour

Two independent mechanisms currently produce unbounded growth as viewport width increases:

**A. `Container` (`next/components/Container.js`)** — the shared layout-width primitive used by `HomeLink`, the root `<main>` in `layout.js`, `Footer`, `MainNav`, and `MobileNav`. It renders `w-container mx-auto`, where `w-container` is a Tailwind token (`tailwind.config.js`, `theme.extend.width.container: '90%'`) resolving to `width: 90%`. There is no `max-width` anywhere in this chain. On a 1920px-wide screen, content renders at 1728px; on a 3840px screen, at 3456px; growth is linear and never stops. Since `Container` underpins nearly every horizontal layout on the site, this is the single highest-impact source of "too big on large screens."

**B. Three unbounded `vw` rules in `next/styles/nav.css`**, all controlling vertical spacing around the nav/logo area:
- Line 48 — `#secondary-home-link + main { padding-top: 29.4vw; }` (applies at all viewport widths; note `#secondary-home-link` has no matching element anywhere in current JSX — it appears to be dead CSS from a retired component, but is still shipped and would activate if the id were ever reused)
- Line 167 — `#home-link + main { padding-top: calc(2.3vw + 10px); }` inside `@media (min-width: theme('screens.lg'))` — this is the live rule that sets the gap between `HomeLink`'s logo and the page content below it on desktop
- Line 170 — `#secondary-home-link + main { padding-top: 25.4vw; }` inside the same `lg` media query (same dead-CSS caveat as line 48)

`HomeLink.js` itself does not use `vw` — its logo is already fixed at `h-[250px]` on `lg` — but it sits inside `Container` (inheriting problem A) and the page content beneath it is pushed down by the line-167 rule (problem B), so on a very wide screen the gap between logo and content keeps growing even though the logo doesn't.

Everything else audited — Tailwind font sizes (fixed `rem` via `tailwind.config.js`), the root `font-size: 10px` in `style-guide.css` (fixed, not `vw`-based), `MobileMenu.js`'s `w-[80vw]` (already capped by `max-w-xs`), and `project.css`'s `margin-bottom: 2vw` (adjacent to an already-capped `max-width: 632px` element) — does not grow unbounded and is out of scope.

## 3. Desired Behaviour

At any viewport width from 1880px upward, every currently-unbounded value renders at exactly the value it would have at 1880px:
- `Container` width freezes at `1880 * 0.9 = 1692px` (still centered via `mx-auto`).
- `#home-link + main` padding-top (the live desktop rule) freezes at its 1880px value: `2.3vw` at 1880px = `43.24px`, so `calc(2.3vw + 10px)` = `53.24px` → frozen `53.24px` (rounded to `53px` for a clean value, confirmed acceptable since this is sub-pixel-invisible spacing).
- `#secondary-home-link + main` padding-top (mobile rule, line 48) freezes at `29.4vw` of 1880px = `552.72px` → `553px`.
- `#secondary-home-link + main` padding-top (lg rule, line 170) freezes at `25.4vw` of 1880px = `477.52px` → `478px`.

Below 1880px, all existing fluid/percentage behavior is unchanged — this plan only adds a ceiling, it does not alter any value below the threshold.

## 4. Architecture Considerations

- **CSS-only ceiling via `clamp()`, no JS/breakpoint logic needed**: every affected property is a plain CSS `width` or `padding-top` value, so the ceiling can be expressed natively with `clamp(min, preferred, max)` (for `Container`'s `width`) or by simply appending a `max-width`/using `min()` (for `padding-top`, since `padding-top` has no `max-*` counterpart — `min()` is the correct primitive there: `padding-top: min(<current formula>, <frozen px value>)`). No JavaScript viewport listeners, no new Tailwind breakpoint, no React state.
- **Why 1880px specifically, not a Tailwind breakpoint**: Tailwind's config here only defines the default breakpoint scale (`lg` etc., unmodified from Tailwind defaults) with no custom `2xl`/`3xl` addition. Introducing 1880px as a full new Tailwind breakpoint would ripple into the breakpoint scale used elsewhere; using a literal `1880px` inside `min()`/`clamp()` in the two files that need it is more contained and matches the size of the actual problem (two files, four values).
- **`Container`'s cap belongs on the component/Tailwind-token layer, not per-consumer**: since `Container` is the single shared primitive (per the prior `sitewide-container-spacing` plan's explicit design goal of "define once, use everywhere"), the cap must be added at that same single point — either the Tailwind token or the component's own class string — never duplicated into `HomeLink`, `Footer`, `MainNav`, or `MobileNav` individually. Duplicating it would reintroduce the exact drift risk that prior plan was written to eliminate.
- **Tailwind arbitrary-value support for `clamp()`**: Tailwind v3 (confirmed by this project's `tailwind.config.js` shape) supports arbitrary CSS functions inside bracket syntax, e.g. `w-[clamp(0px,90%,1692px)]`, but a cleaner and more maintainable approach for a value used everywhere is to change the *token itself* in `tailwind.config.js` from a bare percentage string to a `clamp()` string, since Tailwind width tokens accept any valid CSS `width` value — this keeps `Container.js` and every consumer completely unchanged (zero-risk to five files that already work).
- **nav.css values stay as plain CSS**: `nav.css` is a normal stylesheet, not Tailwind utility classes, so its fix is a direct edit to the existing rules using `min()`, no Tailwind involvement.
- **Dead `#secondary-home-link` rules**: fixed anyway per the confirmed scope decision (consistency, low cost, no functional risk since the selector currently matches nothing), but flagged in code comments as apparently dead so a future cleanup pass can consider removing the selector entirely rather than continuing to maintain it.
- **Rounding to whole pixels**: the frozen values above are rounded to the nearest integer pixel; sub-pixel precision is not visually meaningful for padding/width at this scale and keeps the CSS readable.

## 5. Data Flow

Purely presentational CSS change — no props, state, data fetching, or component logic is touched. The values in question are computed by the browser's CSS engine from viewport width; the only "data" involved is the viewport width itself, which CSS already has native access to via `vw`/`%` units and the new `clamp()`/`min()` ceiling.

## 6. Component Responsibilities

No component's responsibilities change. `Container.js` continues to be responsible only for width + centering, `HomeLink.js` continues to render the logo/nav link. This plan only changes the *values* two existing CSS artifacts (`tailwind.config.js`'s width token, `nav.css`'s three rules) resolve to at large viewport widths — no new props, no new state, no new components.

## 7. Files Affected

| File | Change |
|---|---|
| `next/tailwind.config.js` | Change `theme.extend.width.container` from `'90%'` to a `clamp()` expression that freezes at the 1880px-viewport value (1692px). |
| `next/styles/nav.css` | Wrap the three unbounded `padding-top` values (lines 48, 167, 170) in `min()` so each freezes at its 1880px-viewport value. |

No other files require changes — `Container.js`, `HomeLink.js`, `Footer.js`, `MainNav.js`, `MobileNav.js` all consume the token/rules unchanged and inherit the new ceiling automatically.

## 8. Step-by-Step Implementation

**Step 1 — Update the `container` width token in `next/tailwind.config.js`.**
Change `theme.extend.width.container` from the literal string `'90%'` to `'clamp(0px, 90%, 1692px)'`. The `1692px` value is `1880 * 0.9`, i.e., exactly what `90%` would compute to at a 1880px viewport. Below 1880px viewport width, `90%` is smaller than `1692px`, so `clamp()`'s middle (preferred) value wins and behavior is pixel-identical to today. At and above 1880px, `90%` would exceed `1692px`, so the max branch (`1692px`) wins and width freezes. The `0px` minimum is a required `clamp()` argument but is never actually reached in practice (there's no scenario where `90%` goes negative); it exists only to satisfy `clamp()`'s three-argument signature. Watch out for: this token feeds a generated Tailwind utility class (`w-container`) at build time — after this edit, the dev server or build must pick up the config change (Tailwind's JIT watches `tailwind.config.js` automatically in dev, but confirm the class regenerates rather than assuming).

**Step 2 — Update `next/styles/nav.css` line 48 (`#secondary-home-link + main`).**
Change `padding-top: 29.4vw;` to `padding-top: min(29.4vw, 553px);`. `553px` is `29.4vw` evaluated at a 1880px viewport (`1880 * 0.294 = 552.72`, rounded to `553`). Below 1880px, `29.4vw` is the smaller operand and wins, preserving current behavior exactly; at/above 1880px, `553px` wins and freezes. This rule currently matches no element in the live JSX tree (no `#secondary-home-link` id exists in any current component), so this change has no visible effect today — it is included for consistency and to prevent a future regression if the id is ever reintroduced. Add a short comment above the rule noting the selector currently has no matching element, so a future reader doesn't assume it's dead code that's safe to delete without checking.

**Step 3 — Update `next/styles/nav.css` line 167 (`#home-link + main`, inside the `lg` media query).**
Change `padding-top: calc(2.3vw + 10px);` to `padding-top: min(calc(2.3vw + 10px), 53px);`. `53px` is the formula evaluated at 1880px: `2.3vw` at 1880px = `43.24px`, `+ 10px` = `53.24px`, rounded to `53px`. This is the one rule in this plan with a live, visible effect — it controls the gap between `HomeLink`'s logo and the page content immediately below it on desktop (`lg`) viewports, which is the specific symptom the user described. Watch out for: this rule only applies inside `@media (min-width: theme('screens.lg'))`, so it has no effect below the `lg` breakpoint — that's correct and unchanged, since this plan only addresses the *upper* end of the scale.

**Step 4 — Update `next/styles/nav.css` line 170 (`#secondary-home-link + main`, inside the `lg` media query).**
Change `padding-top: 25.4vw;` to `padding-top: min(25.4vw, 478px);`. `478px` is `25.4vw` at 1880px (`1880 * 0.254 = 477.52`, rounded to `478`). Same dead-CSS caveat as Step 2 — include the same explanatory comment. Do this immediately after Step 3 so both `lg`-media-query edits are made and visually re-checked together.

**Step 5 — Visual verification pass (see Section 10).**
Not a code change. Resize a browser (or use responsive dev tools) from 1880px up to at least 3000px and confirm: `Container`-wrapped content (nav, footer, page body) stops growing past 1880px; the gap under the `HomeLink` logo stops growing past 1880px; nothing shifts or jumps abruptly exactly at the 1880px threshold (the `clamp()`/`min()` transition should be visually seamless since both branches agree at exactly 1880px by construction).

## 9. Edge Cases

- **Boundary continuity at exactly 1880px**: because the frozen values are computed as the exact value the fluid formula produces at 1880px (not a rounder, different number), the transition from fluid to frozen is mathematically continuous — there should be no visible jump when crossing 1880px. The only source of a sub-pixel discontinuity is the rounding to whole pixels (e.g. `552.72px` → `553px`, a 0.28px difference) — this is far below the threshold of visible layout shift and does not need special handling.
- **Ultra-wide/multi-monitor viewports (e.g. browser windows spanning 3440px or 5120px)**: explicitly the scenario this plan exists to fix — confirmed frozen at the 1880px-equivalent values with no further growth, per Section 3.
- **Zoomed-out browsers**: browser zoom below 100% effectively increases the CSS px viewport width being measured (e.g. 67% zoom on a 1920px monitor behaves like a ~2866px viewport). This is expected and consistent with the plan's intent — "the viewport is wide" is the trigger, regardless of whether that's a physically large monitor or a zoomed-out window — no special-casing needed.
- **`#secondary-home-link` rules being dead code**: since no current component renders this id, Steps 2 and 4 are unverifiable in the live app today. This is expected and acceptable per the confirmed scope decision (fix all three rules for consistency) — the verification pass in Step 5 will only be able to confirm Step 3's effect visually; Steps 2 and 4 should instead be verified by direct inspection of the computed CSS rule (e.g. browser devtools' "Styles" panel showing the `min()` expression) rather than by observing an element that doesn't exist.

## 10. Test Considerations

**Manual (required, no automated visual-regression suite exists in this project):**
- Load `/` (or any route with `HomeLink` visible) at three widths: 1879px (just below threshold, should still be fluid), 1880px (exact threshold), and 3000px+ (well above threshold, should be frozen and visually identical in proportion to 1880px).
- At each width, measure (via devtools) the rendered width of a `Container`-wrapped element and confirm it stops increasing past 1880px.
- At each width, measure the `padding-top` of the element immediately following `#home-link` on desktop and confirm it stops increasing past 1880px.
- Re-run the mobile/small-screen spot checks from the prior `sitewide-container-spacing` plan (375px, 1444px) to confirm nothing below 1880px changed — this plan must be a pure no-op below the threshold.
- Toggle dark mode at a large viewport width as a quick sanity check that nothing else in the nav/logo area is affected (unrelated to this change, but cheap to confirm alongside the width checks).

**Automated**: no existing test suite covers layout/CSS in this repo; introducing one is out of scope for this plan.

## 11. Implementation Order

1. `next/tailwind.config.js` — existing file, modified. Do this first: it is the single highest-impact change (fixes the `Container` primitive used by five components at once) and is independent of the `nav.css` changes, so it can be verified in isolation before moving on.
2. `next/styles/nav.css` — existing file, modified (all three rules in one pass: lines 48, 167, 170). Do this second, after `Container` is confirmed working, since these rules govern spacing *around* content whose own width is set by `Container` — verifying `Container` first makes it easier to isolate which visual change came from which file during the Step 5 verification pass.
