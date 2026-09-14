# PDF Viewer Fit-to-Viewport (No Empty Space, Correct Scale)

## 1. Goal

Fix two related bugs in the portal's PDF deck viewer: the rendered page is consistently oversized relative to the viewport (roughly 15% too large), and a large block of empty space appears beneath the page. Both stem from the same root cause — the PDF page is never scaled to fit the available screen space.

## 2. Current System Behaviour

`components/DeckPdfViewer.js` renders the current page via react-pdf's `<Page pageNumber={currentPage} />` with no `width` or `height` prop. Without either prop, react-pdf renders the page at its native, unscaled size (1 PDF point = 1 CSS pixel), which does not correspond to any particular viewport dimension and is reliably larger than the space actually available on screen.

`.deck-pdf-viewer` in `styles/deck.css` sets only `background-color: #000000`. It has no explicit width, height, or layout rules, so it behaves as a plain block in normal document flow, sized to whatever content (the oversized canvas) it contains — it does not constrain or center the page. Because the container isn't viewport-sized or centered, the oversized page combined with the document's normal flow produces a large empty gap below the visible page content.

`components/DeckPdfNav.js` renders a `position: fixed` bar pinned to the bottom of the viewport (`.deck-pdf-nav` in `deck.css`), floating on top of whatever is beneath it. Its rendered height depends on padding and icon/font sizing already defined in `deck.css` and is not currently read by any other component.

An earlier plan, `pdf-viewer-fullscreen-fit.md`, described this exact fix (viewport tracking, aspect-ratio capture, contain-fit width) but was never implemented — none of its described state or CSS exists in the current files. This plan supersedes it, with one behavioural difference: the nav bar's height is reserved out of the fit calculation (see Architecture Considerations) rather than treated as a floating overlay.

## 3. Desired Behaviour

The currently displayed PDF page is scaled to the largest size that fits entirely within the space above the bottom nav bar, preserving its native aspect ratio. No part of the page is cropped, and no scrolling is required to see the whole page. If the page's aspect ratio doesn't exactly match the available space's aspect ratio, the page is letterboxed (empty space on the sides or top/bottom), and that empty space is solid black.

The PDF page never renders underneath or behind the nav bar — the nav bar's actual rendered height is subtracted from the available viewport height before the page is fit, so the two never overlap.

The viewer's background is always black, independent of the site's light/dark theme toggle.

Resizing the browser window re-fits the current page to the new available space. Navigating between pages does not cause a visible resize flash (the aspect ratio, once known, is reused for every page).

## 4. Architecture Considerations

Fitting a fixed-aspect-ratio page into a variable-size area requires three numbers: available width, available height, and the page's native aspect ratio.

**Viewport size**: read from `window.innerWidth`/`window.innerHeight`, tracked in `DeckPdfViewer` state and updated via a `resize` event listener attached in a `useEffect`. This matches the existing codebase's absence of a shared window-size hook — the logic is only needed here and doesn't warrant a reusable abstraction yet.

**Nav bar height**: unlike the earlier (unimplemented) plan, which let the nav bar float as an overlay on top of the letterboxed area with no reserved space, this plan reserves the nav bar's real height so the page content is never visually underneath it. The nav's rendered height varies with padding/font/icon sizing already defined in `deck.css` and can change at CSS breakpoints, so it is measured directly via a `ref` on the `.deck-pdf-nav` element (`offsetHeight`) rather than hardcoded as a constant — this stays correct automatically if nav styling changes later. `DeckPdfNav` forwards a ref to its root `div` (via `React.forwardRef`) so `DeckPdfViewer` can read it.

**Available height** = `viewportHeight - navHeight`. Re-read on the same `resize` event that updates viewport size, since a breakpoint change could alter nav height without necessarily changing viewport dimensions in a way that's otherwise detected — re-measuring on every resize is cheap and avoids stale values.

**Page aspect ratio**: captured once from `<Page>`'s own `onLoadSuccess` callback (distinct from `<Document>`'s `onLoadSuccess`), which receives a `PDFPageProxy` augmented by react-pdf with `originalWidth`/`originalHeight` (native, unscaled dimensions). Captured only the first time any page loads (guarded by a `pageAspectRatio === null` check) and reused for all subsequent pages. This assumes uniform page dimensions across a deck, consistent with how slide-deck PDFs are typically exported from a single source, and avoids a reflow/flash when navigating between pages.

**Fit calculation**: standard "contain" fit — `fitWidth = Math.min(availableWidth, availableHeight * pageAspectRatio)`. This is passed to `<Page width={fitWidth} />`; react-pdf scales height proportionally, so only one dimension needs to be computed.

**Background color**: hardcoded `#000000` on `.deck-pdf-viewer`, not `var(--color-bg)`, since it must not follow the site's theme toggle — consistent with the original (unimplemented) plan's decision, not being revisited here.

No new dependencies are introduced. `React.forwardRef`, `<Page onLoadSuccess>`, and native `resize` events are sufficient.

## 5. Data Flow

No changes to where `pdfUrl` comes from or how the PDF is fetched. Within `DeckPdfViewer`, three new pieces of client-only state/refs are introduced:

