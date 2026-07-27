# Implementation Plan: Home Page Becomes the Work Page

## 1. Goal

Replace the content of the site's home route (`/`) with the content currently
shown at `/work`, delete the `/work` route entirely, and permanently redirect
any traffic hitting `/work` to `/`. The home-only carousel/hover feature that
currently lives at `/` is removed, not preserved. Navigation is simplified so
there is a single "Home" entry point instead of separate "Home" and "Work"
links pointing at what will become the same page.

## 2. Current System Behaviour

`/` is served by `next/app/page.js`, which calls `getHomeData()`
(`next/queries/homeQuery.js`) against the Kirby `home` content page and
renders `HomeContent` (`next/components/HomeContent.js`). `HomeContent` is a
client component that shows a rich-text description and, if carousel images
exist, a full-bleed image carousel (Swiper) that auto-opens six seconds after
load, with hover-driven "[view images]" prompts and left/right click zones.
This behaviour is coordinated through global state in `next/context/index.js`
(`homeCarouselOpen`, `homeCarouselData`, `homeCarouselClose`,
`homeCarouselSide`, `showViewImages`) and through `pathname === "/"` checks
inside `next/components/HomeLink.js`, which is the sticky wordmark/logo in
the site header rendered on every page via `next/app/layout.js`.

`/work` is served by `next/app/work/page.js`, which calls `getAboutData()`
(`next/queries/aboutQuery.js`) against the Kirby `about` page, the site's
`clients` structure, and the `Projects` page's children. It renders a
rich-text description, a static "Sub: fl0wers.substack.com" line, and a list
of projects grouped by client (ordered to match the site's client order,
projects within each group sorted by end/start date descending) using
`next/components/ProjectLink.js` for each project row.

Navigation currently exposes both pages separately:
- Desktop nav (`next/components/MainNavLinks.js`): "Gallery", "Work" (→
  `/work`), "Shop" (external).
- Mobile menu (`next/components/MobileMenu.js`): "Home" (→ `/`), "Gallery",
  "Work" (→ `/work`), "Shop" (external).
- `next/components/HomeLink.js` wordmark always links to `/`.

`next/app/sitemap.js` lists both `https://www.flowersfullservice.art` and
`https://www.flowersfullservice.art/work` as static routes. There is no
`redirects()` entry in `next/next.config.js` today.

`next/styles/home.css` (imported by `next/styles/global.css`) contains CSS
exclusively for `#home-carousel` and `#home-carousel-counter`, i.e. styling
for the feature being removed.

`next/components/InfoContent.js` uses the literal string `"/work"` only as a
sentinel value inside a hardcoded `clientLinks` object, to decide whether a
client name should render as plain text instead of a link. This is unrelated
to the actual `/work` route and Kirby's `about`/`clients` data — it does not
need to change.

## 3. Desired Behaviour

`/` renders exactly what `/work` renders today: the about description, the
"Sub:" line, and the client/project list — fetched via `getAboutData()`. The
home-only carousel/hover feature is gone completely: no Swiper carousel, no
"[view images]" prompt, no six-second auto-open timer, no related dispatches
in `HomeLink.js`.

`/work` no longer exists as a route. Any request to `/work` receives a
permanent (301) redirect to `/`.

The desktop nav no longer shows a separate "Work" link; "Gallery" and "Shop"
remain. The mobile menu keeps a single "Home" item pointing at `/` and drops
the separate "Work" item. The wordmark (`HomeLink.js`) continues to link to
`/` as before, but without any home-carousel-specific behaviour.

The sitemap only lists `/` (covering what was `/work`), plus project routes.
`homeQuery.js` and `HomeContent.js` are deleted as dead code, along with
their carousel-specific state in `context/index.js` and the `home.css`
stylesheet.

## 4. Architecture Considerations

- **Reuse over duplication**: `/work`'s JSX and data-fetching logic move into
  `app/page.js` essentially unchanged — this is a page-level content swap,
  not a rewrite. `ProjectLink.js` and `getAboutData()` are reused as-is.
