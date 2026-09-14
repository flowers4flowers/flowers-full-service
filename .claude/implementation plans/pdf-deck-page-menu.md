# PDF Deck Viewer — Page Number Menu

## 1. Goal

Give visitors viewing a PDF-type deck a way to jump directly to any page, instead of being limited to one-page-at-a-time prev/next navigation.

## 2. Current System Behaviour

`components/DeckPdfViewer.js` renders the current PDF page (`currentPage` state) via react-pdf, and renders `components/DeckPdfNav.js` — a fixed bottom bar showing a prev arrow, a "current / total" counter, and a next arrow. `DeckPdfNav` is a presentational component (`React.forwardRef`-wrapped, per the prior fit-to-viewport plan) that receives `currentPage`, `numPages`, and `onNavigate` (which is `DeckPdfViewer`'s `setCurrentPage`) as props, and calls `onNavigate(currentPage ± 1)` from its prev/next buttons. There is no way to jump to an arbitrary page; reaching page 15 from page 1 requires 14 clicks.

`components/Icons.js` already exports `HamburgerIcon` and `CloseX`, both accepting a `color` prop and rendering inline SVG with `fill`/`stroke` set to that color — the same pattern `DeckPdfNav` already uses for `LeftArrow`/`RightArrow` (`<LeftArrow color="currentColor" />`).

`styles/deck.css` defines `.deck-pdf-viewer` (full-viewport, centered, black background, `overflow: hidden`) and `.deck-pdf-nav` (fixed bottom bar, `background-color: var(--color-bg)`, `color: var(--color-text)`, flex row of prev/counter/next). This is plain CSS, not Tailwind utility classes, distinct from the site's main navigation (`components/MobileMenu.js`), which uses Tailwind classes and a global app-state context (`useAppState`/`dispatch`) to control an open/close slide-in panel. The deck portal route is a standalone client-only page (`DeckPdfViewer` is dynamically imported with `ssr: false`) with no relationship to that global app-state context.

## 3. Desired Behaviour

A hamburger icon button sits in the existing `.deck-pdf-nav` bar. Clicking it opens a dark overlay panel listing every page number from 1 to `numPages` as a vertical scrollable list. The panel appears above the nav bar's z-index so it's fully visible, with a dimmed backdrop behind it covering the rest of the viewer.

The current page number is visually distinguished from the others in the list (e.g. bold/accent styling), and the list is scrolled so that entry is already in view the moment the panel opens — no manual scrolling needed to find where you are, even in a long deck.

Clicking any page number in the list navigates the viewer to that page and closes the panel. The panel also closes if the visitor clicks the backdrop, clicks an explicit close (X) button inside the panel, or clicks the hamburger button again while the panel is open (a toggle).

The rest of the viewer's existing behavior (fit-to-viewport sizing, prev/next arrows, black background) is unchanged.

## 4. Architecture Considerations

**New component, not inline in `DeckPdfNav`**: `DeckPdfMenu` is a new file (`components/DeckPdfMenu.js`), not folded into `DeckPdfNav.js`. `DeckPdfNav` today owns exactly the fixed bottom bar's contents (prev/counter/next); the page-list overlay is a visually and structurally separate element (a full-panel overlay with its own backdrop, not part of the bottom bar's flex row), so keeping it in its own file matches the existing split where `DeckPdfViewer` composes small, single-purpose pieces.

**State ownership**: `menuOpen` (boolean) is owned by `DeckPdfViewer`, not by `DeckPdfNav` or `DeckPdfMenu`, because the trigger button (in `DeckPdfNav`) and the panel (in `DeckPdfMenu`) are siblings that both need to read/toggle the same value — lifting it to their common parent avoids introducing a new context or event-bus mechanism for a single boolean, consistent with how `currentPage` is already owned by `DeckPdfViewer` and passed down to `DeckPdfNav`.

**No dependency on the site-wide `MobileMenu`/app-state context**: the deck portal route is intentionally isolated from the main site chrome (no header, no site nav, confirmed by the earlier `portal-header-removal-pdf-nav` plan). Reusing `useAppState`/`dispatch` would couple this standalone viewer to global site state it has no other relationship with, for the sake of one boolean that only this component tree cares about. Local `useState` in `DeckPdfViewer` is simpler and has no such coupling.

**Styling approach**: plain CSS in `styles/deck.css`, following the existing `.deck-pdf-viewer`/`.deck-pdf-nav` convention, not Tailwind utility classes — consistent with the rest of this file and distinct from `MobileMenu.js`'s Tailwind-based styling, which belongs to a different part of the app with a different styling convention already established.

