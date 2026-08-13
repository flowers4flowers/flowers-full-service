# About Page: Column Spacing and Cait Image Sizing

## 1. Goal

Increase the visual separation between the two columns on the About page, and make Cait Oppermann's portrait render at its intended design size (~467×599.58px at a 1440px viewport) instead of stretching to fill its grid column.

## 2. Current System Behaviour

- `next/app/about/page.js` renders three independent two-column sections, each using its own `grid grid-cols-12 gap-8 items-center` (or, for the services list, `grid grid-cols-12 gap-8`) container: gap is `gap-8` (32px) in every case.
- The page is wrapped by `Container` (`next/components/Container.js`), which applies `w-container mx-auto`, and `w-container` is defined in `next/tailwind.config.js` as `90%` of the viewport. At a 1440px viewport, the container content width is therefore 1296px.
- Within a 1296px-wide, 12-column grid with `gap-8` (32px gaps, 11 gaps total = 352px), each column-width "unit" is `(1296 − 352) / 12 ≈ 78.7px`.
- Cait's photo sits in the second section's left column (`col-span-12 lg:col-span-5`, `next/app/about/page.js:51`), inside a `<div className="relative w-full">` wrapper. The `<Image>` itself has `width={467}` `height={600}` (source file `next/public/about/2.png` is natively 467×600px, ratio ≈0.7783 — already effectively matching the requested 467×599.58 ratio of ≈0.7788) and `style={{ width: "100%", height: "auto" }}`.
- Because the wrapper is `w-full` and the column is `lg:col-span-5`, the image stretches to fill the full column width: `5 × 78.7 + 4 × 32 ≈ 521px` at a 1440px viewport — noticeably wider than the intended 467px, though its aspect ratio stays correct (height scales proportionally to ≈669px, not distorted, just oversized).
- The intro text block in Section 1 (`next/app/about/page.js:14`) already uses a similar fixed-width pattern (`lg:w-[467px]`) for a different reason (constraining paragraph line length), which is not part of this change but is the closest existing precedent in this file for capping an element's width independently of its grid column.

## 3. Desired Behaviour

- All three grid containers on the About page use `gap-20` (80px) instead of `gap-8` (32px), widening the space between the left and right columns in every section: intro text/studio image, founder image/bio text, and each services row (heading/description).
- Cait's portrait no longer stretches to fill its `col-span-5` column. Instead, its rendered width is capped at 467px from the `lg` breakpoint upward, and it shrinks proportionally (via `w-full`) below that breakpoint and on narrower desktop widths where the column itself is narrower than 467px, so it never overflows its column.
- No other visual aspects of the page (column proportions, section order, borders, mobile stacking, other images) change.

## 4. Architecture Considerations