- **Redirect at the framework level**: Use Next.js's built-in `redirects()`
  config in `next.config.js` rather than a custom route handler or
  client-side redirect. This is the documented, standard mechanism for
  permanent route consolidation in Next.js (App Router), is handled at the
  edge/server before any React rendering, and preserves SEO signal via a true
  301 status without extra code.
- **Deleting `app/work/`**: Once the directory is removed, any reference to
  `/work` that isn't caught by the `redirects()` rule (e.g., a stale
  bookmark, an external inbound link) would otherwise 404. The `redirects()`
  rule specifically targets `/work` so this is covered.
- **`pathname === "/"` logic in `HomeLink.js`**: This logic exists solely to
  drive the carousel feature being deleted. Because the carousel feature is
  removed in full, these branches become dead and are deleted rather than
  repointed — there is no remaining use case for home-specific behaviour in
  this component after this change.
- **Context cleanup scope**: `hideHomeLink` and `hideNav` in
  `context/index.js` are driven by scroll position on every route (not
  gated to `/`) and must be kept. Only the carousel/hover-specific state
  (`homeCarouselOpen`, `homeCarouselData`, `homeCarouselClose`,
  `homeCarouselSide`, `showViewImages`) and their reducer cases are removed.
- **CMS untouched**: Per explicit decision, Kirby content/blueprints for the
  `home` page are left in place even though the frontend will stop querying
  them. This avoids any Panel-side disruption or content loss; only the
  now-dead Next.js query file (`homeQuery.js`) is removed from the
  repository.
- **No new dependencies or coupling** are introduced by this change.

## 5. Data Flow

Before: `/` → `Home` (`app/page.js`) → `getHomeData()` → Kirby `home` page →
`{ description, carouselImages }` → `HomeContent` (client component) → UI.
`/work` → `Work` (`app/work/page.js`) → `getAboutData()` → three Kirby
queries (`about` page, `clients` structure, `Projects` children) → grouped/
sorted project data → server-rendered JSX → UI.

After: `/` → `Home` (`app/page.js`) → `getAboutData()` → same three Kirby
queries as before → same grouping/sorting logic → same server-rendered JSX
→ UI. Data flow is otherwise identical to the current `/work` page; only the
route it is served from changes. `/work` requests never reach application
code — they are intercepted by the Next.js redirect layer and re-issued to
`/` with a 301 before any data fetching occurs.

## 6. Component Responsibilities

### `app/page.js` (modified)
- **Responsible for**: being the default export for route `/`; calling
  `getAboutData()`; grouping projects by client; ordering client groups to
  match `site.clients`; sorting each client's projects by date descending;
  rendering the description, "Sub:" line, and project list; declaring page
  metadata (canonical URL `/`, already correct and unchanged).
- **NOT responsible for**: any carousel/hover UI (removed); fetching from
  the Kirby `home` page (no longer called).
- **Props**: none (this is a route-level Server Component, receives no
  external props).
- **Internal state**: none — pure server component, no client-side state.

### `components/ProjectLink.js` (unchanged)
- **Responsible for**: rendering a single project's row (date range, title,
  location, hover preview image), tracking click analytics.
- **NOT responsible for**: grouping or sorting — receives a single `project`
  already resolved by the caller.
- **Props**: `project` (object, required) — `{ title, slug, client,
  startDate, endDate, location, description, featuredImage }`.
- **Internal state**: `active` (bool, hover state), `xValue` (number, mouse
  X position for hover-image placement).

### `components/HomeLink.js` (modified)
- **Responsible for**: rendering the sticky wordmark link to `/` on every
  page; scroll-driven resize/hide animation of the wordmark (applies
  site-wide, not home-specific); showing the project caption overlay on
  `/projects/*` routes.
- **NOT responsible for** (after this change): any carousel open/close
  dispatch, any `showViewImages` dispatch — these branches are deleted.
- **Props**: none.
- **Internal state**: unchanged except removal of the two `handleHomeLink*`
  handlers whose only purpose was dispatching carousel state.

### `components/MainNavLinks.js` (modified)
- **Responsible for**: rendering desktop nav items — "Gallery" and "Shop"
  after this change (previously also "Work").
