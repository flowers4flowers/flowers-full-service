# Portal Styling and Password Gate Branding

## 1. Goal

Bring the deck portal's PDF navigation controls in line with the rest of the website's visual language, guarantee those controls stay legible regardless of what color the underlying PDF page content is, and restore the FLOWERS logo specifically to the password gate screen after it was removed site-wide from the shared portal layout in the previous plan.

## 2. Current System Behaviour

`components/DeckPdfNav.js` renders a previous/next control pair using plain text characters ("‹" / "›") and a "current / total" counter, styled only with the functional, unstyled classes added in the last plan (`deck-pdf-nav`, `deck-pdf-nav__prev`, `deck-pdf-nav__next`) — no color, background, or typography treatment beyond disabled-state opacity.

`styles/deck.css` currently defines `.deck-pdf-nav` as a fixed, transparent, bottom-pinned flex row with no background — it renders directly over whatever the current PDF page looks like, so if a page is dark-colored, dark text/icons in the nav would disappear, and vice versa on a light page.

The rest of the site (`components/MainNav.js`, `styles/nav.css`) establishes a consistent visual language: `font-secondary`/`font-primary` type, `black`/`cream` as the two theme colors (via Tailwind's `darkMode: 'class'` and `dark:` variants), a `bg-cream dark:bg-black` solid header bar, `hover:opacity-50 transition-opacity duration-300` on interactive elements, and existing reusable arrow icon components (`LeftArrow`, `RightArrow`, `UpArrow` in `components/Icons.js`) that accept a `color` prop and are used elsewhere instead of text glyphs.

`app/(portal)/layout.js` currently renders no header at all (removed in the previous plan), so no portal screen — including the password gate — shows the FLOWERS logo. `app/(portal)/portal/[token]/PasswordGate.js` already uses site-consistent styling for its input and submit button (`border-black dark:border-cream`, `font-primary font-bold uppercase`), but has no branding element of its own.

## 3. Desired Behaviour

The PDF nav bar sits on a solid, theme-colored background bar (matching the site's existing `bg-cream dark:bg-black` treatment) spanning the bottom of the viewport, so it is never rendered directly against unpredictable PDF page content — its contrast is guaranteed by covering that content with a solid bar, not by reacting to it. Its prev/next controls use the site's existing `LeftArrow`/`RightArrow` icon components (colored to match the bar's theme, with the disabled-state boundary behavior unchanged from the previous plan) instead of text characters. The page counter text uses the site's established type treatment (`font-secondary`).

The password gate screen (and only the password gate screen) shows the FLOWERS logo, in the same size and position it had when it lived in the old shared portal header, with the same dark-mode invert behavior. No other portal state (expired, locked-without-title, or the deck viewer itself) gains a header or logo.

## 4. Architecture Considerations

The nav bar's contrast requirement is solved structurally (an opaque background bar) rather than by trying to compute or react to the color of the PDF content behind it — this is simpler, matches how `MainNav` already solves the same "always legible" problem for the main site header, and avoids any need to sample or invert colors dynamically from `react-pdf`'s rendered canvas.

Reusing `LeftArrow`/`RightArrow`/font conventions instead of introducing new icons or type styles keeps the deck portal visually and structurally consistent with the rest of the codebase, and avoids duplicating what already exists in `components/Icons.js`.

The FLOWERS logo is added directly inside `PasswordGate.js` rather than back into `app/(portal)/layout.js`, since the previous plan deliberately scoped the header removal to all portal states, and this change narrows it to exactly one state without reversing that decision — this avoids reintroducing the header/height problem the previous plan solved for `DeckEmbed`'s full-height iframe.

No new dependencies are introduced. `LeftArrow`, `RightArrow`, and `Image` (`next/image`) are all already used elsewhere in the codebase with established prop conventions.

## 5. Data Flow

No data flow changes. `DeckPdfNav` continues to receive `currentPage`, `numPages`, and `onNavigate` exactly as before — only its internal rendering (icons instead of text, added background/color classes) changes. `PasswordGate` continues to receive `token` and `deckTitle` exactly as before; the logo is static markup with no new prop or data dependency, matching how `MainNav` renders its logo as static markup unrelated to any fetched data.

## 6. Component Responsibilities

### `components/DeckPdfNav.js` (modified)
- Responsible for: rendering the prev/next controls using `LeftArrow`/`RightArrow`, the page counter text, and the disabled/enabled boundary logic (unchanged from the previous plan).
- NOT responsible for: the bar's background/positioning (defined in `deck.css`), or tracking `currentPage` itself (owned by `DeckPdfViewer`, unchanged).
- Props: unchanged — `currentPage` (number, required), `numPages` (number, required), `onNavigate` (function, required).
- No internal state (unchanged).

### `components/PasswordGate.js` (modified)
- Responsible for: additionally rendering the FLOWERS logo above its existing title/form markup.
- NOT responsible for: any layout-level concerns (still scoped to its own screen only, not the shared layout).
- Props: unchanged — `token` (string, required), `deckTitle` (string, optional).
- No internal state changes.

### `components/Icons.js` (unchanged)
- No changes in this plan; `LeftArrow` and `RightArrow` are consumed as-is by `DeckPdfNav`.

## 7. Files Affected

- `components/DeckPdfNav.js` — replace text arrow characters with `LeftArrow`/`RightArrow` icons, apply theme-consistent classes to the counter text.
- `styles/deck.css` — add background/color styling to `.deck-pdf-nav` and its children so the bar matches the site's `bg-cream dark:bg-black` pattern and stays legible regardless of PDF page content.
- `app/(portal)/portal/[token]/PasswordGate.js` — add the FLOWERS logo above the existing title/form.

No changes to `DeckPdfViewer.js`, `DeckEmbed.js`, `app/(portal)/layout.js`, or any Kirby/query files — this plan is purely visual and scoped to the two files above.

## 8. Step-by-Step Implementation

**Step 1 — `styles/deck.css`**
Update the `.deck-pdf-nav` rule to add a background and text color matching the site's theme convention: light mode uses the cream background with black content, dark mode inverts to a black background with cream content. Since this file is a plain CSS file (not a Tailwind-processed component), express the light/dark switch using the same mechanism already in place for the rest of the site's non-Tailwind CSS — check `styles/nav.css` and `styles/global.css` for how (or whether) plain CSS files reference the site's dark-mode class or CSS custom properties (e.g. `var(--color-text)` is already used in `nav.css`) before deciding whether to hardcode two colors with a `:global(.dark)` / `html.dark` ancestor selector or reuse an existing custom property. Also adjust `.deck-pdf-nav__prev` and `.deck-pdf-nav__next` so they no longer need `background: none` styling for text (icons render via SVG `fill`/`stroke` instead), and ensure the buttons are sized/padded consistently with the icon's natural dimensions (74×60 viewBox) rather than the previous text-character sizing — likely reducing the rendered icon size with an explicit width/height or className on the SVG wrapper so the bar does not become oversized. Watch for: `LeftArrow`/`RightArrow` are fairly large by default (74×60 viewBox); this step must account for a smaller display size appropriate to a nav bar, which is set where the icon is rendered (Step 2), but the surrounding button/bar padding here should assume a compact icon, not the full native SVG size.

**Step 2 — `components/DeckPdfNav.js`**
Import `LeftArrow` and `RightArrow` from `../components/Icons` (relative import, matching this file's existing import style). Replace the "‹" character inside the prev `<button>` with `<LeftArrow color={...} />`, and the "›" character inside the next `<button>` with `<RightArrow color={...} />`, wrapping each icon in a sized container (or applying a width/height directly, depending on how Step 1 constrained sizing) so it renders at a compact, nav-appropriate size rather than its native 74×60. Set each icon's `color` prop to match the bar's theme text color established in Step 1 (this may require reading the color from a CSS variable at render time, or simply hardcoding the same two-color logic other components use — check how `MainNav`'s `UpArrow` determines its `color` prop, since it already solves "pick icon color based on current theme" via `useTheme()`, and decide whether that same hook should be reused here for consistency, or whether relying on CSS alone (SVG `fill="currentColor"` is not used by these icons, so `color` must be passed explicitly) is sufficient given the bar's background is already guaranteed by Step 1). Keep the counter `<span>`'s existing `font-secondary text-md` classes; this step does not need to change its typography beyond what already exists, unless the color needs adjusting to match the new bar background (likely needs a text color class added, e.g. matching the icon color logic). Watch for: the existing `disabled` logic on both buttons must be preserved exactly — only the visual content inside each button changes, not the boundary conditions from the previous plan.

**Step 3 — `app/(portal)/portal/[token]/PasswordGate.js`**
Add `import Image from "next/image";` at the top of the file. Inside the returned JSX, before the existing `{deckTitle && (...)}` block, add a logo element matching what previously existed in `app/(portal)/layout.js`'s header: `<Image src="/FLOWERS.png" alt="FLOWERS" width={50} height={40} className="dark:invert" />`, wrapped with the same spacing treatment the old header had (`py-8` equivalent, or an appropriate margin-bottom given it now sits inside the password gate's own `px-6 max-w-[420px] mx-auto pt-24` container rather than a full-width header bar) so it doesn't collide with the `pt-24` top padding already on the outer wrapper — likely needs a margin-bottom (e.g. `mb-8`) rather than the old header's `py-8 px-6`, since this element is now inline content within an already-padded column, not a standalone full-width bar. Watch for: this logo must render unconditionally (not gated behind `deckTitle`, since the password gate should always show branding regardless of whether a title is set), and must not be duplicated if `deckTitle` is also present — it sits above both the optional title and the form.

## 9. Edge Cases

A PDF page whose content is pure black or pure white directly behind the nav bar: resolved structurally by Step 1's opaque background — the bar covers the content entirely regardless of its color, so this is not a runtime concern once Step 1 is correct.

Site-wide theme toggled mid-session while viewing a PDF deck: the nav bar and icons must follow the same `dark` class mechanism as the rest of the site (already applied globally via the existing theme script), so no additional handling is needed beyond using the same conditional classes/approach as `MainNav`.

Password gate shown for an already-expired link: out of scope — the `expired` status in `page.js` renders a separate, non-`PasswordGate` branch and is unaffected by this plan.

Very small nav bar on narrow mobile viewports: the icons must remain tappable at a reasonable touch-target size once sized down from their native dimensions in Step 1/2 — verify the chosen compact size is not so small it becomes hard to tap.

## 10. Test Considerations

Manual checks:
- Load a PDF-type deck with the site in light mode: confirm the nav bar shows a cream background with black icons/text, fully legible.
- Toggle to dark mode (or load with dark mode already active): confirm the nav bar inverts to a black background with cream icons/text.
- Step through pages where the PDF content itself is a very dark or very light slide directly behind the nav bar: confirm the nav bar's own background remains solid and the controls stay legible regardless of the page content.
- Confirm prev/next disabled states at page 1 and the last page still work exactly as before — only appearance should have changed, not behavior.
- Load the password gate for a deck: confirm the FLOWERS logo appears above the title/form, correctly inverts in dark mode, and does not appear on the expired-link screen or on the unlocked deck viewer (Figma or PDF).
- Check on a narrow mobile viewport that the nav bar icons are comfortably tappable and the password gate logo does not overlap the title or form.

No automated test suite exists for this app; no new automated tests are introduced by this plan, consistent with prior deck-related plans.

## 11. Implementation Order

1. `styles/deck.css` — existing file, modified. Establishes the nav bar's background/color foundation first, since the component changes in the next step depend on knowing what color values/classes are available to apply to the icons and text.
2. `components/DeckPdfNav.js` — existing file, modified. Swaps in the icon components and applies the color/sizing established in Step 1; depends on the CSS groundwork being in place.
3. `app/(portal)/portal/[token]/PasswordGate.js` — existing file, modified. Independent of the first two steps (different screen, different concern); placed last only because it is unrelated to the nav bar work and can be done in isolation.