- **Gap change is a single Tailwind class swap repeated three times**, one per existing grid container (`next/app/about/page.js:13`, `:50`, `:133`). No new CSS, no structural changes to the grid itself (still 12 columns, still 5/6 split from the prior alignment plan). Increasing the gap from 32px to 80px does not change any `col-span-*` values, so the previously-aligned left/right edges across sections remain aligned — only the visual gap between them widens.
- **Image sizing uses `max-width` + `w-full`, not a fixed `w-[467px]`.** The user chose the responsive-cap approach over a hard fixed width: `lg:max-w-[467px] w-full` lets the image shrink below 467px on any viewport where its column is narrower than that (e.g. at the `lg` breakpoint's lower edge, or on the founder image's own column at different container widths), while never growing past 467px on larger screens. A hard `lg:w-[467px]` would instead keep the image at exactly 467px even on viewports where the column is narrower than that, causing overflow or overlap with the adjacent text column — this is why max-width was preferred.
- **The cap is applied to the existing wrapper `<div className="relative w-full">` (`next/app/about/page.js:52`), not the `<Image>` element itself.** The `<Image>` already has `style={{ width: "100%", height: "auto" }}`, meaning it fills whatever width its parent wrapper provides. Capping the wrapper's width therefore caps the rendered image width without touching the `<Image>` component's own props or style, keeping the change minimal and consistent with how the wrapper/`Image` relationship already works in both image sections of this page.
- **No change to the `<Image>` component's `width`/`height` props (467/600).** These props are already a near-exact match for the requested ratio (467/600 = 0.7783 vs. requested 467/599.58 = 0.7788, a 0.07% difference) and are used by Next.js only to compute the intrinsic `aspect-ratio` for layout purposes — not the rendered pixel size, which `style` and now the wrapper's `max-width` control. Changing `height={600}` to a fractional value is not supported by the `Image` component's integer prop type and is not needed given how close the existing ratio already is.
- **No changes to `next/tailwind.config.js` or `next/styles/about.css`.** `gap-20` is a standard Tailwind spacing utility already available without configuration; no custom width tokens are needed beyond the arbitrary-value `max-w-[467px]` already used elsewhere in this file (`lg:w-[467px]` on the intro text).
- **Mobile/base behavior unaffected.** All `col-span-12` base classes and the `w-full` wrapper class remain unchanged below `lg`, so the image continues to fill its full-width mobile column and the gap gap-change only affects spacing at breakpoints where the grid is multi-column (`gap-*` utilities apply regardless of column count, but visually only matter once columns sit side by side at `lg`).

## 5. Data Flow

No data flow changes. This is a pure Tailwind class edit on existing JSX in `next/app/about/page.js`, a static Server Component with no data fetching relevant to this change. Image source (`/about/2.png`), alt text, and all copy remain untouched.

## 6. Component Responsibilities

### `next/app/about/page.js` (modified)

- **Responsible for:** Rendering the About page's three grid sections with a wider inter-column gap, and constraining Cait's portrait to its intended maximum rendered width.
- **Not responsible for:** Any copy, image asset, or column-proportion (`col-span-*`) changes — none of those are in scope. Nav/footer/container rendering remains in `layout.js` and `Container.js`, untouched.
- **Props:** None — unchanged, this is a Next.js page component.
- **Internal state:** None — unchanged.

No other components are involved in this change.

## 7. Files Affected

- `next/app/about/page.js` — the only file that changes. Update `gap-8` → `gap-20` on all three grid containers; add `lg:max-w-[467px]` to Cait's image wrapper `<div>`.

## 8. Step-by-Step Implementation

### Step 1 — Widen the gap in Section 1 (intro text + studio image)

In `next/app/about/page.js:13`, change the container's class from `grid grid-cols-12 gap-8 items-center` to `grid grid-cols-12 gap-20 items-center`.

Watch out for: this section's studio image (`col-span-12 lg:col-span-6`) fills 100% of its column width via `style={{ width: "100%", height: "auto" }}`; widening the gap narrows the column's available width slightly (more of the 1296px container is consumed by gap, less by content), so the studio image will render marginally narrower than before. This is an expected side effect of a uniform gap increase, not a regression — no code change needed to accommodate it.

### Step 2 — Widen the gap in Section 2 (founder image + bio text) and cap Cait's image width

In `next/app/about/page.js:50`, change the container's class from `grid grid-cols-12 gap-8 items-center` to `grid grid-cols-12 gap-20 items-center`.

In `next/app/about/page.js:52`, change the image wrapper's class from `relative w-full` to `relative w-full lg:max-w-[467px]`. Leave the `<Image>` element itself (`src`, `alt`, `width={467}`, `height={600}`, `style={{ width: "100%", height: "auto" }}`) completely unchanged — it already fills 100% of whatever width the wrapper provides, so capping the wrapper's max-width automatically caps the rendered image.