- **NOT responsible for**: mobile nav (handled separately by
  `MobileMenu.js`).
- **Props**: none.
- **Internal state**: none (reads `pathname` and global state for active-
  link styling and the commented-out carousel counter, which is deleted).

### `components/MobileMenu.js` (modified)
- **Responsible for**: rendering the full-screen mobile menu with "Home" (→
  `/`), "Gallery", "Shop" links after this change (previously also a
  separate "Work" item).
- **NOT responsible for**: desktop nav.
- **Props**: `socialLinks` (array, required, unchanged).
- **Internal state**: unchanged (`mobileMenuOpen` closes on pathname change).

### `context/index.js` (modified)
- **Responsible for**: global app state — mobile menu open/closed, nav/
  wordmark hide-on-scroll, current project title/captions for the caption
  overlay.
- **NOT responsible for** (after this change): home carousel state
  (`homeCarouselOpen`, `homeCarouselData`, `homeCarouselClose`,
  `homeCarouselSide`) or `showViewImages` — removed entirely, along with
  their reducer cases.

### `next.config.js` (modified)
- **Responsible for**: image remote patterns (unchanged) plus a new
  `redirects()` entry mapping `/work` → `/` with `permanent: true`.

## 7. Files Affected

- `next/app/page.js` — replace home content with the work page's
  data-fetching and JSX.
- `next/app/work/page.js` — deleted; route no longer exists.
- `next/components/HomeContent.js` — deleted; carousel UI no longer used
  anywhere.
- `next/queries/homeQuery.js` — deleted; no longer called by any page.
- `next/components/HomeLink.js` — remove `pathname === "/"` carousel/
  hover dispatch branches and their now-unused handlers.
- `next/components/MainNavLinks.js` — remove the "Work" nav item and the
  commented-out carousel-counter block that references removed state.
- `next/components/MobileMenu.js` — remove the separate "Work" menu item.
- `next/context/index.js` — remove carousel/hover-specific state and
  reducer cases.
- `next/styles/home.css` — deleted; only contained carousel-specific rules.
- `next/styles/global.css` — remove the `@import './home.css'` line.
- `next/next.config.js` — add `redirects()` with a permanent `/work` → `/`
  rule.
- `next/app/sitemap.js` — remove the separate `/work` entry (its content is
  now covered by `/`).

## 8. Step-by-Step Implementation

**Step 1 — Add the `/work` → `/` redirect in `next/next.config.js`.**
Add a `redirects()` async function to the exported config returning a single
rule: `source: "/work"`, `destination: "/"`, `permanent: true`. Do this
first so the redirect is in place before the old route is removed, avoiding
any window where `/work` 404s. Gotcha: `redirects()` must be an `async`
function returning an array, per Next.js's App Router config contract — a
plain array will not be picked up.

**Step 2 — Replace the content of `next/app/page.js` with the work page's
logic.** Change the import from `getHomeData` (`../queries/homeQuery`) and
`HomeContent` (`../components/HomeContent`) to `getAboutData`
(`../queries/aboutQuery`) and `ProjectLink` (`../components/ProjectLink`).
Replace the function body with the data destructuring, grouping, ordering,
and sorting logic currently in `next/app/work/page.js` (lines 12–55), and
replace the returned JSX with the current work page's JSX (lines 57–102).
Keep the existing `metadata` export in `page.js` unchanged — it already
declares the correct canonical URL for `/`. This is the central step; the
page's exported function name (`Home`) can stay as-is since it is not
rendered anywhere.

**Step 3 — Delete `next/app/work/` (the whole directory, containing just
`page.js`).** Safe once Step 2 has copied its logic and Step 1's redirect is
active.

**Step 4 — Delete `next/components/HomeContent.js`.** Confirm via search
that nothing else imports it (only `app/page.js` did, and that import was
removed in Step 2) before deleting.

**Step 5 — Delete `next/queries/homeQuery.js`.** Confirm nothing imports
`getHomeData` anymore (only `app/page.js` did, removed in Step 2).