**Reusing existing icons**: `HamburgerIcon` and `CloseX` from `Icons.js` are used as-is (same `color="currentColor"` pattern already used for `LeftArrow`/`RightArrow` in `DeckPdfNav`), so no new icon assets are introduced.

**No new dependencies**: this is plain React state, conditional rendering, and CSS — no portal/modal library, no animation library.

## 5. Data Flow

`DeckPdfViewer` already owns `currentPage`, `numPages`, and the `setCurrentPage` updater (passed to `DeckPdfNav` as `onNavigate`). This plan adds one new piece of state to `DeckPdfViewer`: `menuOpen` (boolean, initialized `false`).

`DeckPdfNav` receives one new prop, `onToggleMenu` (a function `DeckPdfViewer` passes down, e.g. `() => setMenuOpen((open) => !open)`), wired to the new hamburger button's `onClick`.

`DeckPdfMenu` is rendered by `DeckPdfViewer` as a new sibling of `DeckPdfNav`, receiving `numPages`, `currentPage`, `isOpen` (`menuOpen`), `onNavigate` (the same `setCurrentPage` passed to `DeckPdfNav`), and `onClose` (`() => setMenuOpen(false)`). When a page number is clicked inside `DeckPdfMenu`, it calls both `onNavigate(page)` and `onClose()` — `DeckPdfViewer`'s state updates flow back down, `currentPage` changes (re-rendering the `<Page>`), and `menuOpen` becomes `false` (hiding the panel), in the same render pass.

No new data is fetched or sent anywhere external; this is entirely client-side, in-memory navigation state, identical in nature to the existing `currentPage` state.

## 6. Component Responsibilities

### `components/DeckPdfViewer.js` (modified)
- Responsible for: owning `menuOpen` state (new), passing `onToggleMenu` to `DeckPdfNav`, rendering `DeckPdfMenu` and passing it the props it needs.
- NOT responsible for: the panel's internal layout, the backdrop's click handling, or the hamburger icon's visual rendering (all owned by `DeckPdfNav`/`DeckPdfMenu`).
- Props: unchanged — `pdfUrl` (string, required).
- Internal state: existing `pdfProxy`, `numPages`, `currentPage`, `viewportSize`, `navHeight`, `pageAspectRatio` (all unchanged) plus new `menuOpen` (boolean, initialized `false`).

### `components/DeckPdfNav.js` (modified)
- Responsible for: rendering the fixed bottom bar including the existing prev/counter/next controls, plus a new hamburger button that calls `onToggleMenu` when clicked.
- NOT responsible for: knowing whether the menu is currently open, or rendering any part of the menu panel itself — it only triggers the toggle.
- Props: existing `currentPage`, `numPages`, `onNavigate` (unchanged) plus new `onToggleMenu` (function, required, called with no arguments on hamburger click).
- Internal state: none (unchanged).

### `components/DeckPdfMenu.js` (new)
- Responsible for: rendering the backdrop and the page-number list when `isOpen` is true (rendering nothing, or nothing visible, when `isOpen` is false); highlighting the entry matching `currentPage`; auto-scrolling that entry into view whenever the panel transitions to open; calling `onNavigate(page)` followed by `onClose()` when a page number is clicked; calling `onClose()` when the backdrop or the panel's own close (X) button is clicked.
- NOT responsible for: deciding whether it's open (that's `isOpen`, owned by the parent), or performing the actual page navigation logic beyond calling the provided `onNavigate` callback.
- Props: `isOpen` (boolean, required), `numPages` (number, required), `currentPage` (number, required), `onNavigate` (function, required, called with a page number), `onClose` (function, required, called with no arguments).
- Internal state: none needed for the menu's own open/closed state (controlled by `isOpen` from the parent); holds a `ref` to the current-page list item (or the scroll container) purely to implement the auto-scroll-into-view behavior, not exposed as state.

