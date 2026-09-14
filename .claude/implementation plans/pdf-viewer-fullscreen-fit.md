# PDF Viewer Fullscreen Fit + Black Background

## 1. Goal

Make PDF-type decks fill the entire viewport with no vertical scrolling required to see a page, and change the PDF viewer's background from white to black, regardless of the visitor's site-wide light/dark theme setting.

## 2. Current System Behaviour

`components/DeckPdfViewer.js` renders the current page at a fixed `width={800}` via `react-pdf`'s `<Page>` component. On viewports narrower or shorter than what an 800px-wide page requires (and on tall pages, since PDF page height scales proportionally with a fixed width), the rendered page can exceed the visible viewport, requiring the user to scroll to see the whole page.

`.deck-pdf-viewer` (`styles/deck.css`) is a plain flex column with `padding: 1.5rem` and `padding-bottom: 5rem` (the latter reserving space for the fixed bottom nav bar added in a previous plan). It has no explicit background color, so it inherits whatever the page's default background is — effectively white in light mode (via `--color-bg` on `html`/`body` from `styles/style-guide.css`).

`.deck-pdf-nav` (added in the immediately preceding styling plan) already uses `background-color: var(--color-bg)` and `color: var(--color-text)`, which currently follow the site's light/dark theme toggle rather than being fixed to black.

`react-pdf`'s `<Page>` component accepts a `width` or `height` prop to control render size (not both simultaneously with independent values — providing one scales the page proportionally to its native aspect ratio; providing both would distort it). It also exposes an `onLoadSuccess` callback on `<Page>` itself (distinct from `<Document>`'s `onLoadSuccess`) that receives a `PDFPageProxy` object; `react-pdf` augments this object with `originalWidth`/`originalHeight` properties describing the page's native, unscaled dimensions.

## 3. Desired Behaviour

The currently displayed PDF page is scaled to the largest size that fits entirely within the browser's viewport (both width and height), preserving its native aspect ratio — no part of the page is cropped, and no scrolling is needed to see the whole page. If the page's aspect ratio does not exactly match the viewport's aspect ratio, the page is letterboxed (empty space on either the left/right or top/bottom), and that empty space is black, matching the new background.

The PDF viewer's background is always black, independent of the visitor's site-wide light/dark theme setting. The bottom nav bar continues to sit on top of this view, but no longer needs to reserve scroll space below the page, since the page itself is now sized to fit above it without requiring scroll.

Resizing the browser window (or rotating a mobile device) re-fits the current page to the new viewport dimensions.

## 4. Architecture Considerations

Fitting a fixed-aspect-ratio PDF page into a variable-size viewport requires knowing three numbers: the viewport's current width and height, and the PDF page's native aspect ratio. The viewport dimensions are read from `window.innerWidth`/`window.innerHeight` and updated on the window's `resize` event; there is no existing window-size hook in this codebase (checked — none found), so this plan tracks that state directly inside `DeckPdfViewer` with `useState`/`useEffect` rather than introducing a new shared hook, since the sizing logic is only needed in this one component and does not warrant a reusable abstraction yet.

The page's native aspect ratio is captured once, from `<Page>`'s own `onLoadSuccess` callback (`originalWidth`/`originalHeight`), the first time any page finishes loading. This assumes all pages in a given deck share the same dimensions, which is standard for a slide-deck-style PDF exported from a single source (e.g. Figma or a slide tool) — a per-page aspect ratio is not tracked, since re-measuring on every page change would cause a visible reflow/flash as the user navigates.

Given viewport width/height and the page's aspect ratio, the target render width is computed as the smaller of (a) the viewport width, and (b) the viewport height multiplied by the aspect ratio — this is the standard "contain" fit calculation and guarantees the scaled page never exceeds either dimension. That computed width is passed to `<Page width={...} />`; `react-pdf` scales height proportionally.

The black background is applied as a fixed color (not `var(--color-bg)`) specifically for the PDF viewer, since the user has stated it should not follow the theme toggle — this diverges intentionally from the nav bar's current theme-following behavior, which is a separate, already-shipped decision from the prior plan and is not being revisited here.

No new dependencies are introduced; `react-pdf`'s existing `<Page onLoadSuccess>` callback and browser-native resize events are sufficient.

## 5. Data Flow

No changes to where `pdfUrl` comes from or how the PDF is fetched. Within `DeckPdfViewer`, two new pieces of client-only state are introduced: the current viewport size (updated by a `resize` event listener attached in a `useEffect` on mount, removed on unmount) and the page's native aspect ratio (set once via `<Page>`'s `onLoadSuccess`, left unset — falling back to a sensible default render — until the first page finishes loading). These two values are combined on every render to compute the width passed to `<Page>`. Neither value is persisted, sent to Kirby, or shared with any other component.

## 6. Component Responsibilities

### `components/DeckPdfViewer.js` (modified)
- Responsible for: tracking viewport size and the loaded page's native aspect ratio, computing the fit-to-viewport render width, passing that width to `<Page>`, and rendering `DeckPdfNav` as before.
- NOT responsible for: the visual styling of the black background/letterboxing itself (defined in `deck.css`), or any nav bar behavior (unchanged, owned by `DeckPdfNav`).
- Props: unchanged — `pdfUrl` (string, required).
- Internal state: `numPages` (existing), `currentPage` (existing), plus new `viewportSize` (object `{ width, height }`, initialized from `window.innerWidth`/`window.innerHeight`) and `pageAspectRatio` (number or null, set once from the first `<Page>` load).

### `styles/deck.css` (modified)
- Responsible for: the black background on the PDF viewer container and correct centering/letterboxing layout so the scaled page sits centered within the viewport.
- NOT responsible for: any component logic.