**Step 6 — Clean up `next/components/HomeLink.js`.** Remove the
`handleHomeLinkClick`, `handleHomeLinkMouseEnter`, and
`handleHomeLinkMouseLeave` functions (they exist only to dispatch
`SET_HOME_CAROUSEL_OPEN` / `SET_SHOW_VIEW_IMAGES` when `pathname === "/"`).
Remove their wiring from the `<Link>` element (`onClick`,
`onMouseEnter`, `onMouseLeave` props on the wordmark link). Leave the
scroll-driven `useMotionValueEvent` block, `hideHomeLink`/`hideNav`
dispatches, and the `/projects` caption-overlay logic untouched — these are
not home-specific. Gotcha: don't remove `pathname.includes("/gallery")` or
`pathname.includes("/projects")` checks; only the `pathname === "/"` ones
tied to carousel dispatches go.

**Step 7 — Clean up `next/context/index.js`.** Remove
`homeCarouselOpen`, `homeCarouselData`, `homeCarouselClose`,
`homeCarouselSide`, and `showViewImages` from `initialState`, and remove
the corresponding `SET_HOME_CAROUSEL_OPEN`, `SET_HOME_CAROUSEL_DATA`,
`SET_HOME_CAROUSEL_CLOSE`, `SET_HOME_CAROUSEL_SIDE`, and
`SET_SHOW_VIEW_IMAGES` cases from the reducer. Keep `hideHomeLink`,
`hideNav`, `currentProjectTitle`, `currentProjectCaptions`,
`mobileMenuOpen` and their cases untouched. Do this after Steps 4 and 6 so
no remaining component still dispatches or reads the removed state.

**Step 8 — Remove the "Work" link from `next/components/MainNavLinks.js`.**
Delete the `<li className="col-span-2">` block containing the `/work` Link
(lines 71–79). Adjust the remaining `<li>` `col-span` values and the `<ul>`
grid column count (`grid-cols-9`) if needed so the two remaining items
("Gallery", "Shop") lay out correctly — check the rendered nav visually
after this change, since the grid was originally sized for three equal
items. Also delete the commented-out `CarouselInfo` component and its usage
comment (lines 11–47, 93–98) since it references now-removed
`homeCarouselOpen`/state naming — dead code referencing deleted concepts
should not remain even in comment form.

**Step 9 — Remove the "Work" item from `next/components/MobileMenu.js`.**
Delete the `<li>` block for the `/work` Link (lines 75–90), keeping "Home",
"Gallery", and "Shop" items and their existing `checkLinkActive` logic
unchanged.

**Step 10 — Delete `next/styles/home.css` and remove its import.** Delete
the file, then remove the `@import './home.css';` line from
`next/styles/global.css`. Confirm no other stylesheet or component
references `#home-carousel` or `#home-carousel-counter` selectors before
deleting (the `#home-carousel-counter` rules in `next/styles/nav.css` are
tied to the commented-out `CarouselInfo` block removed in Step 8 — leave
`nav.css` alone unless you also want to prune those now-truly-dead
selectors; functionally inert either way since nothing renders that
markup).

**Step 11 — Update `next/app/sitemap.js`.** Remove the
`https://www.flowersfullservice.art/work` entry from `staticRoutes`,
leaving only the root URL entry and the dynamically generated project
routes.

**Step 12 — Verify no dangling references remain.** Search the `next/`
directory for `HomeContent`, `homeQuery`, `getHomeData`, `homeCarousel`,
`showViewImages`, and `/work` to confirm every reference has been either
removed or (in the case of `InfoContent.js`'s unrelated `/work` sentinel
string) intentionally left alone.

## 9. Edge Cases

- **Stale external links or bookmarks to `/work`**: handled by the
  permanent redirect in Step 1; verify by requesting `/work` after deploy
  and confirming a 301 to `/`.
- **Search engines that have indexed `/work`**: the 301 signals link-equity
  transfer to `/`; no further action needed, but reindexing is not
  instantaneous and is outside this change's control.
