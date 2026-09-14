# Portal Header Removal + PDF Bottom Nav

## 1. Goal

Remove the branded header (FLOWERS logo) from the client deck portal, and give PDF-type decks a way to navigate between pages one at a time via a bottom nav bar, instead of the current all-pages-stacked scroll view.

## 2. Current System Behaviour

`app/(portal)/layout.js` wraps every portal route (password gate, expired/locked states, and the deck viewer itself) in a shell containing a `<header>` with the FLOWERS logo (`next/image`, inverted in dark mode). This header has a fixed visual height reflected in the CSS variable `--deck-header-h` (80px), defined in `styles/deck.css`.

`.deck-embed` (used by `components/DeckEmbed.js` for Figma-type decks) sizes itself as `calc(100vh - var(--deck-header-h))`, positioned to sit directly below the header.

`components/DeckPdfViewer.js` (used for PDF-type decks) renders every page of the PDF at once, stacked vertically inside a scrollable `.deck-pdf-viewer` container (`overflow-y: auto`), using `react-pdf`'s `Document`/`Page` components. Page count comes from `onLoadSuccess`'s `numPages`. There is no per-page navigation control; the user scrolls through the whole document.

Figma-type decks (`DeckEmbed`) show a single iframe with no concept of "pages" from this app's perspective — Figma's internal navigation, if any, happens inside the embedded frame itself.

## 3. Desired Behaviour

The portal shell no longer renders any header or logo — deck content occupies the full viewport height with nothing above it. This applies to all portal states (password gate, expired, locked, unlocked/viewing).

Figma-type decks are otherwise unchanged, except that `.deck-embed` now fills the full `100vh` instead of `calc(100vh - header)`, since there is no header to subtract.

PDF-type decks switch from stacked-scroll to single-page display: only the current page is rendered at a time. A fixed bar at the bottom of the viewport shows a previous-page arrow, a "current / total" page counter (e.g. "3 / 12"), and a next-page arrow. Clicking the arrows changes which page is displayed. The previous arrow is disabled/inert on page 1; the next arrow is disabled/inert on the last page. No keyboard or swipe navigation, no custom page labels — pages are addressed purely by number, matching `react-pdf`'s 1-indexed `pageNumber`.

## 4. Architecture Considerations

The header lives in `app/(portal)/layout.js`, a server component with no state — removing it is a pure deletion, no logic changes needed there.

Single-page-mode navigation state (`currentPage`) must live in `DeckPdfViewer`, since it already owns `numPages` (set via `onLoadSuccess`) and is the component that decides which `<Page>` to render. The nav bar itself (`DeckPdfNav`) is a new, separate, stateless presentational component — consistent with the existing pattern where `DeckEmbed` and `DeckPdfViewer` are each self-contained per-content-type components rendered by `page.js`. `DeckPdfNav` receives `currentPage`, `numPages`, and a single change handler as props, and has no knowledge of `react-pdf` or the PDF document itself. This keeps page-loading/rendering concerns (`DeckPdfViewer`) separate from navigation-UI concerns (`DeckPdfNav`).

No new dependencies are required — this uses only what `react-pdf` (already installed) and React state already provide.

Removing `--deck-header-h` affects only `.deck-embed`'s height calculation; no other selector in `deck.css` references it, so the variable and its one consumer can be updated together without side effects elsewhere in the stylesheet.

## 5. Data Flow

No new data sources are introduced. `numPages` continues to come from `react-pdf`'s `onLoadSuccess` callback once the PDF (fetched through the existing same-origin `/portal/[token]/pdf-file` proxy route) finishes loading. `currentPage` is purely client-side UI state initialized to `1`, updated only by user interaction with `DeckPdfNav`'s arrows — it does not persist across reloads and is not sent to or read from Kirby.

`DeckPdfViewer` passes `currentPage` down to a single `<Page pageNumber={currentPage} />` (replacing the current `Array.from(...).map(...)` that renders all pages), and passes `currentPage`, `numPages`, and an update callback down to `DeckPdfNav`.

## 6. Component Responsibilities