### `styles/deck.css` (modified)
- Responsible for: all visual styling for the new hamburger button (sized/positioned within the existing `.deck-pdf-nav` flex row), the menu overlay/backdrop, the scrollable page list, individual page-number entries, the active-page highlight style, and the panel's close button.
- NOT responsible for: any component logic, open/close state, or scroll-into-view behavior (that's imperative DOM behavior driven from `DeckPdfMenu.js`, not CSS-only).

## 7. Files Affected

- `components/DeckPdfViewer.js` — add `menuOpen` state; pass `onToggleMenu` to `DeckPdfNav`; render `DeckPdfMenu`.
- `components/DeckPdfNav.js` — add the hamburger button and its `onToggleMenu` wiring inside the existing bottom bar markup.
- `components/DeckPdfMenu.js` — new file; the overlay/backdrop/page-list component itself.
- `styles/deck.css` — new CSS rules for the hamburger button, overlay, backdrop, list, entries, active-entry highlight, and close button.

No changes to `DeckEmbed.js`, `app/(portal)/layout.js`, `app/(portal)/portal/[token]/page.js`, `Icons.js` (existing `HamburgerIcon`/`CloseX` are reused unmodified), or any Kirby/query files.

## 8. Step-by-Step Implementation

**Step 1 — `components/DeckPdfMenu.js` (new file)**
Create the component accepting `{ isOpen, numPages, currentPage, onNavigate, onClose }`. Render a backdrop element (`onClick={onClose}`) and a panel element, both conditionally rendered based on `isOpen` — simplest approach is to return `null` outright when `isOpen` is false, avoiding any need to manage CSS-visibility transitions for this first pass (no animation was requested). Inside the panel: a close button using `CloseX` (`onClick={onClose}`, stopping propagation from the backdrop's click handler is unnecessary if the close button is a sibling of the backdrop rather than a descendant — structure it so the panel itself is not inside the backdrop's click-capturing area, or explicitly call `event.stopPropagation()` on the panel's own click handler so clicks inside the panel don't bubble to the backdrop and immediately close it). Render a scrollable list (`<ul>`/`<li>` or a `<div>` of buttons — buttons are preferable for accessibility, each page number as a `<button type="button">`) for page numbers `1` through `numPages`, each calling `onNavigate(pageNumber); onClose();` on click, with the entry matching `currentPage` given a distinct class (e.g. `deck-pdf-menu__item--active`).

Add a `useRef` for the active list item (or use `useEffect` with `querySelector` inside the component's own root ref — a ref on the active `<button>` itself is more direct: assign the ref only to the button whose `pageNumber === currentPage`). Add a `useEffect` keyed on `isOpen` (and `currentPage`, in case the active page changes while already open, though this is not expected in-flow since selecting a page closes the menu — the dependency is included defensively) that, when `isOpen` becomes true, calls `.scrollIntoView({ block: "nearest" })` (or `{ block: "center" }` for a more centered reveal — either is acceptable; `"center"` gives a clearer sense of position within the full list) on the active item's ref, guarded for the ref being non-null (it will be null on the first render before the DOM node exists, and whenever `isOpen` is false since the component returns `null`).

Watch for: since the component returns `null` when closed, the ref is torn down and rebuilt each time the panel opens — the `useEffect`'s dependency on `isOpen` ensures the scroll call runs after the panel (and its DOM) exists again, not before.

**Step 2 — `styles/deck.css`: menu and hamburger styling**
Add new rules (grouped under a new `/* Deck (pdf menu) */` comment block, following the file's existing section-comment convention): a backdrop class (fixed, `inset: 0`, semi-transparent black, sitting below the panel but above the rest of the viewer in `z-index`), a panel class (fixed positioning — e.g. centered or anchored, dark background consistent with `.deck-pdf-viewer`'s black, a bounded `max-height` with `overflow-y: auto` for the scrollable list, above the backdrop in `z-index` and above `.deck-pdf-nav` too, since the nav bar must not visually sit on top of the open menu), list-item button styling (matching the site's existing `font-secondary`/text sizing conventions used elsewhere in this file, e.g. `.deck-pdf-nav__counter`), an active-item modifier class (distinct color/weight), and a close-button class positioned within the panel (e.g. top-right corner, sized similarly to how `CloseX` is used elsewhere in the codebase if such a precedent exists — otherwise a reasonable fixed pixel/rem size consistent with the hamburger's own sizing). Also add hamburger button styling inside `.deck-pdf-nav`'s existing rule group (or a new adjacent rule), sized comparably to the existing prev/next SVG buttons (`.deck-pdf-nav__prev`/`.deck-pdf-nav__next` currently size their SVGs to `1.4rem` wide) and positioned within the bar's flex row — exact placement (before prev, after next, or elsewhere in the row) to be decided in Step 3 alongside the JSX ordering, since CSS alone doesn't fix position within a `flex` row beyond source order (no `order` property is planned, keeping DOM order and visual order identical for simplicity and accessibility/tab-order correctness).

**Step 3 — `components/DeckPdfNav.js`: add the hamburger trigger**
Import `HamburgerIcon` from `./Icons` (alongside the existing `LeftArrow`/`RightArrow` import). Destructure the new `onToggleMenu` prop. Add a new `<button type="button" className="deck-pdf-nav__menu-toggle" onClick={onToggleMenu}><HamburgerIcon color="currentColor" /></button>` inside the existing `.deck-pdf-nav` div, placed as the first child (before the prev button) so it reads left-to-right as "menu, prev, counter, next" — a reasonable default placement; flag this ordering choice to the user if a different position (e.g. after next) is preferred, since this is a minor UX call not explicitly specified. No other changes to the existing prev/counter/next markup or the `forwardRef` wiring from the prior plan.

**Step 4 — `components/DeckPdfViewer.js`: state and composition**
Add `const [menuOpen, setMenuOpen] = useState(false);` alongside the existing state declarations. Import `DeckPdfMenu` from `./DeckPdfMenu` (alongside the existing `DeckPdfNav` import). Pass `onToggleMenu={() => setMenuOpen((open) => !open)}` to the existing `<DeckPdfNav>` element (in addition to its existing `ref`, `currentPage`, `numPages`, `onNavigate` props). Render `<DeckPdfMenu isOpen={menuOpen} numPages={numPages} currentPage={currentPage} onNavigate={setCurrentPage} onClose={() => setMenuOpen(false)} />` as a new sibling, placed after `<DeckPdfNav>` in the JSX (so it visually stacks above it, though actual stacking is controlled by `z-index` from Step 2, not DOM order) — guarded by the same `{numPages && (...)}` condition already wrapping `DeckPdfNav`, since there's nothing to navigate to before `numPages` is known.

Watch for: reusing `setCurrentPage` directly as `DeckPdfMenu`'s `onNavigate` prop (the same function already passed to `DeckPdfNav`) — no new navigation logic is introduced, only a new entry point that calls the existing setter with an arbitrary page number instead of `currentPage ± 1`.

## 9. Edge Cases

Deck with a very large number of pages (e.g. 100+): the vertical list scrolls within its own bounded `max-height` rather than growing the panel beyond the viewport; the auto-scroll-to-active-page behavior specifically exists to make this case usable (no manual scrolling needed to find your place).

Deck with very few pages (e.g. 2-3): the list is short enough to need no internal scrolling; `overflow-y: auto` on the list container has no visible effect in this case (no scrollbar appears unless content actually overflows), so no special-casing is needed.

Menu open while `currentPage` changes some other way: not reachable in the current design, since every path that changes `currentPage` while the menu is relevant (clicking a page number) also closes the menu in the same action; the prev/next buttons remain visible but are behind the open panel's backdrop/panel in `z-index`, so they aren't clickable while the menu is open (implicitly prevented by the panel covering them, not by disabling them — worth confirming visually in testing that the panel's `z-index`/positioning actually covers the nav bar and doesn't leave the prev/next buttons clickable underneath).

Rapid toggle clicking (opening/closing quickly): since there's no animation/transition and the component simply returns `null` when closed, there's no in-flight transition state to race — each click synchronously flips `menuOpen` and the next render reflects it.

Menu opened when `currentPage` is `1` or `numPages` (first/last page): the auto-scroll-into-view behavior naturally handles the edge of the list correctly via the browser's native `scrollIntoView`, which clamps to the scrollable container's actual bounds — no manual clamping logic is needed.

## 10. Test Considerations

Manual checks:
- Open the menu via the hamburger button; confirm the backdrop and page list appear above both the PDF page and the nav bar.
- Confirm the current page's entry is visually distinct and already scrolled into view on open, including when the current page is near the end of a long deck.
- Click a page number; confirm the viewer navigates to that page and the menu closes.
- Reopen the menu; confirm the newly active page is now highlighted and back in view.
- Click the backdrop; confirm the menu closes without navigating.
- Click the panel's close (X) button; confirm the menu closes without navigating.
- Click the hamburger button again while the menu is open; confirm it closes (toggle behavior).
- Confirm prev/next navigation still works correctly when the menu is closed, unaffected by these changes.
- Test on a deck with very few pages and (if available) a deck with many pages, to check both the no-scroll and scrolling-list cases.
- Resize the browser window while the menu is open (or closed) to confirm no interaction with the existing fit-to-viewport sizing logic from the prior plan.

No automated test suite exists for this app; no new automated tests are introduced by this plan.

## 11. Implementation Order

1. `components/DeckPdfMenu.js` — new file. Built first since it's a self-contained component whose props are already fully specified; nothing else depends on its internals, only on its prop contract.
2. `styles/deck.css` — existing file, modified. Adds the visual styling the new component and button need; done before wiring them in so the result is visually correct as soon as the JSX changes land, rather than appearing unstyled in between steps.
3. `components/DeckPdfNav.js` — existing file, modified. Adds the hamburger trigger button; depends on `Icons.js`'s existing `HamburgerIcon` (already present, unmodified) and the CSS from Step 2.
4. `components/DeckPdfViewer.js` — existing file, modified. Wires `menuOpen` state, the `onToggleMenu` prop, and renders `DeckPdfMenu`; last, since it depends on all three prior steps (the menu component existing, its styling existing, and the nav's trigger button existing to toggle it).
