# About Page Hero Section

## 1. Goal

`next/app/about/page.js` exists but is an empty file with no export, so the `/about` route is currently broken (the file has no default export for Next.js to render). This plan builds a new top-of-page hero section for `/about`, matching a provided reference screenshot: a large bold headline on the left, three body paragraphs beneath it, and a photo on the right. It also stops the large centered "HomeLink" logo (rendered globally by `HomeLink.js`) from appearing on `/about`, matching the pattern already used for `/projects` pages.

This plan covers only this hero section. It does not add the rest of the About page (clients, projects, footer content) — that is out of scope and left for a future plan.

## 2. Current System Behaviour

- `next/app/about/page.js` is empty (no default export). Visiting `/about` currently fails to render because Next.js requires a default export from a page file.
- `next/components/MainNavLinks.js` already links to `/about` in the main nav, so the route is reachable and expected to work.
- `next/components/HomeLink.js` is a client component rendered globally in `next/app/layout.js` (outside of `{children}`), on every route. It renders a large centered FLOWERS logo/link (`/FLOWERS-Full.svg`) below the nav bar on desktop only (`hidden lg:block`). It currently checks `pathname.includes("/projects")` to hide the logo (and show an "up" button instead) on project pages. On every other route, including the not-yet-working `/about`, the logo renders.
- The site's about copy currently lives in Kirby CMS (`cms/content/5_about/about.txt`) and is fetched via `getAboutData()` in `next/queries/aboutQuery.js`, but that data is rendered on the homepage (`next/app/page.js`), not on `/about`. The `/about` route does not currently consume this query.
- The site uses a consistent cream/black theme throughout: `bg-cream` (`#EEEBE6`) page/nav background with black text, defined in `next/tailwind.config.js`. Body copy generally uses `font-secondary`; large headline text uses `font-primary` with heavy weight (see `app/page.js`'s description block: `font-primary text-2xl font-bold lg:text-xxl`).
- Page content is wrapped by `<main className="px-5 lg:px-14">{children}</main>` in `layout.js`, which already provides horizontal page padding.
- An image file already exists at `next/public/about/1.png` (this is the photo the user wants to use for the new section).

## 3. Desired Behaviour

- Visiting `/about` renders a new hero section at the top of the page, laid out to match the reference screenshot:
  - Left column: a large, bold headline, and beneath it three separate body paragraphs (matching the screenshot's copy exactly).
  - Right column: the image at `next/public/about/1.png`.
  - On large screens the headline sits above the two-column area spanning the full width (as in the screenshot), with the paragraphs in the left column and the image in the right column below it.
  - The section uses the site's existing cream background and black text theme (not the black/white scheme shown in the screenshot) — only the layout/composition is being matched, not the screenshot's color scheme.
- On `/about`, the large centered `HomeLink` logo no longer appears, consistent with how it is already hidden on `/projects` pages.
- The top-left small FLOWERS logo in `MainNav.js` / `MobileNav.js` continues to appear on `/about` as normal — it is unaffected by this change.
- The layout is responsive: on small screens, the headline, paragraphs, and image stack vertically in a sensible reading order (headline, then paragraphs, then image).

## 4. Architecture Considerations

- **Inline in `page.js`, no new component.** Per explicit instruction, the hero section is written directly inside `next/app/about/page.js` rather than being extracted into a separate component file. This is a deliberate deviation from the pattern used by `/info` (which delegates to `InfoContent.js`), acceptable here because the section is self-contained, has no client-side interactivity or state, and is scoped to a single page.
- **Static content, not CMS-driven.** Per explicit instruction, the headline and three paragraphs are hardcoded as plain JSX text in `page.js`, not pulled from Kirby via `aboutQuery.js`. This is a conscious divergence from the CMS-driven approach used elsewhere on the site (e.g., `app/page.js`). No new Kirby blueprint fields are added. If the copy needs to become editable later, that would require a separate plan to add fields to `cms/site/blueprints/pages/about.yml` and extend `aboutQuery.js`.
- **`page.js` stays a Server Component.** Nothing in this section requires client-side interactivity (no hooks, no event handlers), so `page.js` does not need a `"use client"` directive. This matches other simple static pages in the app.
- **Hiding `HomeLink` by extending the existing pathname check.** `HomeLink.js` already conditionally hides itself using `!pathname.includes("/projects")`. The minimal, consistent change is to extend that same condition to also exclude `/about`, rather than introducing a new prop, context flag, or a second mechanism. This keeps the "which routes suppress the home link" logic in one place.
- **Tailwind grid, matching existing conventions.** Other multi-column layouts in the codebase (e.g., `InfoContent.js`) use a 12-column Tailwind grid (`grid grid-cols-12 gap-8 lg:gap-16`) with `col-span-*` breakpoint utilities. The new section follows this same convention for consistency, rather than introducing flexbox or a different grid system.
- **Image via `next/image`.** All other logo/photo usages in the codebase use `next/image`'s `Image` component (`MainNav.js`, `HomeLink.js`). The hero photo will do the same, using `fill` with a `relative` sized container (since the exact intrinsic dimensions of `1.png` were not confirmed), matching the pattern already used in `HomeLink.js`.

## 5. Data Flow

There is no dynamic data flow for this feature. `next/app/about/page.js` is a Server Component with no data fetching (no `getAboutData()` call, no `params`, no `fetch`). All headline and paragraph text is static JSX string content authored directly in the file. The image source is a static path (`/about/1.png`) served from `next/public/about/`, resolved by `next/image` at render/build time — no props or query results are involved.

For the `HomeLink` visibility change, the only "data" involved is the current route pathname, already obtained client-side via `usePathname()` inside `HomeLink.js`. That pathname string is compared against a route substring (`"/projects"`, and now also `"/about"`) to decide whether to render the logo `<Link>`.

## 6. Component Responsibilities

### `next/app/about/page.js` (modified)

- **Responsible for:** Rendering the `/about` route's top hero section — headline, three paragraphs, and image — as static server-rendered markup, laid out in the grid described above.
- **Not responsible for:** Fetching or displaying CMS data; rendering the site nav, footer, or `HomeLink` (those remain in `layout.js`); any future About page sections (clients, projects, etc.) beyond this hero.
- **Props:** None — it is a Next.js page component, receives only the implicit Next.js route props (`params`, `searchParams`), neither of which is used.
- **Internal state:** None.

### `next/components/HomeLink.js` (modified)

- **Responsible for:** Deciding, based on the current pathname, whether to render the centered home logo link or the "up" button; this responsibility is unchanged in kind, only the pathname condition is extended.
- **Not responsible for:** Anything about the `/about` page's own content — it lives outside `{children}` in `layout.js` and knows nothing about what page is rendering.
- **Props:** None (unchanged).
- **Internal state:** None (unchanged) — it only reads `usePathname()`.

## 7. Files Affected

- `next/app/about/page.js` — currently empty; add the default-exported page component containing the new hero section markup. This is the primary deliverable.
- `next/components/HomeLink.js` — extend the existing pathname condition so the centered logo (and its wrapping `<nav id="home-link">`) is also suppressed on `/about`, not just `/projects`.

No other files need to change. No new files are created (no new component, no new CSS file, no CMS blueprint changes, no query changes), per the answers given during clarification.

## 8. Step-by-Step Implementation

### Step 1 — Extend `HomeLink.js` to also hide on `/about`

In `next/components/HomeLink.js`, the two conditional blocks (`{!pathname.includes("/projects") && (...)}` and `{pathname.includes("/projects") && (...)}`) currently form a pathname-based switch between "show the logo" and "show the up button." For `/about`, neither the logo nor the up button should show — the whole `<nav id="home-link">` region should effectively render nothing visible.

Change the first condition from `!pathname.includes("/projects")` to `!pathname.includes("/projects") && !pathname.includes("/about")`, so the logo is suppressed on both route types. Leave the second condition (`pathname.includes("/projects")`) untouched — the up-button should still only appear on `/projects`, not on `/about`. The net effect on `/about` is that neither branch renders, and the outer `<nav>` wrapper renders empty (matching how the component already behaves whenever both conditions are false — this is existing behavior, not new).

Watch out for: `pathname.includes("/about")` will also match any future nested route under `/about` (e.g. `/about/team`), which mirrors the existing loose-matching style already used for `/projects` and `/gallery` elsewhere in the codebase (`MainNav.js`, `MobileNav.js`), so this is consistent with current conventions rather than a new risk.

### Step 2 — Build the hero section in `next/app/about/page.js`

The file is currently empty, so this is a full write, not an edit. Structure:

1. No imports are needed beyond `Image` from `next/image` for the photo. No `"use client"` directive — this stays a Server Component since there is no interactivity.
2. Export a default async or sync function component (sync is sufficient since there is no data fetching), e.g. `export default function About() { ... }`.
3. Root markup: a wrapping element establishing the section, using the page padding already provided by `<main className="px-5 lg:px-14">` in `layout.js` — do not re-add horizontal padding at this level, only vertical spacing (e.g. top/bottom margin or padding) so the section sits correctly under the nav/HomeLink area.
4. Headline: render the bold headline text ("We use image, story, and perspective, to help ideas take shape in the world, creating work that forms culture through creative vision." — use the exact wording from the screenshot) using `font-primary`, bold weight, and a large responsive size consistent with the site's existing heavy-headline styling (compare to `app/page.js`'s `font-primary text-2xl font-bold lg:text-xxl leading-[1.2]`), spanning the full width of the section above the two-column row, left-aligned.
5. Two-column row below the headline, using a 12-column Tailwind grid (`grid grid-cols-12 gap-8 lg:gap-16`), matching the pattern in `InfoContent.js`:
   - Left column (roughly `col-span-12 lg:col-span-6`, adjust to visually match the screenshot's proportions where the text column is narrower than the image column): three `<p>` elements, one per paragraph from the screenshot's body copy, in `font-secondary`, base/readable size (e.g. `text-sm` or `text-md` per the site's type scale in `tailwind.config.js`), with vertical spacing between paragraphs (`space-y-4` or similar).
   - Right column (roughly `col-span-12 lg:col-span-6`): a `relative` sized container (e.g. fixed aspect ratio via `aspect-[4/3]` or an explicit height at the `lg` breakpoint) containing a Next.js `Image` with `src="/about/1.png"`, `alt` text describing the image (e.g. "FLOWERS studio"), `fill`, and `style={{ objectFit: "cover" }}`.
6. On small screens, columns stack: because both columns use `col-span-12` at the base breakpoint and only diverge at `lg:`, the left (text) column will naturally render above the right (image) column in source order, giving headline → paragraphs → image, which is the desired mobile reading order — no extra ordering utilities needed.

Watch out for: `next/image` with `fill` requires the parent element to have `position: relative` and a defined height — without an explicit height (e.g. via `aspect-*` or a fixed `h-*` at each breakpoint), the image container will collapse to zero height. Also confirm `next.config.js` already allows local `/public` images with no extra configuration (it does — local `public/` assets never require `remotePatterns` config, unlike remote CMS images used elsewhere in the app).

This step depends on nothing else in this plan; Step 1 (HomeLink) and Step 2 (page content) are independent and can be done in either order, but are listed in this order because verifying the page renders (Step 2) is more meaningful once the layout above it is no longer showing the stray HomeLink logo (Step 1).

## 9. Edge Cases

- **Missing/renamed image file:** if `next/public/about/1.png` is ever moved or renamed, the `Image` component will fail to load (broken image, Next.js image optimization error in dev). No fallback is implemented, consistent with how other static images in the codebase (e.g., `FLOWERS-Full.svg` in `HomeLink.js`) have no fallback handling.
- **Nested future `/about` routes:** as noted in Step 1, `pathname.includes("/about")` will suppress the HomeLink on any route beginning with `/about`, not just the exact page. This is intentional and consistent with existing conventions, but should be revisited if a differently-themed sub-page under `/about` is ever added.
- **Very long paragraph text wrapping oddly against the image column on `lg` breakpoint:** if the three paragraphs are much taller than the image, the grid row will stretch to fit the taller column, potentially leaving large empty space beside the shorter column. Since `items-start` (default) is used implicitly by not setting `items-stretch`, columns should be visually reviewed at the `lg` breakpoint after implementation and `items-start` added explicitly to the grid row if the image is stretching taller than its `aspect-*` due to `items-stretch` grid default.
- **Empty `page.js` currently breaks the build/route entirely:** until this change lands, any deploy or dev server hitting `/about` would error. This plan directly fixes that as a side effect of Step 2.

## 10. Test Considerations

Manual checks (no automated tests exist for page layout in this codebase, so none are added):

- Run the dev server and visit `/about`; confirm the page renders without errors (previously it would have thrown due to the missing default export).
- Confirm the headline, three paragraphs, and image all appear, and that the image loads from `/about/1.png`.
- Resize the browser across the `lg` breakpoint (defined by Tailwind's default `lg` = 1024px, per `theme('screens.lg')` usage elsewhere in the codebase) and confirm the layout switches from stacked (mobile) to the two-column-with-full-width-headline layout (desktop) as described.
- Confirm the large centered FLOWERS `HomeLink` logo does NOT appear on `/about`, on desktop widths (`lg:block` — it's already hidden below `lg` regardless).
- Confirm the small top-left FLOWERS logo in the main nav (`MainNav.js`/`MobileNav.js`) still appears and still links to `/` when clicked from `/about`.
- Re-visit `/projects` and `/gallery` after the `HomeLink.js` change to confirm their existing behavior (logo hidden on `/projects`, up-button shown there, logo shown on `/gallery`) is unaffected by the added `/about` condition.
- Click the "About" link in the main nav from another page to confirm normal navigation into the new page works and the "active" nav state styling still applies (`MainNavLinks.js` already handles this via `checkLinkActive`).

## 11. Implementation Order

1. `next/components/HomeLink.js` — existing file, modified. Update first because it's a one-line, low-risk, easily-verified change, and having the HomeLink already suppressed makes it easier to visually judge the new hero section's spacing in the browser once Step 2 is done.
2. `next/app/about/page.js` — existing (empty) file, fully written. Add the hero section markup; this is the main deliverable and depends on nothing else in this plan.
