# About Page Two-Column Alignment

## 1. Goal

The About page (`next/app/about/page.js`) currently has three sections that each use a different left/right column split within the same 12-column grid: the intro section is text (4 cols) + studio image (5 cols) with a 1-col spacer, the founder section is image (5 cols) + bio text (4 cols) with a 1-col spacer, and the services list is heading (4 cols) + description (6 cols) with no spacer column (just `gap-8`). Because the splits differ, the left and right edges of each section's content do not line up with each other down the page. This plan makes every section use the same left-column and right-column widths so the page reads as one consistent two-column layout, without merging the sections into a single grid container.

## 2. Current System Behaviour

- `next/app/about/page.js` renders, top to bottom: a full-width `<h1>` headline; Section 1 (`grid grid-cols-12 gap-8 items-center`) with intro paragraphs in a `col-span-12 lg:col-span-4` block, a `hidden lg:block lg:col-span-1` spacer, and the studio image (`/about/1.png`) in a `col-span-12 lg:col-span-5` block; an `<hr>` divider with `my-16` spacing; Section 2 (same grid pattern) with the founder image (`/about/2.png`) in `col-span-12 lg:col-span-5`, the same spacer, and the Cait Oppermann name/title/bio in `col-span-12 lg:col-span-4`; a spacer `<div className="my-16">`; then the "What we do" heading and the services list, where each service is its own `grid grid-cols-12 gap-8` row with the heading in `col-span-12 lg:col-span-4` and the description in `col-span-12 lg:col-span-6` (no `col-span-1` spacer div — the gap alone separates them), bordered top and bottom (`border-t`/`border-b border-black`) per row.
- All three grid rows use `items-center` (Sections 1 and 2) except the services rows, which have no `items-*` class (so default `stretch`).
- On mobile (`below lg`), every column collapses to `col-span-12`, so all content stacks in source order: intro text → studio image; founder image → bio text; then each service's heading above its description.
- Section 1 and 2 each visually pair one "text" block with one "image" block, but at different widths (4/5 vs 5/4), so the text column in Section 1 is narrower than the image column in Section 2, and vice versa. The services list uses yet another split (4/6, no spacer).

## 3. Desired Behaviour

- All three sections use the same column proportions: left column = 5/12, right column = 6/12, with `gap-8` providing the spacing between them (no dedicated 1-column spacer `<div>` — the split itself, 5 + 6 = 11 of 12 columns, plus the gap, provides the visual separation, matching how the services rows already achieve spacing without a spacer column).
- Section 1: intro text occupies the left column (5/12), the studio image occupies the right column (6/12).
- Section 2: the founder image occupies the left column (5/12), the bio text (name, title, two paragraphs) occupies the right column (6/12) — this section's left/right roles for image vs. text are unchanged from today (image left, text right); only the widths change.
- Services list: each row's heading occupies the left column (5/12, widened from today's 4/12), and its description occupies the right column (6/12, unchanged from today).
- Because every section now shares the same 5/12 left and 6/12 right widths, the left edges and right edges of all content (intro text, studio image, founder image, bio text, service headings, service descriptions) line up vertically down the page.
- The existing `<hr>` divider between Section 1 and Section 2, and the `my-16` spacer before the services list, are preserved as-is — sections remain visually distinct blocks, not merged into one grid.
- Mobile stacking behavior (all columns full-width, same source order) is unchanged.
- No content, copy, image assets, or CMS data changes.

## 4. Architecture Considerations

- **Sections remain separate, not merged into one grid.** Each of the three sections keeps its own `grid grid-cols-12 gap-8` container and its existing divider/spacing (`<hr className="my-16">`, `<div className="my-16">`). Only the `col-span-*` values within each section change. This was explicitly chosen over merging into a single continuous grid, to preserve the current visual grouping and spacing rhythm of the page.
- **Drop the 1-column spacer `<div>` in Sections 1 and 2, standardize on `gap-8` alone.** Today, Sections 1 and 2 use an explicit `hidden lg:block lg:col-span-1` spacer div between the two content columns, while the services rows rely only on `gap-8` for spacing. Since the new split (5 + 6 = 11) already reserves less than the full 12 columns, keeping a spacer div would require dropping to something like 5 + 5 or 4 + 6 with an extra spacer column, which does not match the chosen 5/6 split. Removing the spacer divs and relying on `gap-8` (already the pattern used successfully by the services rows) keeps all three sections structurally consistent and is the simplest way to hit exactly 5 + 6 = 11 columns with `gap-8` as the sole separator.
- **`items-center` on Sections 1 and 2 is preserved.** This was not part of the user's request and changing it risks an unrelated visual regression (currently keeps text vertically centered against the image height). It is called out in Edge Cases in case the new widths change how this looks.
- **No changes to `next/styles/about.css` or `aboutQuery.js`.** This is a pure Tailwind class change in `next/app/about/page.js`; no CSS file or data-fetching logic is affected.
- **No new component extracted.** The services list is still rendered inline via `.map()` in `page.js`, consistent with the existing pattern; only the `col-span-*` classes inside the mapped row change.

