# PDF Deck Viewer — Thumbnail Slide-Out Menu

## 1. Goal

Replace the centered-modal page-number menu (shipped in `pdf-deck-page-menu.md`) with a left-edge slide-out panel, and upgrade each entry from a bare page number to a small rendered thumbnail of that page plus its number — so visitors can visually scan for the page they want instead of reading a plain numbered list floating in the middle of the screen.

## 2. Current System Behaviour

`components/DeckPdfMenu.js` (just shipped) renders `null` when `isOpen` is false, and otherwise renders a fixed, full-viewport, centered backdrop (`.deck-pdf-menu-backdrop`) containing a centered panel (`.deck-pdf-menu`, `width: min(20rem, 80vw)`, vertically and horizontally centered via the backdrop's flexbox) with a close (X) button and a vertical `<ul>` of page-number `<button>`s (1 through `numPages`). The active page's button gets an `activeItemRef` and is scrolled into view (`scrollIntoView({ block: "center" })`) whenever the panel opens. Clicking a number calls `onNavigate(page)` then `onClose()`. Clicking the backdrop calls `onClose()` directly; a click inside the panel calls `event.stopPropagation()` so it doesn't bubble to the backdrop.

`components/DeckPdfNav.js` renders the fixed bottom bar (prev/counter/next, unchanged from the prior fit-to-viewport plan) plus a hamburger button (`.deck-pdf-nav__menu-toggle`, using `Icons.js`'s `HamburgerIcon`) added in the same prior plan, which calls the `onToggleMenu` prop passed down from `DeckPdfViewer`.

`components/DeckPdfViewer.js` owns `menuOpen` (boolean, `useState`, initialized `false`) and renders `<DeckPdfMenu isOpen={menuOpen} numPages={numPages} currentPage={currentPage} onNavigate={setCurrentPage} onClose={() => setMenuOpen(false)} />` as a sibling of `<DeckPdfNav>`, both inside `.deck-pdf-viewer`, both gated on `numPages` being truthy. `DeckPdfViewer` also holds `pdfProxy` — the `PDFDocumentProxy` object obtained from `<Document>`'s `onLoadSuccess={(pdf) => { setPdfProxy(pdf); setNumPages(pdf.numPages); }}` — currently used only to prefetch adjacent pages (`pdfProxy.getPage(currentPage ± 1)`). `pdfProxy` is not currently passed to `DeckPdfMenu` or used for rendering anything visual.

`react-pdf` (installed, version 9.2.1, confirmed via `node_modules/react-pdf/package.json`) ships a `Thumbnail` component (`node_modules/react-pdf/src/Thumbnail.tsx`) in addition to `Document`/`Page`. `Thumbnail` internally renders a `<Page>` with `renderAnnotationLayer={false}` and `renderTextLayer={false}` (so it never needs the `AnnotationLayer.css`/`TextLayer.css` imports `DeckPdfViewer` added for the full-size page), wrapped in an `<a>` that calls an `onItemClick({ pageIndex, pageNumber })` callback when clicked instead of navigating a real link. Per its own documentation comment, `Thumbnail` normally expects to be rendered inside a `<Document>`, but explicitly supports an alternative: passing the `pdf` prop directly (the same `PDFDocumentProxy` object `<Document>`'s `onLoadSuccess` provides) — which is exactly what `DeckPdfViewer`'s existing `pdfProxy` state already is. `Thumbnail` accepts the same sizing props as `Page` (`width`, `height`, `scale`), so a small pixel `width` renders a small canvas without needing a second, separately-loaded low-resolution asset.

`DeckPdfMenu` is currently rendered as a sibling of `<Document>` (not nested inside it) in `DeckPdfViewer`'s JSX — `<Document>` wraps only the single full-size `<Page>`, while `<DeckPdfNav>` and `<DeckPdfMenu>` sit outside it, after it, inside `.deck-pdf-viewer`.

## 3. Desired Behaviour

Clicking the hamburger button slides a panel in from the left edge of the screen (rather than fading/appearing centered), with the same dimmed backdrop behind it as today. Clicking the backdrop, the panel's own close (X) button, or the hamburger button again all slide the panel back out to the left and closed, exactly as today's open/close triggers already work — only the visual motion and position change.

Each entry in the panel's list now shows a small rendered thumbnail image of that PDF page above or beside its page number (both are visible; number is a caption to the thumbnail), instead of the number alone. The currently active page's entry is still visually distinguished and still auto-scrolls into view when the panel opens.

Thumbnails render lazily: opening the panel does not immediately render a small canvas for every page in the deck. Instead, each entry's thumbnail begins as a lightweight placeholder and renders its actual page image only once it scrolls into the panel's visible scrolling area. This keeps opening the menu cheap regardless of how many pages a deck has.

The panel (and its thumbnail-rendering machinery) is not created at all until the visitor opens the menu for the first time. After that first open, it remains present (off-screen, translated out of view) so that later opens and closes can animate smoothly rather than needing to be rebuilt from nothing each time.

## 4. Architecture Considerations

**Passing `pdfProxy` down instead of re-fetching**: `DeckPdfViewer` already holds the exact `PDFDocumentProxy` object (`pdfProxy`) that `Thumbnail`'s `pdf` prop needs, obtained the same way `<Document>` already obtains it. Passing this existing state down to `DeckPdfMenu` as a new `pdf` prop avoids nesting `DeckPdfMenu` inside `<Document>` (which would require restructuring where the menu lives in the tree, and would couple the menu's mount timing to `<Document>`'s own children) and avoids a second, redundant PDF load — `pdf.js` (via `react-pdf`) caches parsed page data on the shared document proxy, so rendering a `Thumbnail` for a page already fetches through the same proxy, reusing whatever range-request data pdf.js has already retrieved rather than issuing a wholly separate fetch pipeline.

**Why `Thumbnail` over reusing `<Page>` directly**: `Thumbnail` is purpose-built for exactly this case — it skips the annotation and text layers entirely (`renderAnnotationLayer={false}`, `renderTextLayer={false}`), which are unnecessary overhead for a small preview image that's never meant to be read or interacted with as text, and it provides the `onItemClick` callback shape already suited to "clicked this page's preview, go there" navigation, matching the exact interaction this menu already needs.

**Lazy rendering via `IntersectionObserver`, scoped to the panel's own scroll container**: with `numPages` potentially large, rendering every page's `Thumbnail` (each its own `pdf.js` canvas render) the instant the panel opens risks a visible stall proportional to deck length. Each list entry instead renders a fixed-size placeholder `<div>` by default, and only swaps in the real `<Thumbnail>` once an `IntersectionObserver` reports that entry has scrolled into the panel's own scrollable list area — the observer's `root` is explicitly set to the scrolling list container (not left as `null`/the browser viewport), because the panel is positioned via `transform: translateX(...)` when closed (see below) rather than `display: none`, and `IntersectionObserver`'s viewport-based default `root` would not reliably reflect what's "visible within the panel" once transforms are involved; scoping `root` to the list container makes intersection purely a function of scroll position within that container, independent of the panel's own on/off-screen transform state.

**Mount-on-first-open, not always-mounted**: the panel (and therefore its `IntersectionObserver` and however many placeholder/thumbnail entries exist) is only constructed the first time `menuOpen` becomes `true`. This avoids setting up observer machinery and DOM nodes for the (common) case where a visitor never opens the menu at all, while still satisfying the animation requirement — once created, the panel stays mounted (positioned off-screen via `transform` when `menuOpen` is `false`) so subsequent toggles are pure CSS transitions rather than mount/unmount cycles. This is implemented as a new boolean, `hasOpenedMenu` (or equivalent), separate from `menuOpen` itself: `menuOpen` continues to control the open/closed visual state every time, while a one-way latch (set `true` the first time `menuOpen` becomes `true`, never reset back to `false`) controls whether the panel's DOM/JSX exists at all.

**Slide animation via CSS transform/transition, not conditional rendering**: the previous version's `if (!isOpen) return null;` early return is removed for the panel/backdrop's mounted-vs-unmounted decision (replaced by the mount-on-first-open latch above); instead, `isOpen` now controls a CSS class (e.g. `deck-pdf-menu--open` on the backdrop, or a data attribute) that toggles `transform: translateX(0)` (open, panel's left edge at the viewport's left edge) versus `transform: translateX(-100%)` (closed, panel fully off-screen to the left) on the panel itself, and toggles the backdrop's opacity/`pointer-events` similarly (visible + clickable when open, invisible + click-through when closed) so the dimmed backdrop doesn't block interaction with the rest of the viewer while the panel is closed. `transition: transform 0.3s ease` (or similar) on the panel provides the slide motion; this duration matches the existing `0.3s` transitions already used elsewhere in `deck.css` (e.g. `.deck-pdf-nav__prev`/`.deck-pdf-nav__next`'s hover opacity transitions), for visual consistency within the same file rather than introducing an unrelated timing value.

**Panel width and layout stay a narrow single column**: given the deck's pages are wide (16:9-ish, per the fit-to-viewport plan's aspect-ratio handling), a single thumbnail per row at a narrow panel width (roughly 300-350px) keeps each thumbnail legibly sized without needing a multi-column grid, and keeps the panel from covering most of the screen on smaller viewports.

**No new dependencies**: `Thumbnail` and `IntersectionObserver` are both already available (react-pdf is an existing dependency; `IntersectionObserver` is a standard browser API, no polyfill added, consistent with this app's existing use of browser-native APIs like `resize` events in `DeckPdfViewer` rather than reaching for a library).

## 5. Data Flow

`DeckPdfViewer` passes one new prop to `DeckPdfMenu`: `pdf` (the existing `pdfProxy` state, unchanged in how it's obtained — only now also threaded down as a prop, in addition to its existing use for adjacent-page prefetching). All other props `DeckPdfMenu` already receives (`isOpen`, `numPages`, `currentPage`, `onNavigate`, `onClose`) are unchanged in shape or meaning.

Inside `DeckPdfMenu`, a new one-way `hasOpenedMenu` boolean (local `useState`, initialized `false`) is set to `true` via a `useEffect` keyed on `isOpen` the first time `isOpen` becomes `true`, and never reset. The panel's JSX is gated on `hasOpenedMenu` (render nothing until the first open has happened) rather than on `isOpen` directly (which now only controls the open/closed CSS state of an already-mounted panel).

Each list entry owns a small piece of local visibility state (whether its `Thumbnail` should render yet), set by its own `IntersectionObserver` callback the first time that entry intersects the scrolling list container. Once set to visible, an entry does not need to become invisible again (no need to unmount thumbnails that scroll back out of view for this deck-size scale) — this is a one-way reveal, not a virtualization scheme that recycles DOM nodes.

The `Thumbnail`'s `onItemClick={({ pageNumber }) => { onNavigate(pageNumber); onClose(); }}` callback flows into the exact same `onNavigate`/`onClose` props already wired from `DeckPdfViewer`, unchanged from how the plain-number buttons call them today — only the triggering element changed from a `<button>` to `Thumbnail`'s own clickable `<a>` wrapper.

## 6. Component Responsibilities

### `components/DeckPdfViewer.js` (modified)
- Responsible for: passing its existing `pdfProxy` state down to `DeckPdfMenu` as a new `pdf` prop, in addition to everything it already does.
- NOT responsible for: any change to how `pdfProxy` itself is obtained, or to the adjacent-page prefetching effect that already reads it.
- Props: unchanged — `pdfUrl` (string, required).
- Internal state: unchanged from the prior plan (`pdfProxy`, `numPages`, `currentPage`, `viewportSize`, `navHeight`, `pageAspectRatio`, `menuOpen`).

### `components/DeckPdfNav.js`
- Unchanged by this plan. The hamburger trigger and prev/counter/next controls keep working exactly as already shipped.

### `components/DeckPdfMenu.js` (modified)
- Responsible for: mounting itself (panel + backdrop) on first open and staying mounted afterward; toggling the open/closed CSS state that drives the slide animation and backdrop dimming; rendering one entry per page (1 through `numPages`) each showing a lazily-rendered thumbnail plus page number; highlighting and auto-scrolling to the active page's entry; closing on backdrop click, close-button click, or a page entry being selected; calling `onNavigate`/`onClose` on selection exactly as before.
- NOT responsible for: deciding whether the menu is open (`isOpen`, still owned by `DeckPdfViewer`), fetching or parsing the PDF itself (uses the `pdf` proxy handed to it), or the hamburger trigger button (still `DeckPdfNav`'s).
- Props: existing `isOpen`, `numPages`, `currentPage`, `onNavigate`, `onClose` (all unchanged in meaning) plus new `pdf` (the `PDFDocumentProxy` object, required once the panel renders any thumbnails — `Thumbnail` itself already `invariant`-checks that a `pdf` is available, so no additional guard is needed beyond the existing `numPages &&` gate already used in `DeckPdfViewer` before rendering `DeckPdfMenu` at all, since `pdfProxy` and `numPages` become available together from the same `onLoadSuccess` call).
- Internal state: existing `activeItemRef` (unchanged) plus new `hasOpenedMenu` (boolean, latches true on first open, drives whether the panel's DOM exists at all).

### `components/DeckPdfMenuItem.js` (new, extracted from `DeckPdfMenu.js`'s list rendering)
- Responsible for: one list entry — observing its own visibility within the panel's scroll container via `IntersectionObserver`, rendering a placeholder until first visible, then rendering `Thumbnail` (with a small fixed `width`) plus the page number caption, applying the active-page styling when it is the current page, and forwarding clicks (via `Thumbnail`'s `onItemClick`) up to the page-selection behavior.
- NOT responsible for: knowing about any other entry, the panel's open/closed state, or the backdrop.
- Props: `pdf` (required, forwarded to `Thumbnail`), `pageNumber` (number, required), `isActive` (boolean, required), `activeItemRef` (ref, optional — only meaningfully used when `isActive` is true, so the parent can scroll this specific entry into view), `onSelect` (function, required, called with no arguments — the parent already knows which `pageNumber` this is; simpler than requiring the child to pass it back), `scrollRoot` (the panel's scrollable container element or ref, required, passed to the `IntersectionObserver` as its `root`).
- Internal state: `isVisible` (boolean, `useState(false)`, flipped to `true` by its `IntersectionObserver` callback and never reset).

## 7. Files Affected

- `components/DeckPdfViewer.js` — pass `pdfProxy` down to `DeckPdfMenu` as a new `pdf` prop.
- `components/DeckPdfMenu.js` — replace the "return null when closed" pattern with mount-on-first-open plus a CSS-driven open/closed state; replace the plain-number `<li><button>` list rendering with a list of the new `DeckPdfMenuItem` components; reposition the panel to the left edge instead of centering it.
- `components/DeckPdfMenuItem.js` — new file; the per-entry lazy-thumbnail component.
- `styles/deck.css` — reposition `.deck-pdf-menu` to a left-anchored, full-height panel with a slide transition; add open/closed state classes for the panel and backdrop; add styling for the thumbnail placeholder and the `Thumbnail`-rendered image/canvas within each entry; adjust `.deck-pdf-menu__list`/`.deck-pdf-menu__item` from the current centered-text button styling to accommodate a thumbnail-plus-caption layout per row.

No changes to `components/DeckPdfNav.js`, `components/Icons.js`, `components/DeckEmbed.js`, `app/(portal)/layout.js`, `app/(portal)/portal/[token]/page.js`, or any Kirby/query files.

## 8. Step-by-Step Implementation

**Step 1 — `components/DeckPdfMenuItem.js` (new file)**
Create the component accepting `{ pdf, pageNumber, isActive, activeItemRef, onSelect, scrollRoot }`. Add local state `const [isVisible, setIsVisible] = useState(false)`, and a `useRef` for the entry's own root DOM node (needed as the `IntersectionObserver`'s target, distinct from `activeItemRef`, which is specifically for the scroll-into-view behavior and only meaningful on the active entry). Add a `useEffect` that, when `isVisible` is already `true`, does nothing further (avoids re-observing once revealed); otherwise creates an `IntersectionObserver` scoped to `scrollRoot` (passed as `root`), observes the entry's own node, and on the first intersecting callback calls `setIsVisible(true)` and disconnects the observer (no need to keep observing after the one-way reveal). Clean up (disconnect) on unmount regardless.

Render a wrapping element that receives both the entry's own ref (for the observer) and, conditionally, `activeItemRef` when `isActive` is true (a single DOM node can only take one `ref` prop directly — use a callback ref that assigns to both the internal ref and, if `isActive`, forwards the same node to `activeItemRef.current`, or restructure so the internal per-entry ref itself is what `DeckPdfMenu` reads for scrolling, keyed by `pageNumber === currentPage`, removing the need for two separate refs entirely — the latter is simpler and is the intended approach: `DeckPdfMenuItem` does not need its own separate `activeItemRef` prop if `DeckPdfMenu` instead tracks which page is active and this component's own internal node ref is what gets scrolled into view via a callback ref pattern: `ref={(node) => { entryRef.current = node; if (isActive) activeItemRef.current = node; }}`).

Inside, render either the placeholder (a fixed-aspect-ratio `<div className="deck-pdf-menu__thumb-placeholder">`, sized via CSS to a small fixed width matching the eventual `Thumbnail` width, so no layout shift occurs when the real thumbnail swaps in) when `!isVisible`, or `<Thumbnail pdf={pdf} pageNumber={pageNumber} width={<small fixed pixel value, e.g. 96>} onItemClick={onSelect} />` when `isVisible`. Below or beside it, render the page number caption (e.g. `<span className="deck-pdf-menu__item-number">{pageNumber}</span>`). Apply an active-state class on the wrapping element when `isActive`.

Watch for: `Thumbnail`'s `onItemClick` callback signature is `({ pageIndex, pageNumber })`, not a plain click event — `onSelect` here is defined as taking no arguments (per the plan's prop contract above) specifically so this component doesn't need to know or care about that shape; wrap it inline as `onItemClick={() => onSelect()}` rather than passing `onSelect` directly as `onItemClick`, since passing it directly would silently hand `onSelect` an object argument it doesn't expect (harmless in practice since `onSelect` takes no meaningful arguments, but wrapping explicitly documents the intent and avoids relying on an accidental compatibility).

**Step 2 — `styles/deck.css`: reposition the panel, add slide transition, restyle entries for thumbnails**
Modify `.deck-pdf-menu-backdrop`: keep `position: fixed; inset: 0; z-index: 10;` and the dim color, but remove `display: flex; align-items: center; justify-content: center;` (no longer centering a child, since the panel is now independently positioned to the left edge) and add `opacity`/`pointer-events` toggling driven by a new open-state class (e.g. default `opacity: 0; pointer-events: none;`, and `.deck-pdf-menu-backdrop--open { opacity: 1; pointer-events: auto; }`), plus `transition: opacity 0.3s ease;` for a matching fade alongside the panel's slide.

Modify `.deck-pdf-menu`: change from the current centered, width-capped, auto-height box to `position: fixed; top: 0; left: 0; bottom: 0; z-index: 20; width: min(20rem, 85vw);` (full viewport height, left-anchored, narrow), keep `background-color: #000000; color: #ffffff; overflow-y: auto;` (the panel itself becomes the scrollable container — this is the element that becomes the `scrollRoot` passed down to each `DeckPdfMenuItem`), add `transform: translateX(-100%); transition: transform 0.3s ease;` as the default (closed) state, and a new open-state class (e.g. `.deck-pdf-menu--open { transform: translateX(0); }`).

Update `.deck-pdf-menu__list` and replace `.deck-pdf-menu__item` (previously a centered-text `<button>`) with new rules for `DeckPdfMenuItem`'s wrapping element and its thumbnail/caption layout: each entry stacked as thumbnail-above-caption (or side-by-side — narrow panel width favors stacked, matching the "one per row" decision), consistent spacing (`gap`) between entries, and a `.deck-pdf-menu__thumb-placeholder` rule sized to match the eventual thumbnail's rendered dimensions (fixed `width` matching the `width` passed to `Thumbnail` in Step 1, with `aspect-ratio` matching the deck's known aspect ratio if available, or a reasonable fixed height otherwise, to avoid layout shift when the placeholder swaps for the real image) with a subtle background (e.g. a slightly lighter black/gray) so it reads as a loading state rather than empty space. Keep the active-item modifier class (previously `.deck-pdf-menu__item--active`, now applied to `DeckPdfMenuItem`'s wrapping element) as a distinct visual treatment (e.g. a border or background highlight around the thumbnail, since bold text alone is less noticeable now that the primary visual is an image, not text).

**Step 3 — `components/DeckPdfMenu.js`: mount-on-first-open, open/closed class toggling, render `DeckPdfMenuItem` list**
Add `const [hasOpenedMenu, setHasOpenedMenu] = useState(false);`. Add a `useEffect` keyed on `isOpen` that calls `setHasOpenedMenu(true)` when `isOpen` is `true` (a no-op if already `true`, since `useState` setters short-circuit an unchanged value, so no extra guard is strictly needed, though an explicit `if (isOpen) setHasOpenedMenu(true);` inside the effect is clearer than relying on that implicitly). Remove the existing `if (!isOpen) { return null; }` early return; replace the component's top-level gating with `if (!hasOpenedMenu) { return null; }` instead (nothing renders until the first open; everything after that point stays mounted).

Add a `useRef` for the panel's own scrollable DOM node (`panelRef`), attached to the `.deck-pdf-menu` element — this is the `scrollRoot` passed to each `DeckPdfMenuItem`. Keep the existing `activeItemRef` (still used by the "scroll active entry into view" effect) — per Step 1's simplification, this ref is now populated by `DeckPdfMenuItem`'s own callback ref pattern rather than being passed into and directly attached by a `<button>` here.

Replace backdrop/panel `className`s to include the open-state modifier classes conditionally (e.g. `` `deck-pdf-menu-backdrop${isOpen ? " deck-pdf-menu-backdrop--open" : ""}` `` and similarly for `.deck-pdf-menu--open`), driven by `isOpen` directly (not `hasOpenedMenu`) — `isOpen` continues to be the moment-to-moment open/closed signal now expressed as CSS state instead of mount state.

Replace the existing `<ul className="deck-pdf-menu__list">...number buttons...</ul>` with the same `Array.from({ length: numPages }, ...)` mapping, but rendering `<DeckPdfMenuItem key={page} pdf={pdf} pageNumber={page} isActive={page === currentPage} activeItemRef={activeItemRef} scrollRoot={panelRef.current} onSelect={() => { onNavigate(page); onClose(); }} />` for each page — `onSelect` closes over `page` from the `map` callback exactly as the previous `onClick` handler did, so the "navigate then close" behavior is unchanged in effect, only moved from an inline button handler to a passed-down callback.

Watch for: `scrollRoot={panelRef.current}` reads a ref's `.current` at render time, which is `null` on the very first render before the DOM exists — `DeckPdfMenuItem`'s own `IntersectionObserver`-setup `useEffect` (Step 1) runs after the DOM is committed, by which point `panelRef.current` is populated (assuming `panelRef` itself doesn't change identity — a `useRef` object doesn't cause a re-render when `.current` is set, so `DeckPdfMenuItem` receiving `scrollRoot` as a prop value that starts `null` and never triggers a prop-change re-render is a real risk if `DeckPdfMenu` doesn't re-render after mount for some other reason); the safer approach is passing the `panelRef` object itself down as a prop (not `panelRef.current`), and having `DeckPdfMenuItem`'s effect read `scrollRoot.current` inside the effect body (which runs after mount, when `.current` is already populated) rather than depending on a prop value captured at an earlier render — flagged here explicitly since this is a common ref-timing mistake and the plan's intent is `root: scrollRoot.current` evaluated inside `DeckPdfMenuItem`'s effect, not passed as an already-dereferenced prop.

Keep the existing "scroll active entry into view" `useEffect` (keyed on `isOpen`/`currentPage`, calling `activeItemRef.current?.scrollIntoView(...)`) — it continues to work unchanged, since `activeItemRef.current` is still populated the same way (now via `DeckPdfMenuItem`'s callback ref instead of a direct `ref` on a `<button>`), and `scrollIntoView` is unaffected by CSS transforms.

**Step 4 — `components/DeckPdfViewer.js`: pass `pdf` down**
Add `pdf={pdfProxy}` to the existing `<DeckPdfMenu ... />` element, alongside its current `isOpen`, `numPages`, `currentPage`, `onNavigate`, `onClose` props. No other changes to this file.

## 9. Edge Cases

Menu opened before any thumbnails have had a chance to load (fast open right after the deck itself finishes loading): each entry shows its placeholder until its own `IntersectionObserver` fires and its `Thumbnail` mounts and renders — this is expected, not an error state; the placeholder styling (Step 2) exists specifically so this reads as "loading," not "broken."

Very long deck (100+ pages): only entries that have actually scrolled into view ever render a `Thumbnail`; entries far down the list never trigger their observer until scrolled to, keeping memory/render cost roughly proportional to how far the visitor has scrolled, not to total page count.

Visitor closes the panel while a thumbnail is mid-render: no special handling needed — the panel is translated off-screen via CSS, not unmounted, so any in-flight `Thumbnail` render simply continues (or finishes) off-screen and is already there, fully rendered, the next time the panel opens; `isVisible` state (Step 1) is per-entry and does not reset on close.

Deck with only 1-2 pages: the vertical list is short enough that most or all entries are visible immediately on open, so their `IntersectionObserver`s fire almost immediately — functionally equivalent to eager rendering in this case, which is fine, since the lazy mechanism's benefit is specifically for long decks and costs nothing extra for short ones.

`pdf` prop momentarily `null`/`undefined` before `<Document>`'s `onLoadSuccess` has fired: not reachable in practice, since `DeckPdfMenu` is only rendered by `DeckPdfViewer` inside a `{numPages && (...)}` guard, and `numPages` and `pdfProxy` are both set together in the same `onLoadSuccess` callback — by the time `DeckPdfMenu` (and therefore any `DeckPdfMenuItem`) exists at all, `pdf` is already a valid `PDFDocumentProxy`.

Rapid open/close toggling during the 0.3s slide transition: since the panel is a persistent, transform-driven element rather than being mounted/unmounted per toggle, rapidly toggling `isOpen` simply retargets the CSS transition mid-flight (standard browser behavior for interrupting a CSS transition with a new target value) — no additional debouncing or animation-state tracking is introduced.

## 10. Test Considerations

Manual checks:
- Open the menu; confirm it slides in from the left edge (not centered), with the backdrop fading in behind it.
- Confirm entries below the initially-visible area show placeholders, and that scrolling down causes their thumbnails to render in as they come into view.
- Confirm the active page's entry is highlighted and already scrolled into view the moment the panel finishes opening.
- Click a thumbnail (not just the number caption, if they're visually separate elements) and confirm it navigates to that page and the panel slides closed.
- Close via backdrop click, via the close (X) button, and via re-clicking the hamburger button; confirm all three close (slide out) correctly.
- Reopen the panel after closing; confirm it slides back in smoothly (no re-mount flash, no thumbnails that were already loaded needing to reload/re-render from placeholder).
- Test on a short deck (a handful of pages) and, if available, a longer one, to confirm the lazy-loading behavior scales appropriately and doesn't stall on open either way.
- Resize the browser window with the panel open and closed to confirm no interaction with the existing fit-to-viewport sizing logic or the panel's own left-edge positioning.
- Confirm a visitor who never opens the menu triggers no thumbnail rendering or `IntersectionObserver` setup at all (check via browser dev tools that no `Thumbnail`/canvas work happens for the menu until first opened).

No automated test suite exists for this app; no new automated tests are introduced by this plan.

## 11. Implementation Order

1. `components/DeckPdfMenuItem.js` — new file. Built first since it's a self-contained component whose prop contract is already fully specified; nothing else depends on its internals, only on that contract.
2. `styles/deck.css` — existing file, modified. Establishes the left-anchored panel positioning, slide transition, backdrop fade, and thumbnail/placeholder/caption layout before the JSX that relies on those classes is wired in, so the result is visually correct as soon as the component changes land.
3. `components/DeckPdfMenu.js` — existing file, modified. Adds mount-on-first-open, open/closed class toggling, and switches the list to render `DeckPdfMenuItem`; depends on both prior steps (the item component existing, and the CSS classes it and the panel reference already existing).
4. `components/DeckPdfViewer.js` — existing file, modified. Passes `pdfProxy` down as the new `pdf` prop; last, since it's a one-line addition that only matters once `DeckPdfMenu` actually consumes a `pdf` prop.