### `app/(portal)/layout.js` (modified)
- Responsible for: the portal page shell (background, content wrapper) and page-level metadata (`robots: noindex`).
- NOT responsible for: any header, branding, or navigation UI.
- Props: `children` (existing).
- No internal state.

### `components/DeckPdfViewer.js` (modified)
- Responsible for: loading the PDF document via `react-pdf`, tracking which single page is currently displayed, rendering that one page, and rendering `DeckPdfNav` beneath/alongside it.
- NOT responsible for: the visual design of the nav controls themselves (delegated to `DeckPdfNav`), or fetching the PDF URL (receives it as a prop, as today).
- Props: `pdfUrl` (string, required) — unchanged from current.
- Internal state: `numPages` (number or null, existing), `currentPage` (number, new, initialized to `1`).

### `components/DeckPdfNav.js` (new)
- Responsible for: rendering the previous-arrow, "current / total" counter, and next-arrow; disabling either arrow at the respective boundary; invoking the provided callback with the target page number when an enabled arrow is clicked.
- NOT responsible for: knowing about PDF loading, `react-pdf`, or owning/persisting the current page value itself.
- Props: `currentPage` (number, required), `numPages` (number, required), `onNavigate` (function, required — called with the new page number).
- No internal state.

### `components/DeckEmbed.js` (unchanged)
- No changes in this plan; listed here only because its rendered height is affected by the CSS change in `deck.css`.

## 7. Files Affected

- `app/(portal)/layout.js` — remove the `<header>` block and the now-unused `Image` import.
- `styles/deck.css` — remove `--deck-header-h` variable and update `.deck-embed` to use `100vh`; add styles for the new `.deck-pdf-nav` bar; update `.deck-pdf-viewer` since it no longer needs to scroll a stacked list (single page at a time).
- `components/DeckPdfViewer.js` — replace multi-page stacked rendering with single-page rendering driven by new `currentPage` state; render `DeckPdfNav`.
- `components/DeckPdfNav.js` — new file, the bottom nav bar component.

No Kirby blueprint or query changes are needed — this plan is purely presentational/client-side and does not touch `deckQuery.js`, `deckAccess.js`, or any Kirby field.

## 8. Step-by-Step Implementation

**Step 1 — `app/(portal)/layout.js`**
Remove the `import Image from "next/image"` line and the entire `<header className="py-8 px-6">...</header>` block. The returned JSX becomes just the outer `div.portal-shell` wrapping `div.portal-content` and `{children}`, with no header sibling. Watch for: the `portal-shell`/`portal-content` div structure and existing Tailwind classes (`min-h-screen`, `pb-24`) should be left as-is — only the header is being deleted, not the wrapper structure. This is the first step because later steps (CSS) depend on the header no longer existing.

**Step 2 — `styles/deck.css`**
Delete the `--deck-header-h` custom property from `:root`. Change `.deck-embed`'s `height` from `calc(100vh - var(--deck-header-h))` to `100vh`. Add a new rule block for `.deck-pdf-nav`: a fixed-position bar pinned to the bottom of the viewport, flex row layout (prev arrow, counter text, next arrow), horizontally centered content, with basic padding — exact visual styling is intentionally minimal since detailed styling is deferred to a later plan, matching how `.deck-pdf-viewer` was styled functionally-only in the previous plan. Update `.deck-pdf-viewer`: since it now shows one page instead of a stacked scrollable list, remove `overflow-y: auto` and the multi-item `gap`, and ensure it reserves bottom space so the fixed nav bar does not overlap the rendered page (e.g. bottom padding roughly matching the nav bar's height). Watch for: keep this step's new class names (`deck-pdf-nav`) consistent with the BEM-ish naming already used (`deck-embed__frame`, `deck-embed__loader`) — use `deck-pdf-nav__prev`, `deck-pdf-nav__next`, `deck-pdf-nav__counter` for the inner elements.

