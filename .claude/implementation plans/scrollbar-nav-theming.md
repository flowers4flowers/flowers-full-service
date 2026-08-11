# Scrollbar: Clear the Fixed Nav, Match Theme

## 1. Goal

The site's vertical scrollbar (referred to as the "vertical slider" — this is the browser's native page scrollbar, not a custom component) currently visually overlaps the fixed navigation bars (`MainNav`, `MobileNav`), and its color does not respond to the site's dark/light theme. This plan makes the scrollbar sit clear of the nav and adopt the active theme's colors automatically.

## 2. Current System Behaviour

`MainNav` (`next/components/MainNav.js`) and `MobileNav` (`next/components/MobileNav.js`) are both `position: fixed; top: 0; left: 0` with `width: 100%` (Tailwind `w-full`), rendered inside `#main-nav` / `#mobile-nav` respectively (`z-index: 3000`, set in `next/styles/nav.css:53-56` and `137-140`). Fixed-position elements sized with `width: 100%` are laid out against the viewport's initial containing block, which does not consistently subtract the width the browser reserves for its scrollbar. The result is that the nav bar's background/content extends the full viewport width, running underneath or behind the scrollbar track/thumb at the right edge, so the two visually collide.

The scrollbar itself is entirely unstyled — it uses the OS/browser default appearance (usually a neutral gray), which does not change when the site's theme toggles between light and dark. Theme is controlled via `ThemeProvider`/`useTheme()` (`next/context/ThemeContext.js`), which toggles a `dark` class on `<html>` and persists the choice to `localStorage`. Two CSS custom properties already track the active theme and are already used throughout the stylesheet: `--color-bg` and `--color-text`, defined on `:root` for light and redefined under `html.dark` for dark (`next/styles/style-guide.css:9-18`). Nothing currently ties the scrollbar's appearance to these variables.

## 3. Desired Behaviour

The page scrollbar's reserved width is accounted for in layout at all times (not just when a scrollbar happens to be visible), so `MainNav` and `MobileNav` never extend under or past it. The scrollbar's track and thumb are styled to use the same `--color-bg` / `--color-text` tokens as the rest of the UI, so switching theme (via `ThemeToggle`, in `MainNav.js` and `MobileMenu.js`) instantly updates the scrollbar's colors along with everything else — no additional theme-reading logic is needed since the styling rides on CSS custom properties that already flip with the `dark` class.

## 4. Architecture Considerations

**Layout fix — CSS-only via `scrollbar-gutter`, not JS-measured width.** Two approaches were considered: (a) a JS hook measuring actual scrollbar width and exposing it as a CSS variable, or (b) `scrollbar-gutter: stable` combined with anchoring nav headers via `left`/`right` instead of an explicit width. Option (b) was chosen: it requires no new hook, no resize listener, and no client-side effect, and `scrollbar-gutter` has full support in all evergreen browsers this site targets (Chrome, Firefox, Safari, Edge — no IE11 requirement here). The trade-off is that `scrollbar-gutter: stable` always reserves the gutter space, even on pages/viewports where content doesn't overflow vertically — this is an accepted, minor cost for correctness and simplicity, and also has the side benefit of eliminating any residual layout shift when content height crosses the scroll threshold.

**Theming — pure CSS, reusing existing tokens.** Because `--color-bg`/`--color-text` already exist and already update on the `dark` class toggle, the scrollbar styling needs no JS at all. This keeps the change entirely declarative and consistent with how every other themed surface in the codebase works (Tailwind `dark:` variants and these two custom properties).

**New file vs. extending `nav.css`.** Scrollbar styling is a different concern from nav layout/animation (it isn't scoped to `#main-nav`/`#mobile-nav`, it's global to `html`/`body`). A new `next/styles/scrollbar.css`, imported from `global.css` alongside the other stylesheets, keeps this isolated and easy to find or remove later, rather than growing `nav.css` (which is specifically about nav component behavior) or `style-guide.css` (which holds base resets/tokens) with an unrelated ruleset.

**Cross-browser scrollbar styling has two incompatible APIs.** Firefox uses the standard `scrollbar-color`/`scrollbar-width` properties on the scrolling element. Chrome, Safari, and Edge (Chromium) use the non-standard `::-webkit-scrollbar`, `::-webkit-scrollbar-track`, `::-webkit-scrollbar-thumb` pseudo-elements. Both must be written; there is no single property that covers all engines today.

## 5. Data Flow

