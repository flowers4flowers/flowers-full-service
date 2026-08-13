# Project Page: Large Title, Repositioned Back Link, Scrollable Fade Column

## 1. Goal

On individual project pages (`/projects/[slug]`), replace the global FLOWERS wordmark logo with a large, bold rendering of the current project's title. Move the "Back" link to sit directly under the title/location block. Make the left-hand text column (client, date, title, location, Back, description) scroll independently of the page, capped to the height of the right-hand media column, with no visible scrollbar and a fade at the top/bottom edges to signal there is more to scroll.

## 2. Current System Behaviour

`layout.js` renders `HomeLink` above `<main>{children}</main>` on every route. `HomeLink` always renders the `FLOWERS-Full.svg` wordmark image at large size (desktop only, `hidden lg:block`), regardless of which page is active. It also conditionally renders an "up arrow" scroll-to-top button when the current pathname includes `/projects`.

Below that, `ProjectContent.js` renders a two-column grid (`grid-cols-12`). The left column (`col-span-8`) is `lg:sticky lg:top-32 lg:self-start` and contains, in order: a "Back" link, client name, date range, title (`h1`) + location, an optional short description, a "Read More/Read Less" toggle, and the optional full description. It has no internal scroll behavior — it grows to whatever height its content needs and stays pinned via `sticky` while the page scrolls. The right column (`col-span-4`) renders the list of media items (images/videos) and is what drives the overall page height/scroll.

There is no fade-mask or internal-scroll pattern anywhere in the codebase today.

## 3. Desired Behaviour

On project pages only:
- The FLOWERS wordmark in `HomeLink` does not render.
- In its place, `ProjectContent.js` renders the project's title large and bold, at the top of the left column, in the visual slot the wordmark previously occupied.
- Directly below the title + location, the "Back" link appears (moved from its current position above the client/date block).
- The left text column becomes an internally scrollable area whose max height matches the rendered height of the right media column. It scrolls vertically with the native scrollbar hidden, and a CSS mask/gradient fade is applied at the top and bottom edges of the scroll area to indicate scrollable content, appearing/disappearing based on scroll position (no fade shown at the very top when already at the top; no fade at the bottom when already at the bottom).

All non-project routes (home, etc.) continue to show the FLOWERS wordmark exactly as today.

## 4. Architecture Considerations

**Wordmark suppression**: `HomeLink` already reads `usePathname()` and branches on `pathname.includes("/projects")` for the up-arrow button. The same check will be extended to conditionally skip rendering the wordmark `Link`/`Image` entirely when on a project page. This keeps `HomeLink` self-contained — it does not need project data, only the route. `ProjectContent.js` does not need to know anything about `HomeLink`; the two are decoupled by both keying off the URL pattern, which is the existing convention in this codebase.

**Title sizing**: Tailwind config already defines a `xxl` (5rem) font size, currently used only for the homepage's hero description text (`app/page.js`). Reusing `text-xl lg:text-xxl` for the project title is consistent with the existing scale rather than inventing new arbitrary font-size values, while still being visually distinct from the `text-md lg:text-lg` used for the rest of the meta block. This satisfies "a genuinely large, new size scale" without adding config entries that duplicate an existing value.

**Height matching**: CSS alone cannot make one grid/flex column's max-height track a sibling's *rendered* height when that sibling's height depends on asynchronously-loading images/video. This requires a `ResizeObserver` on the media column, with the observed height written into local state and applied as an inline `maxHeight` style (or CSS variable) on the text column's scroll container. This is the only part of the change that requires new client-side measurement logic; everything else is layout/styling.

**Scrollbar hiding + fade**: Scrollbar hiding is pure CSS (`scrollbar-width: none` plus a WebKit `::-webkit-scrollbar { display: none }`) added as a utility class in `project.css`, since Tailwind's core plugins don't ship a built-in "hide scrollbar" utility in this project's version. The fade is a `mask-image` linear-gradient applied to the scroll container. Because the fade should only show on the edge where there is more content to reveal, the mask needs to respond to scroll position (at scroll-top, no top fade; at scroll-bottom, no bottom fade). This requires a scroll event listener updating two boolean/class states (`canScrollUp`, `canScrollDown`), not just a static CSS mask, otherwise the fade would permanently obscure the first/last line of content even when there's nothing more above/below.

**Trade-off flagged**: this introduces a `ResizeObserver` + scroll listener into a component that was previously presentation-only aside from the description toggle. This is necessary because the height-matching and directional-fade requirements are inherently dynamic (dependent on image load timing and scroll position) and cannot be done in pure CSS given this codebase's Tailwind setup. Scope is kept to `ProjectContent.js` only — no new shared hook is introduced since this behavior is not used anywhere else yet.