- `viewportSize` (`{ width, height }`) — updated by a `resize` listener.
- `navHeight` (number) — read from a ref on `DeckPdfNav`'s root element, re-read on the same `resize` event and once after `DeckPdfNav` first mounts (since it only renders once `numPages` is known).
- `pageAspectRatio` (number or `null`) — set once via `<Page>`'s `onLoadSuccess`.

These three values are combined on every render to compute `fitWidth`, which flows one-way into `<Page width={fitWidth} />`. None of this state is persisted, sent to Kirby, or shared outside this component.

## 6. Component Responsibilities

### `components/DeckPdfViewer.js` (modified)
- Responsible for: tracking viewport size, measuring the nav bar's rendered height, capturing the loaded page's native aspect ratio, computing the fit-to-available-space render width, passing that width to `<Page>`, and rendering `DeckPdfNav` with a ref attached.
- NOT responsible for: the visual styling of the black background/centering/letterboxing (defined in `deck.css`), or any nav bar interaction behavior (owned by `DeckPdfNav`, unchanged).
- Props: unchanged — `pdfUrl` (string, required).
- Internal state: `pdfProxy`, `numPages`, `currentPage` (all existing, unchanged) plus new `viewportSize` (`{ width: number, height: number }`, initialized from `window.innerWidth`/`window.innerHeight` guarded for SSR safety even though this component is already client-only) and `pageAspectRatio` (`number | null`, initialized `null`).
- Internal refs: new `navRef` (attached to `DeckPdfNav`'s forwarded ref), used to read `offsetHeight` — not stored as a ref value itself but read into a new `navHeight` state (`number`, initialized `0`) so changes trigger a re-render of the fit calculation.

### `components/DeckPdfNav.js` (modified)
- Responsible for: rendering the prev/next/counter bar as before, and exposing its root `div` via a forwarded ref so its rendered height can be measured externally.
- NOT responsible for: computing or knowing its own height's effect on PDF sizing — it has no awareness of `DeckPdfViewer`'s fit logic.
- Props: unchanged (`currentPage`, `numPages`, `onNavigate`), wrapped in `React.forwardRef` to accept a `ref`.
- Internal state: none (unchanged).

### `styles/deck.css` (modified)
- Responsible for: `.deck-pdf-viewer` becoming a full-viewport, centered, hardcoded-black-background container with `overflow: hidden`.
- NOT responsible for: any component logic or the fit-width calculation itself (purely visual/layout).

## 7. Files Affected

- `components/DeckPdfViewer.js` — add viewport-size tracking, nav-height measurement, page-aspect-ratio capture, and fit-width calculation; pass computed width to `<Page>`; attach `navRef` to `<DeckPdfNav>`.
- `components/DeckPdfNav.js` — wrap in `React.forwardRef` so its root element can be measured from the parent.
- `styles/deck.css` — change `.deck-pdf-viewer` to a fixed-black-background, full-viewport, centered layout with `overflow: hidden`; remove any now-unnecessary scroll-related declarations.

No changes to `DeckEmbed.js`, `app/(portal)/layout.js`, `app/(portal)/portal/[token]/page.js`, or any Kirby/query files.

## 8. Step-by-Step Implementation

**Step 1 — `styles/deck.css`: full-viewport black container**
Change `.deck-pdf-viewer` to: `width: 100vw`, `height: 100vh`, `background-color: #000000` (hardcoded, not `var(--color-bg)`), `display: flex`, `align-items: center`, `justify-content: center`, `overflow: hidden`. Remove any existing padding declarations on this selector. `overflow: hidden` is deliberate: if the fit calculation in Step 3 is ever slightly wrong, this prevents a scrollbar from appearing and masking the bug — a visible clipping/overflow issue is easier to notice and debug than a silent scroll. `.deck-pdf-nav` itself is unchanged by this step (still `position: fixed`, unaffected by the parent's new `overflow: hidden` since fixed positioning escapes the containing block for overflow purposes... note: verify this in practice, since `overflow: hidden` on an ancestor can, in some browser/stacking-context configurations, still affect fixed-position descendants if a `transform`, `filter`, or `will-change` is present anywhere in the ancestor chain — none are introduced by this plan, so standard fixed-position escape behavior should hold, but this is worth a visual check in Step 10).

**Step 2 — `components/DeckPdfNav.js`: forward a ref**
Wrap the component body in `React.forwardRef((props, ref) => { ... })`, destructuring `{ currentPage, numPages, onNavigate }` from `props` as before, and attach `ref` to the root `<div className="deck-pdf-nav">`. Update the `export default` line accordingly (the forwardRef-wrapped component is what gets exported). No changes to the JSX structure, class names, or button behavior inside.

**Step 3 — `components/DeckPdfViewer.js`: viewport and nav-height tracking**
Add a module-level helper (or inline lazy initializer) that returns `{ width: window.innerWidth, height: window.innerHeight }`, guarded to return a zeroed fallback when `window` is undefined (SSR safety net; this component is already dynamically imported with `ssr: false` per `page.js`, so this is defensive rather than an expected runtime path). Add `viewportSize` state initialized from this helper. Add a `useEffect` that attaches a `resize` listener updating `viewportSize`, and removes it on unmount.

Add a `navRef` via `useRef(null)`, passed as the `ref` prop to `<DeckPdfNav>` (now that Step 2 makes it ref-forwarding). Add `navHeight` state (initialized `0`). Add a `useEffect` that reads `navRef.current?.offsetHeight` and sets `navHeight` — this effect should re-run whenever `numPages` changes (since `DeckPdfNav` only mounts once `numPages` is truthy, so its ref is `null` until then) and should also be re-read inside the existing/new `resize` handler, so a breakpoint-driven change in nav height during a resize is picked up. Simplest implementation: call the same "measure nav height" function both inside the `resize` listener and in a `useEffect` keyed on `numPages`.

**Step 4 — `components/DeckPdfViewer.js`: aspect ratio capture and fit-width calculation**
Add `pageAspectRatio` state initialized to `null`. Add an `onLoadSuccess` handler on `<Page>` (distinct from `<Document>`'s existing `onLoadSuccess`, which continues to only set `pdfProxy`/`numPages` as today) that, only when `pageAspectRatio === null`, computes and stores `page.originalWidth / page.originalHeight`. Compute `availableHeight = Math.max(viewportSize.height - navHeight, 0)` and `fitWidth`: if `pageAspectRatio` is not yet known, fall back to `viewportSize.width` (so the very first paint before the first page loads is viewport-width, not a fixed guess like the old plan's `800`, since there is no longer a legacy fixed-width baseline to fall back to); otherwise `Math.min(viewportSize.width, availableHeight * pageAspectRatio)`. Pass `width={fitWidth}` to `<Page>`.

Watch for: the two `onLoadSuccess` handlers (on `<Document>` and on `<Page>`) are separate props on separate components — do not merge them. `<Document>`'s fires once when the whole PDF is parsed; `<Page>`'s fires each time an individual page finishes rendering, but the aspect-ratio state update is skipped after the first successful capture via the `pageAspectRatio === null` guard.

## 9. Edge Cases

First page load, before `pageAspectRatio` is known: the page briefly renders at `viewportSize.width`-wide (full width, height determined by the PDF's own aspect ratio until corrected), which may not fit vertically until `<Page>`'s `onLoadSuccess` fires and triggers a re-render with the correct fit width. This is a one-time flash on initial load only, not on subsequent page navigation.

Nav bar not yet mounted (`numPages` still `null`): `navHeight` stays at its initial `0`, so `availableHeight` equals the full viewport height until the nav mounts and its height is measured — acceptable, since no page is rendered yet either (rendering is gated on `numPages` being truthy in the existing JSX).

Deck with pages of inconsistent dimensions: out of scope, per the confirmed assumption that all pages in a deck share dimensions (standard for slide-deck exports). If a future deck has mixed page sizes, later pages render at a size computed from the first page's aspect ratio, which may not perfectly fit.

Very narrow or very short viewports: the `Math.min(...)` fit calculation already constrains on whichever dimension is smaller, so no special-casing is needed.

Window resized while a page is displayed: handled by the `resize` listener recomputing both `viewportSize` and `navHeight`, flowing into the same `fitWidth` calculation on next render.

Nav bar height changing at a CSS breakpoint without a corresponding `resize` event firing (e.g. a print-media or container-query-driven change): not handled — the plan relies on `resize` firing for any layout change that matters, consistent with the confirmed decision to use a plain `resize` listener rather than `ResizeObserver`.

## 10. Test Considerations

Manual checks:
- Load a PDF deck on a standard desktop viewport: confirm the current page is fully visible with no scrollbar, background around it is black, and the page does not overlap the nav bar.
- Resize the browser window (both narrower and shorter): confirm the page rescales to keep fitting entirely above the nav bar, with no scrolling, and letterboxed space stays black.
- Load on a narrow mobile viewport and rotate between portrait and landscape: confirm the page continues to fit without scrolling and without sitting under the nav bar in both orientations.
- Navigate between pages using the bottom nav: confirm each page displays fully within the available space (no flash/resize beyond the expected one-time flash on initial load).
- Confirm the bottom nav bar remains visible, usable, and never visually overlapped by the PDF page.
- Toggle the site's light/dark theme while viewing a PDF deck: confirm the PDF viewer's background stays black in both cases.
- Confirm `overflow: hidden` on `.deck-pdf-viewer` doesn't clip the fixed-position nav bar (see Step 1 caveat).

No automated test suite exists for this app; no new automated tests are introduced by this plan.

## 11. Implementation Order

1. `styles/deck.css` — existing file, modified. Establishes the full-viewport black container first, since it defines the layout space the component's fit calculation needs to size against.
2. `components/DeckPdfNav.js` — existing file, modified. Adds ref-forwarding so its height can be measured; done before `DeckPdfViewer` is updated since that component's next step depends on the ref existing.
3. `components/DeckPdfViewer.js` — existing file, modified. Adds viewport tracking, nav-height measurement, and aspect-ratio-based fit-width logic; last, since it depends on both the container sizing from Step 1 and the ref-forwarding from Step 2.