- **Trailing slash or query strings on `/work`** (e.g. `/work?ref=...`):
  Next.js's `redirects()` matches the path; query strings are preserved and
  forwarded to the destination by default, so `/work?ref=x` → `/?ref=x`.
  Confirm this during manual testing.
- **`context/index.js` state removal breaking another consumer**: before
  deleting each reducer case, grep the whole `next/` tree (not just the
  files known to reference it) to make sure no other component reads
  `state.homeCarouselOpen` etc. — Step 12 covers this as a final sweep.
- **Client/project data missing or empty** (e.g. Kirby `Projects` page has
  no children, or `clients` structure is empty): this is pre-existing
  behaviour inherited unchanged from `/work` — `orderedProjectsByClient`
  will be an empty array and the `projects` block simply won't render,
  same as today.
- **`app/page.js` losing its "use client" boundary correctly**: `page.js`
  was and remains a Server Component (`async function`, no `"use client"`
  directive) both before and after this change — verify the new JSX (moved
  from `work/page.js`, which was also a Server Component) doesn't
  accidentally require client-only APIs; it doesn't, based on the reviewed
  source.

## 10. Test Considerations

**Manual checks after implementation:**
- Visit `/` and confirm it renders the about description, "Sub:" line, and
  the full client/project list identical to what `/work` showed before the
  change (spot-check a few clients' project groupings and ordering).
- Visit `/work` directly and confirm a 301 redirect to `/` (check via
  browser devtools network tab or `curl -I`).
- Click every remaining nav link (desktop "Gallery"/"Shop", mobile "Home"/
  "Gallery"/"Shop") and confirm no broken links to `/work` remain anywhere,
  including `InfoContent.js`'s client list (should still render correctly
  since its `/work` string is just a non-route sentinel).
- Confirm no carousel, "[view images]" prompt, or six-second auto-open
  behaviour appears anywhere on `/`.
- Resize/scroll test on `/`: confirm the wordmark still shrinks/hides on
  scroll and the mobile menu still opens/closes correctly, since
  `hideHomeLink`/`hideNav`/`mobileMenuOpen` state must be unaffected by the
  context cleanup.
- Visit a `/projects/[slug]` page and confirm the caption overlay in
  `HomeLink.js` still works (unrelated to the carousel removal, but shares
  the same file — regression risk from Step 6's edit).
- Check `/sitemap.xml` output and confirm it lists `/` but not `/work`.
- Run a production build (`next build`) to catch any residual import errors
  from deleted files (`HomeContent`, `homeQuery.js`) that a dev-server hot
  reload might not surface.

**No automated test suite** was found in the repository during file
analysis; if one exists elsewhere, add/update coverage for the redirect and
for `app/page.js` rendering the work content, but this plan does not assume
such a suite exists.

## 11. Implementation Order

1. `next/next.config.js` — existing file, modified: add the permanent
   `/work` → `/` redirect first so the route is never unreachable during
   the change.
2. `next/app/page.js` — existing file, modified: swap in the work page's
   data fetching and JSX; this is the core content change everything else
   supports.
3. `next/app/work/page.js` — existing file, deleted: safe once its logic is
   duplicated into `page.js` and the redirect is live.
4. `next/components/HomeContent.js` — existing file, deleted: no longer
   referenced after Step 2.
5. `next/queries/homeQuery.js` — existing file, deleted: no longer
   referenced after Step 2.
6. `next/components/HomeLink.js` — existing file, modified: strip
   carousel-dispatch branches now that `HomeContent.js` is gone.
7. `next/context/index.js` — existing file, modified: remove carousel/
   hover state and reducer cases now that no component dispatches or reads
   them.
8. `next/components/MainNavLinks.js` — existing file, modified: drop the
   "Work" nav item and dead carousel-counter comment block.
9. `next/components/MobileMenu.js` — existing file, modified: drop the
   separate "Work" menu item.
10. `next/styles/home.css` — existing file, deleted: only styled the
    removed carousel markup.
11. `next/styles/global.css` — existing file, modified: remove the import
    of the deleted stylesheet.
12. `next/app/sitemap.js` — existing file, modified: remove the now-
    redundant `/work` sitemap entry.