## 7. Files Affected

- `components/DeckPdfViewer.js` — add viewport-size tracking, page-aspect-ratio capture, and fit-width calculation; pass computed width to `<Page>`; remove the temporary diagnostic `onLoadError` console logging added during troubleshooting only if the user confirms it's no longer needed (see Edge Cases).
- `styles/deck.css` — change `.deck-pdf-viewer` to a fixed-black-background, full-viewport, centered layout; remove the now-unnecessary scroll-reserving `padding-bottom` since the page will no longer need to scroll past the nav bar.

No changes to `DeckPdfNav.js`, `DeckEmbed.js`, `app/(portal)/layout.js`, or any Kirby/query files.

## 8. Step-by-Step Implementation

**Step 1 — `styles/deck.css`**
Change `.deck-pdf-viewer` from a padded flex column to a fixed-size, centered container: set `height: 100vh`, `width: 100vw`, `background-color: #000000` (hardcoded black, not `var(--color-bg)`, per the decision that this background does not follow the theme toggle), `display: flex`, `align-items: center`, `justify-content: center`, and remove the existing `padding`/`padding-bottom` declarations, since the fit-to-viewport calculation in Step 2 already accounts for the nav bar's space by treating the full viewport height as available and the nav bar renders on top of/overlapping the letterboxed black area rather than requiring reserved scroll space. Watch for: `overflow` should remain unset/`hidden` here (not `auto`) since the explicit goal is no scrolling — if the computed page size in Step 2 is ever slightly miscalculated, `hidden` prevents a scrollbar from appearing rather than masking the bug with scroll.

**Step 2 — `components/DeckPdfViewer.js`**
Add a new `useState` for `viewportSize`, initialized lazily from `window.innerWidth`/`window.innerHeight` (guarding for server-side rendering, since `window` is unavailable during any server render pass — though this component is already client-only via its dynamic `{ ssr: false }` import in `page.js`, so this is a safety measure rather than an expected real-world case). Add a `useEffect` that attaches a `resize` listener updating `viewportSize` on change, and removes the listener on unmount. Add a new `useState` for `pageAspectRatio` (initialized to `null`). Add an `onLoadSuccess` handler on the `<Page>` component (distinct from `<Document>`'s existing `onLoadSuccess`) that, only if `pageAspectRatio` is still `null`, computes and stores `originalWidth / originalHeight` from the loaded page. Compute a `fitWidth` value on every render: if `pageAspectRatio` is not yet known, fall back to the previous fixed `800`; otherwise compute `Math.min(viewportSize.width, viewportSize.height * pageAspectRatio)`. Pass `width={fitWidth}` to `<Page>` instead of the current hardcoded `width={800}`. Watch for: `<Page>`'s two `onLoadSuccess` handlers (one on `<Document>` for `numPages`, one on `<Page>` for aspect ratio) are separate props on separate components and must not be confused or merged — `<Document>`'s fires once when the whole PDF is parsed, `<Page>`'s fires each time an individual page finishes rendering, but the aspect-ratio state update should be skipped on subsequent page loads via the `pageAspectRatio === null` guard to avoid unnecessary re-renders once it's known.

## 9. Edge Cases

First page load, before `pageAspectRatio` is known: the page renders briefly at the fallback `800`-wide size, which may not fit the viewport until `<Page>`'s `onLoadSuccess` fires and triggers a re-render with the correct fit width — this causes a brief resize flash on initial load only, not on subsequent page navigation, since the aspect ratio is cached after the first successful load.

Deck with pages of inconsistent dimensions: out of scope — this plan assumes uniform page dimensions across the deck, consistent with how decks are typically exported; if a future deck has mixed page sizes, later pages would render at a size computed from the first page's aspect ratio, which may not perfectly fit — not handled here.

Very narrow or very short viewports (e.g. a small phone in landscape with limited height): the `Math.min(...)` fit calculation already handles this correctly by constraining on whichever dimension is smaller, so no special-casing is needed.

Window resized while a page is displayed: handled by the `resize` listener recomputing `viewportSize`, which flows into the same `fitWidth` calculation on next render — no separate resize-specific logic needed.

The temporary `onLoadError` console logging added to `<Document>` during the earlier CORS/loading troubleshooting session remains in the file; this plan does not remove it, since it is unrelated to fit/background and still provides useful diagnostic value if loading ever fails again — flagged here only for awareness, not as an action item.

## 10. Test Considerations

Manual checks:
- Load a PDF deck on a standard desktop viewport: confirm the current page is fully visible with no scrollbar, and the background around/behind it is black.
- Resize the browser window (both narrower and shorter): confirm the page rescales to keep fitting entirely on screen with no scrolling, and any letterboxed space stays black.
- Load on a narrow mobile viewport and rotate between portrait and landscape: confirm the page continues to fit without scrolling in both orientations.
- Navigate between pages using the bottom nav: confirm each page displays fully within the viewport (no flash/resize beyond the expected one-time flash on initial load).
- Confirm the bottom nav bar remains visible and usable, and does not get visually lost against the new black background (its own background/color were already made theme-consistent in the prior plan, so no change expected here, but worth a visual check).
- Toggle the site's light/dark theme while viewing a PDF deck: confirm the PDF viewer's background stays black in both cases (only the nav bar, if it still follows theme, should visually change).

No automated test suite exists for this app; no new automated tests are introduced by this plan.

## 11. Implementation Order

1. `styles/deck.css` — existing file, modified. Establishes the full-viewport black container first, since it defines the layout space the component's fit calculation in the next step needs to size against.
2. `components/DeckPdfViewer.js` — existing file, modified. Adds the viewport-tracking and aspect-ratio-based fit-width logic, depending on the container sizing already being correct from Step 1.