There is no application data involved. The only "flow" is: the user toggles theme via `ThemeToggle` → `ThemeContext.toggleTheme()` fires → the `dark` class is added/removed on `document.documentElement` → this flips the values of `--color-bg`/`--color-text` on `:root` (already implemented) → the new scrollbar CSS rules, which reference those same variables, are recalculated by the browser's style engine → the scrollbar repaints in the new colors. No React re-render, no JS scrollbar logic, and no props are involved in the theming path. The layout fix (`scrollbar-gutter` + nav anchoring) is static CSS with no runtime data flow at all.

## 6. Component Responsibilities

No new components are introduced. Two existing components have a class-list change only.

**`MainNav` (`next/components/MainNav.js`)**
- Responsible for: rendering the desktop nav bar's fixed-position container and its class composition via `classNames(...)`.
- Not responsible for: scrollbar appearance or gutter reservation (handled globally in CSS).
- Change in scope: the base class string swaps `w-full` for `left-0 right-0` (see Step 8).
- Props/state: unchanged.

**`MobileNav` (`next/components/MobileNav.js`)**
- Responsible for: rendering the mobile nav bar's fixed-position container and its class composition via `classNames(...)`.
- Not responsible for: scrollbar appearance or gutter reservation.
- Change in scope: same `w-full` → `left-0 right-0` swap.
- Props/state: unchanged.

No changes to `MobileMenu`, `HomeLink`, `ThemeToggle`, or `ThemeContext` — the mobile slide-in menu panel is positioned with explicit `right-4`/inset offsets already (`fixed top-16 right-4 bottom-16`), not `w-full`, so it is not affected by this issue.

## 7. Files Affected

- `next/styles/style-guide.css` — add `scrollbar-gutter: stable` to the existing `html, body` rule block (around line 20-23) so the browser always reserves scrollbar space regardless of content length.
- `next/styles/scrollbar.css` — new file; contains the Firefox and WebKit scrollbar color rules driven by `--color-bg`/`--color-text`.
- `next/styles/global.css` — add an `@import './scrollbar.css';` line alongside the existing imports.
- `next/components/MainNav.js` — change the `classNames(...)` base string from `w-full` to `left-0 right-0` (line 31).
- `next/components/MobileNav.js` — same change (line 34).

## 8. Step-by-Step Implementation

**Step 1 — Reserve scrollbar gutter globally.**
In `next/styles/style-guide.css`, locate the existing rule:
```
html,
body {
  overflow-x: hidden;
}
```
Add `scrollbar-gutter: stable;` to this rule (it can coexist with `overflow-x: hidden`, which governs the horizontal axis only). This makes the browser always reserve the vertical scrollbar's track width as part of the viewport's layout box, whether or not a scrollbar is currently rendered (e.g., on short pages). This is the foundation the nav-anchoring change in Step 3 depends on — without it, `right: 0` alone would not prevent the nav from sitting under the scrollbar, because the gutter wouldn't be reserved in layout.

**Step 2 — Create the themed scrollbar stylesheet.**
Create `next/styles/scrollbar.css`. It needs two rule sets:
- A `html { scrollbar-color: var(--color-text) var(--color-bg); scrollbar-width: thin; }` rule for Firefox, where the two `scrollbar-color` values are thumb-color then track-color, in that order — reversing them is a common mistake to watch for.
- A `::-webkit-scrollbar`, `::-webkit-scrollbar-track`, and `::-webkit-scrollbar-thumb` rule set (scoped to `html` or left global) for Chromium/Safari, setting `background: var(--color-bg)` on the track and `background: var(--color-text)` on the thumb, with a `border-radius` and a reasonable fixed `width` (e.g. matching the `thin` sizing used for Firefox, roughly 8-10px) so the two engines look visually consistent with each other.

Because `--color-bg`/`--color-text` are already redefined under `html.dark` in `style-guide.css`, no `dark:`-specific rules are needed here — the same `var(...)` references resolve to different colors automatically depending on whether the `dark` class is present. This is the key reason no JS or Tailwind `dark:` variant is required for this file.

**Step 3 — Import the new stylesheet.**
In `next/styles/global.css`, add `@import './scrollbar.css';` to the existing list of `@import` statements. Order relative to the other imports does not matter functionally here since the new rules target `html`/`::-webkit-scrollbar*` selectors that don't collide with anything in `nav.css`, `gallery.css`, `about.css`, `project.css`, or `footer.css` — but for consistency, place it directly after `style-guide.css` (which is where `--color-bg`/`--color-text` are defined) and before the component-specific stylesheets.

**Step 4 — Stop `MainNav` from extending under the gutter.**
In `next/components/MainNav.js`, in the `classNames(...)` call (line 30-35), change the base class string:
```
"fixed top-0 left-0 w-full bg-cream dark:bg-black py-10 hidden lg:flex"
```
to:
```
"fixed top-0 left-0 right-0 bg-cream dark:bg-black py-10 hidden lg:flex"
```
Removing `w-full` and adding `right-0` means the element's right edge is now anchored to the viewport's right edge as reduced by the reserved scrollbar gutter from Step 1, rather than stretching to the full, un-reduced viewport width. `left-0` is kept (already present) so both edges are pinned explicitly.