Watch out for: at the `lg` breakpoint's lower edge, or at any desktop width where the `col-span-5` column is narrower than 467px, `max-w-[467px]` has no effect and `w-full` governs — the image shrinks with its column rather than overflowing. This is the intended responsive behavior per the chosen approach (max-width cap, not a fixed width). Also note this section's column is no longer visually left-aligned to the same degree once the image stops filling its column at wide viewports — at 1440px and above, the image (467px) will be narrower than its column (roughly 521px before the gap change, less after Step 2's gap widening), leaving empty space to the image's right within its own grid cell. Since the column itself is `items-center`, this asymmetry is confined to the image's own cell and does not affect alignment with the bio text column to its right.

### Step 3 — Widen the gap in each services row

In `next/app/about/page.js:133` (inside the `.map()` callback), change each row's class from `grid grid-cols-12 gap-8 py-10 border-b border-black dark:border-cream` to `grid grid-cols-12 gap-20 py-10 border-b border-black dark:border-cream`.

Watch out for: this is a template literal inside `.map()`, so the class string only needs to change once — it applies to every rendered row automatically. No per-item logic is affected.

### Order and dependencies

These three edits are independent — each touches a different, non-overlapping part of the same file — so they can be applied in any order. Doing them top-to-bottom (Section 1, then Section 2 including the image cap, then services rows) is easiest to verify visually as each change lands, and matches the order used in the prior alignment plan for this same file.

## 9. Edge Cases

- **Gap widening narrows available column content width slightly in every section**, since `gap-20` (80px × 11 gaps = 880px total) consumes more of the 1296px container than `gap-8` did (352px total). This shrinks the studio image (Section 1, fills 100% of its column) and the services row text wrapping (headings/descriptions get slightly less width). This is an expected, uniform consequence of the requested gap increase — no mitigation planned unless visual review after implementation shows text wrapping awkwardly in the narrower services description column.
- **Cait's image no longer fills its grid column at wide viewports**, unlike the studio image in Section 1. This creates a visual asymmetry between the two image sections (studio image edge-to-edge in its column; Cait's image capped at 467px with empty space in its cell) that did not exist before. This is the explicit intended outcome of this plan (matching the ~467px design size) and should not be "fixed" by removing the cap — flag to the user after implementation only if the resulting empty space looks unintentional relative to the bio text column beside it.
- **Below `lg`, both the gap change and the image cap are inert** (`max-w-[467px]` only applies at `lg:` and up; base `w-full` already governs mobile). Mobile layout is unaffected by this plan.
- **Ratio precision:** the source image (`next/public/about/2.png`) is natively 467×600px, not 467×599.58px. The 0.07% difference is visually imperceptible (under half a pixel at any realistic render size) and is not addressed by this plan — flagged here only for completeness, since the user's stated target height (599.58) cannot be exactly reproduced without re-exporting the source asset, which is out of scope.

## 10. Test Considerations

Manual checks only (no automated tests exist for page layout in this codebase):

- Run the dev server and visit `/about`.
- At a 1440px (or similarly wide `lg`+) viewport, confirm the gap between columns is visibly wider in all three sections (intro/studio image, founder image/bio text, each services row) compared to the current 32px gap.
- Confirm Cait's portrait renders at approximately 467px wide (roughly 600px tall) rather than stretching to its ~521px (pre-gap-change) or narrower (post-gap-change) column width.
- Resize the viewport down through the `lg` breakpoint and confirm Cait's image shrinks proportionally with its column once the column becomes narrower than 467px, with no overflow or overlap with the adjacent bio text column.
- Resize below `lg` and confirm all sections still stack full-width in the same order as before, with the image filling full mobile width (unaffected by `lg:max-w-[467px]`).
- Confirm the studio image (Section 1) and services row text still read cleanly with the narrower available column width caused by the larger gap — no unexpected text overflow or awkward wrapping.
- Confirm the `<hr>` divider between Section 1 and Section 2, and the spacing before "What we do", are unchanged.

## 11. Implementation Order

1. `next/app/about/page.js` — existing file, modified in place. Apply Step 1 (Section 1 gap), Step 2 (Section 2 gap + Cait image max-width cap), and Step 3 (services rows gap) in that order for easiest visual verification; all three are independent edits within the same file.
