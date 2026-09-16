# Deck Keyboard Navigation

## 1. Goal

Currently the PDF deck viewer in the client portal can only be paged using the on-screen prev/next buttons or the page-list menu. This plan adds keyboard support so a viewer can move between pages using the Spacebar and Arrow keys, matching the paging conventions of standard slide-deck viewers.

## 2. Current System Behaviour

`DeckPdfViewer` (next/components/DeckPdfViewer.js) owns `currentPage` state and renders the active PDF page via `react-pdf`. Paging happens exclusively through `DeckPdfNav` (prev/next buttons calling `onNavigate(currentPage ± 1)`) and `DeckPdfMenu` (a slideout list of all pages; selecting an item calls `onNavigate(page)` then closes the menu). There is no keyboard event handling anywhere in the portal deck view. The menu overlay (`DeckPdfMenu`) has no internal keyboard handling of its own — its page items are plain clickable list entries in a scrollable container, so there's no competing key-handling logic to worry about there.

`onNavigate` in both children is simply `setCurrentPage`, passed down from `DeckPdfViewer`. No bounds-clamping currently happens in `setCurrentPage` itself — the nav buttons rely on `disabled` state to prevent out-of-range calls, but `DeckPdfMenu` only ever passes valid page numbers.

## 3. Desired Behaviour

While viewing a deck (PDF content type), pressing:
- **ArrowRight**, **ArrowDown**, or **Spacebar** advances to the next page.
- **ArrowLeft** or **ArrowUp** moves to the previous page.

Navigation is clamped to `[1, numPages]` — pressing next on the last page or prev on the first page does nothing (no wraparound, no error).

Keyboard navigation works identically whether or not the page menu (hamburger slideout) is open, per user decision — it is not disabled or altered by menu state.

Spacebar must not trigger its default browser behaviour (page scroll, or activating a focused button) when used for navigation.

This behaviour applies only to the PDF deck view. The Figma embed view (`DeckEmbed`) and non-ready/expired/locked states are out of scope and must not be affected.

## 4. Architecture Considerations

The listener is extracted into a dedicated hook, `useDeckKeyboardNav`, rather than inlined into `DeckPdfViewer`, per user decision. This keeps `DeckPdfViewer.js` focused on layout/rendering concerns and isolates the key-mapping logic so it can be reasoned about (and later reused or unit-tested) independently.