**Step 5 — Same fix for `MobileNav`.**
In `next/components/MobileNav.js`, in the `classNames(...)` call (line 33-38), apply the identical change: `w-full` → drop it, keep `left-0`, add `right-0`.

**Step 6 — Visual check across breakpoints and themes.**
After the above, verify in a browser with a visible scrollbar (not an OS auto-hiding overlay scrollbar, which won't show the issue at all — see Edge Cases) that the nav bar's right edge now stops flush against the scrollbar track rather than continuing underneath it, in both light and dark mode, at both the `lg` (MainNav) and sub-`lg` (MobileNav) breakpoints.

Order rationale: Step 1 must precede Step 4/5, since the gutter reservation is what makes `right: 0` resolve to a position that actually excludes the scrollbar — doing the nav class change first would have no visible effect until the gutter exists. Steps 2-3 (scrollbar coloring) are independent of Steps 1/4/5 and could be done in either order, but are sequenced first here because they touch fewer files and establish the token usage pattern before the layout fix is verified.

## 9. Edge Cases

- **OS overlay scrollbars (macOS default "when scrolling" setting, and some touch/trackpad-driven OSes):** these scrollbars overlay content rather than reserving track width, so there is nothing to visually collide with the nav in the first place, and the WebKit-specific styling in Step 2 will have no visible effect since no persistent track is drawn. This is expected and not a regression — the fix targets the classic reserved-gutter scrollbar (Windows default, and macOS set to "always show scrollbars").
- **`scrollbar-gutter: stable` on a page with no vertical overflow:** the gutter is still reserved (that's the point of `stable`), so a small empty strip will exist at the right edge even when nothing is scrollable. This is intentional per Architecture Considerations and matches how `stable` is meant to be used; flag to the user only if it becomes visually distracting in practice.
- **Firefox thumb/track color order in `scrollbar-color`:** the property takes `thumb-color track-color`, not the reverse. Getting this backwards will silently invert the intended contrast rather than error, so double-check against a live Firefox render after Step 2.
- **`html.dark` not yet applied on first paint:** `next/app/layout.js` already runs a blocking inline script (lines 67-75) to apply the `dark` class before hydration to prevent FOUC for existing themed elements; since the scrollbar CSS reads the same `--color-text`/`--color-bg` variables, it inherits this same protection for free and needs no separate handling.
- **Horizontal scrollbar:** `overflow-x: hidden` is already set on `html, body` (`style-guide.css:20-23`), so no horizontal scrollbar exists to theme or reposition; this plan only addresses the vertical one.

## 10. Test Considerations

Manual checks (no automated test suite exists in this repo for visual/CSS concerns, and none is warranted here since this is pure styling with no logic branches):
- Load the homepage and a scrollable inner page (e.g. a project page, given `ProjectContent`'s longer content) in a Chromium browser and in Firefox, at both a `lg`-and-above viewport width and a mobile-width viewport, in both light and dark mode (toggle via `ThemeToggle` in `MainNav`/`MobileMenu`) — confirm the nav bar's right edge no longer overlaps the scrollbar track/thumb, and that scrollbar colors match the active theme's `--color-bg`/`--color-text`.
- Resize the browser window across the `lg` breakpoint to confirm both `MainNav` and `MobileNav` remain correctly clear of the gutter as the nav that's rendered (`hidden lg:flex` vs `flex lg:hidden`) changes.
- Check a short page (little to no vertical overflow) to confirm the reserved gutter from `scrollbar-gutter: stable` doesn't introduce a visually jarring empty strip or misalign the `Container`-wrapped nav content against page content below it.
- Spot-check Safari if available, since it also uses the WebKit scrollbar pseudo-elements but has historically had partial/inconsistent support for some of them.

## 11. Implementation Order

1. `next/styles/style-guide.css` — existing file; add `scrollbar-gutter: stable` to the `html, body` rule so gutter space is reserved before anything anchors against it.
2. `next/styles/scrollbar.css` — new file; add themed Firefox and WebKit scrollbar rules referencing `--color-bg`/`--color-text`.
3. `next/styles/global.css` — existing file; import `scrollbar.css` so the new rules are actually loaded.
4. `next/components/MainNav.js` — existing file; swap `w-full` for `right-0` in the nav header's class list so it stops at the reserved gutter.
5. `next/components/MobileNav.js` — existing file; identical class swap for the mobile nav header.