## 5. Data Flow

`ProjectContent` already receives all data it needs via the `data` prop (title, location, client, dates, descriptions, media). No new data source is introduced. The only new runtime data is client-side, derived, and local to the component: the measured pixel height of the media column (from `ResizeObserver`, stored in state) and the two scroll-position booleans (from a `scroll` event listener on the text column, stored in state). Neither value is persisted, passed to other components, or sent to any external system. `HomeLink`'s only additional input is the already-available `pathname` from `usePathname()` — no new prop or context is added there.

## 6. Component Responsibilities

### `HomeLink.js`
- **Responsible for**: deciding whether to render the FLOWERS wordmark image based on current route; rendering the scroll-to-top button on project pages (unchanged).
- **NOT responsible for**: knowing what should appear in its place on project pages — that is entirely owned by `ProjectContent`. `HomeLink` simply renders nothing (or continues rendering only the scroll-to-top button) when on a project route.
- **Props**: none (unchanged).
- **Internal state**: none (unchanged — `pathname` from `usePathname()` is not owned state).

### `ProjectContent.js`
- **Responsible for**: rendering the large project title in the slot previously occupied by the wordmark; rendering the Back link directly beneath title/location; owning the scrollable text-column container, its height (synced to the media column via `ResizeObserver`), its hidden-scrollbar styling, and its directional fade state; rendering the description toggle (unchanged behavior, position unchanged relative to Back's new position); rendering the media column (unchanged).
- **NOT responsible for**: fetching or shaping project data (comes from `data.result`, already the case); deciding page-level chrome like nav or footer.
- **Props**: `data` (object, required) — unchanged shape, already includes `title`, `shortDescription`, `description`, `location`, `client`, `startDate`, `endDate`, `mediaContent`.
- **Internal state**:
  - `isFullDescriptionOpen` (boolean) — existing, unchanged.
  - `mediaColumnHeight` (number | null, new) — pixel height of the right column, updated via `ResizeObserver`, applied as the text column's max-height.
  - `scrollFadeState` (new) — tracks whether the text column is scrolled away from the top and/or away from the bottom, to conditionally show/hide each fade edge. Can be two booleans (`isScrolledFromTop`, `isScrolledFromBottom`) or a small object; either is acceptable, kept local to this component.

## 7. Files Affected

- `next/components/HomeLink.js` — suppress wordmark rendering on `/projects` routes.
- `next/components/ProjectContent.js` — add large title element in the wordmark's slot, reorder Back link, wrap left column content in a measured/scrollable/fade container, add `ResizeObserver` and scroll-position logic.
- `next/styles/project.css` — add scrollbar-hiding utility class and fade mask-image styles/classes for the text column.

No other files need to change: `MediaItem.js`, `queries/projectQuery.js`, `tailwind.config.js`, and `layout.js` all remain as-is, since the required font sizes already exist and the wordmark-suppression logic only needs a pathname check already available inside `HomeLink`.

## 8. Step-by-Step Implementation

**Step 1 — Suppress the wordmark on project pages (`HomeLink.js`)**
Wrap the existing `Link`/`Image` wordmark block in a condition that renders it only when `!pathname.includes("/projects")`. The surrounding `<nav id="home-link">` element and the up-arrow button logic stay as they are — only the wordmark image/link is conditionally skipped, so the nav element can still hold the up-arrow button on project pages without the logo. Watch for: if the `<nav>` becomes empty on some project sub-route, confirm there's no leftover fixed height causing blank space (the current `w-full ... hidden lg:block` container has no fixed height itself, so an empty nav should collapse naturally, but verify visually).

**Step 2 — Add the large title (`ProjectContent.js`)**
At the top of the left column (`col-span-8`), before the current `Back` link/meta block, add a title element rendering `{title}` using `text-xl lg:text-xxl font-primary font-bold uppercase leading-[1.2]` (or equivalent already-established class combination for bold uppercase primary text). This occupies the visual slot the wordmark used to fill. Watch for: this is now the *only* large-title element on the page for project routes — the existing smaller `<h1>` further down (currently `uppercase font-bold` at `text-md lg:text-lg`) should be evaluated: since the design shows a single large title (not a large one plus a duplicate smaller one), the existing `<h1 className="uppercase font-bold">{title}</h1>` should be removed to avoid rendering the title twice, keeping only the new large version. Location (`<p>{location}</p>`) stays where the h1/location block currently is, immediately after the new large title.

**Step 3 — Move the Back link (`ProjectContent.js`)**
Remove the `Back` `Link` from its current position (top of the left column, before client/date). Re-insert it immediately after the title+location block added/kept in Step 2, before the client/date lines... 

Reconcile ordering explicitly per the confirmed answer ("directly under title+location, above description"): the confirmed final order for the left column top-to-bottom is: title (new, large) → location → Back link → client → date → short description → Read More/Less toggle → full description. Watch for: confirm this reads sensibly against the design image, which shows client/date-equivalent info ("HIMS & HERS", "2025") appearing *above* the "HIMS & HERS LABS" / location block, and Back above all of it. Since the user's explicit answer was "directly under title+location, above description," and did not specify a change to client/date ordering, client/date stay in their existing position relative to title (i.e., above title, as today), and only Back moves to sit after title+location. Final order: client → date → title (large) → location → Back link → short description → Read More/Less → full description.

**Step 4 — Wrap the text column content in a scroll container (`ProjectContent.js`)**
The large title stays OUTSIDE this scroll container, rendered directly in the outer `col-span-8` element, above the wrapper described below. This is required both by the "title doesn't shrink" requirement (see below) and because the title is meant to occupy a fixed visual slot at the top of the column, not scroll away with the rest of the text.

Introduce a new inner wrapper `div` around everything else currently inside the left column (client, date, location, Back link, description, toggle) except position/sticky concerns (which stay on the outer `col-span-8` element). This inner wrapper gets a `ref` (e.g. `textColumnRef`), `overflow-y-auto`, the new scrollbar-hiding utility class from Step 6, and an inline `style={{ maxHeight: scrollAreaHeight }}` where `scrollAreaHeight` is computed in Step 5 (either the measured media-column height, or the full-viewport fallback when there are no media items). Watch for: `scrollAreaHeight` must resolve to `undefined` (not `0` or `"auto"`) before the first measurement completes, so content isn't clipped before `ResizeObserver` reports a value.

**Title does not shrink on scroll**: the title element added in Step 2 uses a fixed `text-xl lg:text-xxl` size with no scroll-linked font-size, `transform: scale()`, or clamp-based logic applied to it anywhere. Because it sits outside the scrollable wrapper (not `position: sticky` inside a shrinking container, and not targeted by any scroll event handler), nothing in this implementation causes it to resize as the user scrolls the text column beneath it — this is a property of where the title is placed in the DOM, not a separate mechanism that needs to be built.

**Step 5 — Measure the media column height, with a full-viewport fallback (`ProjectContent.js`)**
Add a `ref` (e.g. `mediaColumnRef`) to the existing `col-span-4` media wrapper `div`. In a `useEffect`, create a `ResizeObserver` targeting that ref's element, update `mediaColumnHeight` state on every reported size change, and disconnect the observer on cleanup. Watch for: images inside `MediaItem`/`DefImage` may load after initial mount and change the column's height — `ResizeObserver` handles this automatically since it fires on any size change, so no manual load-event wiring is needed. Only run this observer on desktop widths if the scroll/fade behavior is desktop-specific (mobile currently stacks columns via `grid-cols-12` with `lg:col-span-*`); if the feature should also apply on mobile, the observer stays active at all widths — this is a visual/CSS concern more than a logic concern and doesn't change the observer code.

Derive `scrollAreaHeight` (used in Step 4) from `mediaColumnHeight` with a fallback: when `mediaItems.length === 0` or `mediaColumnHeight` resolves to `0`, use a full-viewport value instead (e.g. `100vh` via a CSS class, or `window.innerHeight` minus reserved header space if a pixel value is needed for the inline style). Prefer expressing this as a CSS class swap (e.g. add a `full-viewport-scroll` class that sets `height: 100vh` via `project.css`, toggled instead of the inline `maxHeight`) rather than computing `window.innerHeight` in JS, to avoid an extra resize listener — this keeps the fallback purely CSS-driven.

**Step 6 — Hide the scrollbar and add fade masks (`project.css`)**
Add a class (e.g. `.text-column-scroll`) with `scrollbar-width: none;` and a matching `.text-column-scroll::-webkit-scrollbar { display: none; }`. Add two modifier classes or a mask-image rule driven by data attributes/classes reflecting `isScrolledFromTop`/`isScrolledFromBottom` — e.g. `.text-column-scroll.fade-top { mask-image: linear-gradient(to bottom, transparent, black 48px); }`, `.fade-bottom` for the bottom edge, and both combined when scrolled away from both edges. Watch for: `mask-image` needs a `-webkit-mask-image` fallback for Safari.

**Step 7 — Track scroll position for directional fade (`ProjectContent.js`)**
Add a scroll event handler on `textColumnRef`'s element (attached in a `useEffect`, cleaned up on unmount) that computes whether `scrollTop > 0` (apply `fade-top`... actually apply `fade-bottom` is wrong naming — clarify: fade should appear at an edge when there is *more content in that direction*, i.e. show a bottom fade when not yet scrolled to the bottom, and show a top fade when scrolled away from the top) and whether `scrollTop + clientHeight < scrollHeight`, storing both in state and applying the corresponding classes from Step 6 to the scroll container. Also run this check once after `mediaColumnHeight` changes (content may become scrollable or not as the max-height changes) and once on mount. Watch for: use a small threshold (e.g. 1-2px) rather than exact equality when comparing `scrollTop + clientHeight` to `scrollHeight`, since browsers can report fractional/rounded values that never exactly match.

## 9. Edge Cases

- **Content shorter than the media column**: if the left column's natural content height is less than `mediaColumnHeight`, `overflow-y-auto` produces no scrollbar and no fade should show on either edge — the fade classes should only apply when `scrollHeight > clientHeight`.
- **Media column height is 0 or unmeasured on first paint**: before `ResizeObserver` reports, `maxHeight` must stay unset so content isn't clipped to zero height.
- **No media items** (`mediaItems` is empty): resolved — when `mediaContent` is empty (or the measured media column height is `0`), the text column's scroll container falls back to full viewport height (e.g. `100vh` minus whatever fixed header space is already reserved elsewhere, consistent with how other full-height sections in this codebase are sized) instead of the `ResizeObserver`-measured value. This is a fallback branch in the same height-selection logic from Step 5/Step 4, not a separate mechanism.
- **Mobile viewport**: the two columns stack (`grid-cols-12` without `lg:` prefix behaves as full-width single column per current classes). Confirm whether the scroll-fade behavior should apply on mobile at all, since "match the media column's height" is a much less meaningful constraint when columns are stacked rather than side-by-side. Default to only applying the constrained-height/fade treatment at `lg` breakpoints and above, leaving mobile as full natural-height stacking (matching how `lg:sticky lg:top-32 lg:self-start` is already scoped to desktop).
- **Route transitions**: navigating from a project page back to home (client-side) must correctly re-show the FLOWERS wordmark in `HomeLink` — verify `usePathname()` updates trigger a re-render (it does, as a hook, but worth a manual check given `HomeLink` is a shared layout component that persists across route changes rather than remounting).

## 10. Test Considerations

**Manual checks**:
- Visit a project page on desktop width: confirm the wordmark is gone and the large title appears in its place; confirm only one instance of the title renders (not both a large and a small copy).
- Confirm Back link sits directly under title/location and still navigates to `/`.
- Confirm the text column has no visible scrollbar (desktop Chrome/Firefox/Safari) but is scrollable via wheel/trackpad.
- Confirm fade appears at the bottom when content is taller than the visible area and scrolled to the top; confirm the bottom fade disappears once scrolled to the bottom; confirm a top fade appears once scrolled away from the top.
- Resize the browser window / let images finish loading and confirm the text column's max-height updates to keep matching the media column.
- Visit the homepage and another project page in sequence (client-side navigation) and confirm the wordmark correctly reappears/disappears without a full page reload.
- Check mobile viewport: confirm layout still stacks sensibly and nothing is unexpectedly clipped by leftover max-height/overflow rules meant for desktop.

**Automated tests**: this codebase does not appear to have an existing component/unit test setup (no test files found alongside `ProjectContent.js` or similar components); adding automated coverage would be a larger, separate effort and is out of scope unless the project introduces a testing framework — flag this rather than assume a testing approach.

## 11. Implementation Order

1. `next/components/HomeLink.js` (existing file) — add the pathname condition to suppress the wordmark on project routes; smallest, most isolated change, safe to verify first in isolation (wordmark disappears on project pages, still shows elsewhere).
2. `next/styles/project.css` (existing file) — add the scrollbar-hiding and fade-mask utility classes next, since `ProjectContent.js` will reference these class names in the following step.
3. `next/components/ProjectContent.js` (existing file) — implement the large title, reordered Back link, scroll-container wrapper, `ResizeObserver` height sync, and scroll-position fade logic together, since these are interdependent changes within the same render tree.