**Step 3 — `components/DeckPdfNav.js` (new file)**
Create a client component (`"use client"`) exporting `DeckPdfNav({ currentPage, numPages, onNavigate })`. Render a `<div className="deck-pdf-nav">` containing: a `<button>` for previous, disabled when `currentPage <= 1`, calling `onNavigate(currentPage - 1)` when clicked; a `<span>` or `<p>` showing `${currentPage} / ${numPages}`; a `<button>` for next, disabled when `currentPage >= numPages`, calling `onNavigate(currentPage + 1)` when clicked. Use plain text or simple characters for the arrows (e.g. "‹" / "›") since icon components are not part of this plan's scope. Watch for: this component must not clamp or validate the page number beyond disabling the buttons — boundary correctness is enforced by disabling, not by clamping inside `onNavigate`, since `DeckPdfViewer` is the sole owner of `currentPage`.

**Step 4 — `components/DeckPdfViewer.js`**
Add `const [currentPage, setCurrentPage] = useState(1);` alongside the existing `numPages` state. Replace the `{numPages && Array.from(...).map(...)}` block, which currently renders every page, with a single conditional render: when `numPages` is set, render one `<Page pageNumber={currentPage} width={800} />` (same `width` as before), followed by `<DeckPdfNav currentPage={currentPage} numPages={numPages} onNavigate={setCurrentPage} />` rendered as a sibling of `<Document>` (outside it, so the nav bar is not subject to `react-pdf`'s document-loading states). Import `DeckPdfNav` from `../components/DeckPdfNav` (relative import, matching existing import style in this file). Watch for: `onNavigate={setCurrentPage}` works directly since `DeckPdfNav` already calls its callback with the target page number — no wrapper function needed. Also confirm `numPages` doesn't reset when `currentPage` changes; it should only be set once by `onLoadSuccess`.

## 9. Edge Cases

A single-page PDF (`numPages === 1`): both prev and next arrows should render disabled immediately; the counter shows "1 / 1". This falls out naturally from the boundary conditions in Step 3 and needs no special-casing.

PDF still loading (`numPages` is `null`): the nav bar should not render at all yet, since `numPages` is required to compute the counter and boundaries — keep the existing `{numPages && ...}` guard so `DeckPdfNav` only mounts once a page count is known, matching how the single `<Page>` is also gated.

Deck switched from PDF to Figma content type in Kirby after a client has the portal open in a stale tab: out of scope for this plan — existing `page.js` content-type branching on server-rendered data already governs which component mounts, no new failure mode introduced here.

Failed PDF load (network/proxy error): unchanged from current behaviour — `numPages` never gets set, so neither the single page nor the nav bar render; this is pre-existing behaviour from the prior plan, not newly introduced.

## 10. Test Considerations

Manual checks:
- Load a Figma-type deck: confirm no header/logo appears anywhere on the page, and the embed fills the entire viewport height with no gap at the top.
- Load a PDF-type deck: confirm no header/logo appears, only one page renders at a time, and the bottom nav bar is visible and does not overlap the rendered page content.
- Click next repeatedly through a multi-page PDF deck to the last page: confirm the next arrow becomes disabled and the counter matches `numPages`.
- Click previous back to page 1: confirm the previous arrow becomes disabled.
- Test a PDF deck with exactly one page: both arrows disabled on load, counter reads "1 / 1".
- Resize/check on a narrow mobile viewport: confirm the nav bar remains usable and does not get clipped off-screen (functional check only — visual polish deferred).
- Confirm the password gate and expired-link states still render correctly with no header (they are also inside `app/(portal)/layout.js`).

No automated test suite exists for this app currently; no new automated tests are introduced by this plan, consistent with the prior deck plan.

## 11. Implementation Order

1. `app/(portal)/layout.js` — existing file, modified. Removing the header first establishes the layout baseline the CSS step depends on.
2. `styles/deck.css` — existing file, modified. Updates height calculations now that the header is gone, and adds the nav bar's base styles before the component that uses those class names is built.
3. `components/DeckPdfNav.js` — new file. Built before `DeckPdfViewer` is updated to consume it, so the import in the next step resolves to a complete component.
4. `components/DeckPdfViewer.js` — existing file, modified. Wires up `currentPage` state, single-page rendering, and mounts `DeckPdfNav`; last because it depends on all three prior steps (no header to account for, nav styles present, `DeckPdfNav` importable).