## 5. Data Flow

No data flow changes. `next/app/about/page.js` remains a static Server Component with no data fetching (the services array is still a hardcoded array of `{ title, description }` objects mapped inline; the intro and founder copy remain hardcoded JSX). This plan only changes Tailwind width classes on existing JSX elements — it does not touch how content is sourced, passed, or rendered as text.

## 6. Component Responsibilities

### `next/app/about/page.js` (modified)

- **Responsible for:** Rendering the About page's three sections (intro, founder, services) with column widths that are now consistent (5/12 left, 6/12 right) across all three.
- **Not responsible for:** Any content or copy changes, CMS data fetching, nav/footer rendering (handled in `layout.js`), or the `HomeLink` visibility logic (handled in `HomeLink.js`, untouched by this plan).
- **Props:** None — unchanged, this is a Next.js page component.
- **Internal state:** None — unchanged.

No other components are involved in this change.

## 7. Files Affected

- `next/app/about/page.js` — the only file that changes. Update `col-span-*` classes in Sections 1, 2, and the services row, and remove the two `hidden lg:block lg:col-span-1` spacer divs.

## 8. Step-by-Step Implementation

### Step 1 — Section 1 (intro text + studio image): change widths and remove spacer

In the first `grid grid-cols-12 gap-8 items-center` block (currently lines 13–48):
- Change the intro text wrapper's class from `col-span-12 lg:col-span-4 ...` to `col-span-12 lg:col-span-5 ...`, keeping the rest of its classes (`space-y-6 font-secondary font-normal text-[15px] leading-[19.5px] lg:text-[18px] lg:leading-[23.4px]`) unchanged.
- Delete the `<div className="hidden lg:block lg:col-span-1"></div>` spacer entirely.
- Change the image wrapper's class from `col-span-12 lg:col-span-5` to `col-span-12 lg:col-span-6`.
- Inside the image wrapper, the inner `<div className="relative w-full lg:ml-auto">` and the `<Image>` itself (with its `style={{ width: "100%", height: "auto" }}`) need no changes — they already fill whatever width their parent column provides, so widening the column to 6/12 automatically widens the rendered image. The `lg:ml-auto` class (which right-aligns the image within its column when the image's own width is less than 100%) is unrelated to this change and should be left as-is since the `Image` component is styled to `width: "100%"` and will fill the column regardless.

Watch out for: this changes the visual width of the studio image relative to today (5/12 → 6/12), which is an intended visual change per the confirmed 5/6 split, not a regression.

### Step 2 — Section 2 (founder image + bio text): change widths and remove spacer

In the second `grid grid-cols-12 gap-8 items-center` block (currently lines 52–93):
- Change the founder image wrapper's class from `col-span-12 lg:col-span-5` to `col-span-12 lg:col-span-5` — no change needed here, since the image is already in the left column at 5/12, which matches the new standard left-column width. (Confirm this against the file at implementation time in case line numbers have shifted.)
- Delete the `<div className="hidden lg:block lg:col-span-1"></div>" spacer entirely (mirrors Step 1).
- Change the bio text wrapper's class from `col-span-12 lg:col-span-4 font-secondary ...` to `col-span-12 lg:col-span-6 font-secondary ...`, keeping all other classes on that element unchanged.
- No changes needed to the `<h2>` (Cait Oppermann name), the `<p>` (title), or the `<div className="space-y-6">` paragraphs inside the bio text wrapper — they inherit the new column width automatically.

Watch out for: the founder image currently uses `style={{ width: "60%", height: "auto" }}` on the `<Image>` itself (line 60), meaning the image only fills 60% of its column, not the full 5/12 column width. Removing the spacer column does not change this inline style, so the image's rendered width in the browser will still be 60% of a (now slightly wider, due to spacer removal) 5/12 column. Since the user only asked to standardize column widths, not the image's internal fill percentage, leave this `width: "60%"` as-is — flag it to the user after implementation as a visual side effect worth a follow-up if the founder image ends up looking too narrow relative to the studio image in Section 1 (which fills 100% of its column).

### Step 3 — Services list rows: widen heading column

In the `.map()` block that renders each service row (currently around lines 134–147), inside the row's `grid grid-cols-12 gap-8 py-10 border-b border-black` container:
- Change the `<h3>` heading's class from `col-span-12 lg:col-span-4 ...` to `col-span-12 lg:col-span-5 ...`, keeping the rest of its classes unchanged.
- Leave the `<p>` description's class as `col-span-12 lg:col-span-6 ...` — this already matches the new standard right-column width, so no change is needed there. (Confirm at implementation time.)

Watch out for: widening the heading column from 4/12 to 5/12 leaves 12 − 5 − 6 = 1 unused column (previously 12 − 4 − 6 = 2 unused columns), consistent with the 5 + 6 = 11 pattern used in Sections 1 and 2 (which also leave 1 column of the 12-column grid unused, now that the spacer divs are removed — that remaining column's width is effectively absorbed as extra breathing room by the grid, not rendered as a visible element, same as how the services rows already behave today with their 2 unused columns).

### Order and dependencies

These three steps are independent of each other — each touches a different section of the same file with no shared state — so they can be done in any order, but doing them top-to-bottom (Section 1, then Section 2, then services) is easiest to verify visually as each change is made.

## 9. Edge Cases

- **`items-center` combined with new widths in Sections 1 and 2:** widening the text/image columns changes their relative heights (e.g., three paragraphs of text vs. an image at a new width may produce a different height ratio than before). Since `items-center` is preserved, the shorter column will still vertically center against the taller one; this should be visually reviewed after the change, but no code change is planned for this unless the review surfaces a problem.
- **Founder image's `width: "60%"` inline style, described in Step 2:** the image will not visually fill its full 5/12 column, unlike the studio image in Section 1 (which fills 100% of its 6/12 column). This is a pre-existing style choice, not something this plan changes, but the resulting visual asymmetry between the two image sections is worth flagging to the user after implementation.
- **Removing the spacer `<div>`s changes total column usage from 4+1+5=10 (or 5+1+4=10) to 5+6=11 out of 12.** This slightly reduces the empty-space gap between columns at the `lg` breakpoint (previously a dedicated ~1/12-width spacer column plus `gap-8`; now just `gap-8`). This is an intended consequence of standardizing on `gap-8` alone as the separator, matching how the services rows already work, but the visual gap will be narrower than today's Section 1/2 gap. If this reads as too tight after implementation, the fix would be increasing `gap-8` to a larger gap utility (e.g., `gap-12`) uniformly across all three sections — not reintroducing the spacer column, which would break the 5/6 split.
- **Mobile layout:** since all `col-span-12` (base) classes are untouched, mobile stacking order and full-width behavior are unaffected by any of these changes.

## 10. Test Considerations

Manual checks only (no automated tests exist for page layout in this codebase):

- Run the dev server and visit `/about`.
- At the `lg` breakpoint and above, confirm the left edges of the intro text, the founder image, and the service headings all align vertically with each other, and the right edges of the studio image, bio text, and service descriptions all align vertically with each other.
- Confirm the studio image (Section 1) now renders wider than before (6/12 instead of 5/12 of the row).
- Confirm the founder image (Section 2) and bio text widths, and note whether the founder image's 60% inline width now looks visually narrow compared to the studio image — decide with the user whether a follow-up change to that inline style is wanted.
- Confirm each service row's heading is visibly wider than before (5/12 instead of 4/12) and still lines up with its description at `gap-8` spacing, with the border-top/border-bottom lines unaffected.
- Resize below the `lg` breakpoint and confirm all sections still stack full-width in the same order as before (no regression to mobile layout).
- Confirm the `<hr>` divider between Section 1 and Section 2, and the spacing before "What we do", are unchanged.

## 11. Implementation Order

1. `next/app/about/page.js` — existing file, modified in place across Sections 1, 2, and the services `.map()` block. This is the only file in scope; the three edits within it (Steps 1–3 above) are independent and can be applied in any order within the same file.