The hook takes the current page, page count, and a navigate callback, and internally computes clamped next/prev values before calling the callback — this keeps `DeckPdfViewer` from needing its own clamping logic and keeps a single source of truth for "what does next/prev mean" (shared conceptually with `DeckPdfNav`'s disabled-button logic, though not literally shared code, since `DeckPdfNav` already gates via `disabled` and this hook must independently gate since keydown has no `disabled` attribute to rely on).

The listener attaches to `window` (via `document`/`window.addEventListener("keydown", ...)`) rather than a specific DOM node, since the deck view has no natural single focusable container and the user should be able to page regardless of which element currently has focus (matching the "works everywhere, including with menu open" decision).

No new dependencies are introduced.

## 5. Data Flow

`DeckPdfViewer` holds `currentPage` and `numPages` in state, as it already does. It calls `useDeckKeyboardNav({ currentPage, numPages, onNavigate: setCurrentPage })`. The hook registers a `keydown` listener on `window` on mount (and re-registers/cleans up whenever `currentPage` or `numPages` change, since the handler closes over them). On a matching keydown, the hook computes the clamped target page and calls `onNavigate(targetPage)`, which is `setCurrentPage`, triggering the same re-render path already used by the button and menu navigation. No new data enters or leaves the component tree; this only adds a second trigger path into the existing `setCurrentPage` call.

## 6. Component Responsibilities

### `useDeckKeyboardNav` (new hook)
**Responsible for:**
- Registering and cleaning up a single `keydown` listener on `window`.
- Mapping ArrowRight / ArrowDown / Space → next page, ArrowLeft / ArrowUp → previous page.
- Clamping the computed target page to `[1, numPages]` and only calling `onNavigate` when the target differs from `currentPage` (avoids redundant state updates on the boundary pages).
- Calling `event.preventDefault()` for the keys it handles, to stop Space from scrolling the page or re-triggering a focused button's click.

**Not responsible for:**
- Rendering anything (it returns nothing / `undefined`).
- Deciding whether the deck view is even mounted — that's implicit in when `DeckPdfViewer` calls the hook.
- Menu open/close state — it does not read or care about `menuOpen`.

**Parameters (not React props, since it's a hook, but its argument object):**
- `currentPage` (number, required) — the page currently displayed.
- `numPages` (number, required) — total page count, used for clamping.
- `onNavigate` (function, required) — callback invoked with the new page number.
- `enabled` (boolean, optional, default `true`) — kept as an escape hatch for future use (e.g. if a future requirement needs to disable it conditionally), but `DeckPdfViewer` will not pass `false` for it per the current decision to keep it always active.

**Internal state owned:** none — it is a pure side-effect hook with no state of its own.

### `DeckPdfViewer` (modified)
**Responsible for:** as before, plus calling `useDeckKeyboardNav` with its existing `currentPage`, `numPages`, and `setCurrentPage`.

**Not responsible for:** any key-mapping logic — that stays inside the hook.

No prop or state shape changes to `DeckPdfViewer` itself; `numPages` is only passed to the hook once it is non-null (the hook call is placed after the `numPages` check, or guarded internally — see Step-by-Step).

### `DeckPdfNav`, `DeckPdfMenu`
No changes. They continue to call the same `onNavigate` prop they already receive.

## 7. Files Affected

- `next/components/useDeckKeyboardNav.js` — new file; contains the hook.
- `next/components/DeckPdfViewer.js` — modified; imports and calls the new hook.

No other files require changes. `DeckPdfNav.js`, `DeckPdfMenu.js`, `DeckPdfMenuItem.js`, and the portal `page.js` are unaffected.

## 8. Step-by-Step Implementation

**Step 1 — Create `next/components/useDeckKeyboardNav.js`**
Define and export a default function `useDeckKeyboardNav({ currentPage, numPages, onNavigate, enabled = true })`.
Inside, use a `useEffect` with dependency array `[currentPage, numPages, onNavigate, enabled]`.
Inside the effect:
- If `!enabled` or `numPages` is falsy, return early without attaching a listener (guards against being called before `numPages` is known, and honors the optional `enabled` escape hatch).
- Define a `handleKeyDown` function that switches on `event.key`:
  - `"ArrowRight"`, `"ArrowDown"`, `" "` (the value for Spacebar) → compute `next = Math.min(currentPage + 1, numPages)`.
  - `"ArrowLeft"`, `"ArrowUp"` → compute `next = Math.max(currentPage - 1, 1)`.
  - Any other key → return without doing anything (do not preventDefault on unhandled keys).
  - For handled keys: call `event.preventDefault()` first (before computing/calling navigate), then if `next !== currentPage`, call `onNavigate(next)`.
- Attach with `window.addEventListener("keydown", handleKeyDown)`.
- Return a cleanup function calling `window.removeEventListener("keydown", handleKeyDown)`.

Gotcha: `event.key` for the spacebar is `" "` in modern browsers, but some older engines report `"Spacebar"`. Check for both to be safe.

Gotcha: because the effect depends on `currentPage`, it re-registers the listener on every page change. This is intentional and necessary — the closure needs the current value to compute next/prev correctly — and is cheap (a single addEventListener/removeEventListener pair per page change), so no memoization is needed.

**Step 2 — Wire the hook into `DeckPdfViewer.js`**
Add the import: `import useDeckKeyboardNav from "./useDeckKeyboardNav";` near the other local imports.
Call the hook inside the component body, after the existing `useEffect`/`useRef` declarations and before the `return` statement:
`useDeckKeyboardNav({ currentPage, numPages, onNavigate: setCurrentPage });`
Do not gate this call behind `numPages &&` in JSX-conditional style — hooks must be called unconditionally on every render, so instead rely on the hook's own internal `numPages` falsy-check (Step 1) to no-op until the PDF has loaded.

Gotcha: `DeckPdfViewer` is the same component tree used regardless of content type only when `contentType === "pdf"` (see `page.js`), so this hook only ever mounts for PDF decks — no extra guarding needed for the Figma case since `DeckPdfViewer` itself is never rendered there.

**Step 3 — Manual verification**
No automated test harness currently covers this component (see Test Considerations). Verify manually per Section 10.

## 9. Edge Cases

- **Single-page deck (`numPages === 1`):** both next and prev computations clamp to `1`, so `next === currentPage` and `onNavigate` is never called — no-op, correct.
- **Rapid key repeat (holding a key down):** each keydown event is handled independently and clamps against the *current* `currentPage` closure value at the time the listener was attached; because the effect re-registers on every `currentPage` change, each subsequent repeat event is handled by a listener with the updated closure, so rapid repeats page through correctly one page at a time rather than skipping.
- **Menu open while paging via keyboard:** per the decision to keep navigation active everywhere, pressing arrow/space while the menu is open will change `currentPage`, which will also scroll the menu's active item into view (existing `DeckPdfMenu` effect on `[isOpen, currentPage]`). This is expected and consistent with clicking a nav button while the menu happens to be open (already possible today via the prev/next buttons, which remain visible/clickable under the menu backdrop... actually the backdrop covers them — but keyboard access still works since it's not blocked by the overlay). No handling change needed, just noting it's intentional.
- **PDF still loading (`numPages` is `null`):** hook no-ops per the internal guard in Step 1; no listener is attached until `numPages` becomes truthy, so no crash from computing against `null`.
- **Password-gated or expired/not-ready states:** `DeckPdfViewer` is never rendered in these states (see `page.js`), so the hook never mounts and no listener is ever attached — no risk of intercepting keystrokes on the password field.
- **Focus on a button (e.g. the hamburger toggle) when Space is pressed:** without `preventDefault`, the browser would both fire the native "activate focused button" behavior and page the deck. `preventDefault()` is called for every handled key before any other logic, which suppresses the default button-activation/scroll behavior consistently.

## 10. Test Considerations

No existing automated test suite covers `DeckPdfViewer` or its siblings (none found under `next/components` during file analysis). This change should be validated manually:

- Open a PDF deck in the portal, confirm ArrowRight, ArrowDown, and Space each advance one page.
- Confirm ArrowLeft and ArrowUp each go back one page.
- Confirm no action occurs when pressing next on the last page or prev on the first page (counter in `DeckPdfNav` should not go out of `[1, numPages]`).
- Confirm pressing Space does not scroll the browser viewport.
- Open the hamburger menu, confirm keyboard paging still works and the menu's active item scroll-into-view still tracks the page change.
- Confirm keyboard paging has no effect on the Figma embed view or on the password-gate/expired screens.
- Tab-focus the prev/next buttons and press Space — confirm it pages the deck once (not twice, and without the button's own click also firing from default Space behavior).

If an automated testing setup is introduced to this codebase in the future, the hook is written as a pure side-effect function taking primitive/callback args specifically so it can be tested in isolation (e.g. with `@testing-library/react`'s `renderHook` plus simulated `keydown` events) without needing to mount the full PDF viewer.

## 11. Implementation Order

1. `next/components/useDeckKeyboardNav.js` — new file; created first since `DeckPdfViewer.js` will import it.
2. `next/components/DeckPdfViewer.js` — existing file modified second to import and call the new hook, once it exists.
