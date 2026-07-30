# Project Hover Image — Persist Until Next Hover

## 1. Goal

On the home page's project listing, hovering a project row shows a floating preview image. Currently, moving the cursor away from one project's row causes that image to fade out immediately, and the next project's image only fades in once its own row is hovered — producing a visible gap where no image is shown when moving quickly between adjacent rows. The goal is to make the image persist across that transition, only disappearing when the cursor leaves the entire project list, and swapping (crossfading) directly from one project's image to the next when hovering a different row.

## 2. Current System Behaviour

`next/app/page.js` is an async server component. It fetches project data, groups projects by client, and renders each project as a `ProjectLink` (`next/components/ProjectLink.js`) inside nested `client-group` divs.

`ProjectLink` is a client component that owns its own local `active` boolean via `useState`. On `mouseenter` (desktop viewport only, gated by `window.matchMedia("(min-width: 992px)")`) it sets `active` to `true`; on `mouseleave` it sets `active` back to `false`. It also tracks `xValue`, the cursor's x-offset within its own bounding box, updated on `mousemove`, used to position the floating image horizontally.

The floating image itself (`.project-hover-image`, containing a `DefImage`) is always rendered in the DOM for any project that has a `featuredImage`, but its visibility is controlled entirely by CSS: `next/styles/about.css` sets `opacity: 0` by default with a `transition: opacity .3s`, and `.project-link.active .project-hover-image { opacity: 1; }` reveals it.

Because `active` is local to each `ProjectLink` instance, leaving one link's row and entering another's are two independent, sequential state updates in two different components. The outgoing link fades its image out starting the instant `mouseleave` fires; the incoming link only starts fading its image in once its own `mouseenter` fires. There is no coordination between them, so during normal mouse travel between rows there is a brief window where both images are transitioning toward `opacity: 0`, reading as the image "disappearing" before the new one appears.

## 3. Desired Behaviour

- Hovering a project row shows that project's floating image, as today.
- Moving the cursor directly from one project row to another (without leaving the list) causes an immediate crossfade: the previous project's image fades out while the newly hovered project's image fades in, at the same time, with no intermediate gap.
- Moving the cursor off the entire project list (out of all rows and the surrounding whitespace/gaps between them) causes the currently shown image to fade out and disappear.
- Behaviour is unchanged on viewports below the `lg` breakpoint (990px), where hover images are not shown at all, matching current behaviour.
- The horizontal cursor-tracking behaviour of each image (the `translateX` follow effect) is unchanged.

## 4. Architecture Considerations

**Why a new wrapper component is required:** `page.js` is an async server component (it directly `await`s `getAboutData()`). React state (`useState`) cannot exist in a server component, so the "currently hovered project" state cannot live in `page.js` itself. A new client component, `ProjectsList`, will own this state and render everything currently inline in `page.js`'s `projects` block. `page.js` remains a server component, fetching and shaping data, then handing the already-grouped/ordered project data to `ProjectsList` as a prop.

**Why the state must be lifted above all client groups, not just within one:** Projects are grouped visually by client (`client-group` divs), but the user's mouse can move from the last project of one client group directly to the first project of the next group, and that transition should crossfade too. Therefore `ProjectsList` must wrap the *entire* `projects` block (all client groups), not each group individually.

**Why individual links must stop clearing state on their own `mouseleave`:** If each `ProjectLink` still cleared the shared state on its own `mouseleave`, the same race would reappear (outgoing link clears the shared value a moment before the incoming link sets it, or after — depending on browser event order — reintroducing a flicker window). Instead, only `mouseenter` on any link writes to the shared state (always overwriting, whichever project it is), and only a `mouseleave` on the outermost `ProjectsList` wrapper (meaning the cursor has left the whole list, not just one row) clears it. This guarantees the shared value only ever transitions directly from one project's slug to another's, or from a project's slug to `null` when truly leaving the list — never flickers to `null` mid-transition between two rows.

**Why `active` becomes a derived/controlled value instead of local state:** Each `ProjectLink` will compute its own active-ness as `activeSlug === project.slug` rather than owning a boolean. This is what allows two sibling `ProjectLink` instances to update in the same React render when the shared `activeSlug` changes — one loses the `active` class exactly as the other gains it, which is what makes the CSS crossfade (already driven by the existing `.3s` opacity transition) synchronized instead of sequential.

**No CSS changes anticipated.** The existing `.project-link.active .project-hover-image` opacity transition already performs a fade; the fix is about *when* the `active` class is applied/removed, not how the fade itself looks.

**Trade-off:** Lifting state up means every `ProjectLink` re-renders on every hover change (since `activeSlug` prop changes on the shared parent), rather than only the two involved links. Given the list size (project counts per site are small, images are already mounted, and re-renders are cheap prop comparisons), this is not a performance concern.

## 5. Data Flow

`page.js` fetches and shapes `orderedProjectsByClient` (array of `{ client, projects }`) exactly as it does today — this logic does not move. That array is passed as a single prop into `ProjectsList`.

`ProjectsList` owns `activeSlug` (string or `null`) in local state. It renders the `client-group` divs and, for each project, a `ProjectLink`, passing down two things: the current `activeSlug` value, and a callback (`onProjectHover`) that `ProjectLink` calls with its own `project.slug` on `mouseenter`. `ProjectsList` also attaches a `mouseleave` handler to its own outermost wrapping element, which calls the same callback with `null`.

`ProjectLink` no longer originates the "is this project's image showing" decision — it receives `activeSlug` as a prop and computes `active = activeSlug === project.slug` on each render. It still owns `xValue` locally (per-row cursor x-offset), since that is purely about positioning that row's own image and has no cross-row coordination requirement.

## 6. Component Responsibilities

### `ProjectsList` (new)

**Responsible for:**
- Owning `activeSlug` state (the slug of the project whose image should currently be visible, or `null`).
- Rendering the `client-group` structure and mapping projects to `ProjectLink`, exactly matching the JSX currently inline in `page.js`'s `projects` block (including the `sortByDate` sort per group).
- Providing the `mouseleave` handler on its outer wrapper that clears `activeSlug` to `null`.
- Providing the hover callback passed to each `ProjectLink`.

**Not responsible for:**
- Fetching, grouping, or ordering project data — that remains in `page.js` and arrives as a prop.
- Rendering the hover image itself — that stays inside `ProjectLink`.
- Any viewport/media-query gating — that remains inside `ProjectLink`, matching current placement.

**Props:**
- `projectsByClient` (array, required) — the already-grouped-and-ordered `[{ client, projects }]` data, passed through unchanged from `page.js`.

**Internal state:**
- `activeSlug` (string or `null`) — the currently hovered project's slug, or `null` when nothing in the list is hovered.

### `ProjectLink` (modified)

**Responsible for:**
- Rendering its own row (date, title, location) and its own floating hover image markup.
- Tracking its own `xValue` (cursor x-offset within its bounds) for image positioning, updated on `mousemove`.
- Calling the `onHover` callback with its own `project.slug` when the cursor enters its row (desktop viewport only).
- Computing whether it is currently the active/showing project by comparing the `activeSlug` prop to its own `project.slug`.
- Click tracking (`handleProjectClick`) — unchanged.

**Not responsible for:**
- Deciding when to clear the active state on leave — it no longer clears anything on its own `mouseleave`.
- Coordinating with sibling `ProjectLink` instances directly — coordination happens only through the shared `activeSlug` prop from `ProjectsList`.

**Props:**
- `project` (object, required) — unchanged, the individual project's data.
- `activeSlug` (string or `null`, required, new) — the slug of the currently active project, supplied by `ProjectsList`.
- `onHover` (function, required, new) — callback invoked with `project.slug` on `mouseenter` (desktop only).

**Internal state:**
- `xValue` (number) — unchanged, local cursor x-offset for image positioning.
- No longer owns `active`.

## 7. Files Affected

- **next/components/ProjectsList.js** (new) — hosts the lifted `activeSlug` state and renders the projects block currently inline in `page.js`.
- **next/app/page.js** — the inline `projects` block JSX is replaced with a single `ProjectsList` usage; grouping/ordering logic (`projectsByClient`, `orderedProjectsByClient`, `sortByDate`) stays here and is passed down as a prop.
- **next/components/ProjectLink.js** — removes local `active` state and its `mouseleave` handler; accepts `activeSlug` and `onHover` props; derives `active` by comparison; `mouseenter` now calls `onHover(project.slug)` instead of `setActive(true)`.

No CSS file changes are anticipated (see Architecture Considerations).

## 8. Step-by-Step Implementation

**Step 1 — Create `next/components/ProjectsList.js`.**
Build a new `"use client"` component that accepts a `projectsByClient` prop (the array currently built in `page.js` as `orderedProjectsByClient`). Move the JSX currently inside `page.js`'s `{orderedProjectsByClient.length > 0 && (...)}` block into this component, including the `sortByDate` comparator (move it here too, since it is only used for this rendering, not for data shaping). Add `activeSlug` state via `useState(null)`. Add a `handleHover(slug)` function that calls `setActiveSlug(slug)` — this single function serves both the "entered a row" case (called with that row's slug) and the "left the whole list" case (called with `null`). Attach `onMouseLeave={() => handleHover(null)}` to the outermost wrapper div (the one with class `projects ...`) so leaving the full list clears the active image. Pass `activeSlug={activeSlug}` and `onHover={handleHover}` to each `ProjectLink`.
*Gotcha:* the `mouseleave` handler must be on the outer `projects` wrapper, not on each `client-group` div — otherwise moving between two client groups would incorrectly clear the state before the next group's `mouseenter` fires, reintroducing the original flicker at group boundaries.

**Step 2 — Update `next/app/page.js`.**
Remove the `projects` block's inline JSX (the `.map` over `orderedProjectsByClient` and its nested `client-group`/`ProjectLink` rendering) and replace it with `<ProjectsList projectsByClient={orderedProjectsByClient} />`, keeping it inside the same `{orderedProjectsByClient.length > 0 && (...)}` guard. Remove the now-unused `sortByDate` function from `page.js` (it moves to `ProjectsList`). Remove the `ProjectLink` import from `page.js` (no longer used directly here) and add an import for `ProjectsList`.
*Gotcha:* `page.js` must remain a server component — do not add `"use client"` here or move the `getAboutData` fetch/grouping logic into `ProjectsList`.

**Step 3 — Update `next/components/ProjectLink.js`.**
Change the component signature from `({ project })` to `({ project, activeSlug, onHover })`. Remove the `const [active, setActive] = useState(false)` line and replace with a derived value: `const active = activeSlug === project.slug`. In `handleMouseEnter`, replace `setActive(true)` with `onHover(project.slug)`, keeping the existing `isLargeQuery` gate so this only fires on desktop viewports. Remove `handleMouseLeave` entirely (it no longer has a role, since clearing is now the wrapper's responsibility) and remove the `onMouseLeave={handleMouseLeave}` prop from the `<Link>`. Leave `handleMouseMove`, `xValue`, the click-tracking logic, and the JSX markup (including the `classNames` call driven by `active`) unchanged — `active` still feeds the same `classNames({ active: active })` call as before, so the CSS `.project-link.active` selector keeps working without modification.
*Gotcha:* `isLargeQuery` is currently computed once per render at the top of the component via `window.matchMedia`, before hooks — leave that pattern exactly as-is; do not refactor it as part of this change, since it is unrelated to the hover-state bug and outside scope.

## 9. Edge Cases

- **Rapid mouse movement across the gap between two rows (still inside the list wrapper):** `activeSlug` remains whatever it last was — the row-to-row gap is within the `ProjectsList` wrapper's bounds, so no `mouseleave` fires there, and the image correctly stays visible until a new row's `mouseenter` fires. This matches the desired "only disappears on full leave" behaviour.
- **Mouse leaves the list via a scroll or fast flick that skips over the wrapper's edge without a smooth `mousemove` sequence:** browsers still fire `mouseleave` on the element the cursor was last known to be over when it exits the viewport-tracked area, so this is handled by the standard DOM event, not something this implementation needs to special-case.
- **Touch devices / viewports below `lg`:** `isLargeQuery` gating in `handleMouseEnter` already prevents `onHover` from firing at all on these viewports, so `activeSlug` never becomes non-null and no image logic is exercised — unchanged from current behaviour.
- **Project without a `featuredImage`:** `ProjectLink` already conditionally renders the image markup only `{project.featuredImage && (...)}`. If such a project becomes the `activeSlug`, no image renders for it (correct), and if the cursor then moves to a project that *does* have an image, that image fades in normally since the previous "active" project had no image element to fade out in the first place.
- **Resizing the window across the `lg` breakpoint while a project is actively hovered:** `isLargeQuery` is only read at the moment of each event handler firing (not reactively watched), so an in-progress hover state simply stops updating on further events post-resize; this matches the existing component's behaviour today and is out of scope to change.

## 10. Test Considerations

**Manual checks (desktop viewport, ≥992px):**
- Hover a project row; confirm its image fades in.
- Move the cursor directly to an adjacent project row (same client group); confirm the first image fades out and the second fades in at the same time, with no visible gap of "nothing shown."
- Move the cursor from the last project of one client group directly to the first project of the next client group; confirm the same synchronized crossfade occurs across the group boundary.
- Move the cursor off the entire project list (e.g., down into the page's empty space below all groups, or up above the first group) without landing on another row; confirm the currently shown image fades out to nothing.
- Move the cursor quickly back and forth between two rows several times in succession; confirm no flicker or stuck images.
- Hover a project that has no `featuredImage`; confirm no image element appears, and confirm hovering a subsequent project with an image still works correctly afterward.
- Click a project row; confirm `handleProjectClick`/analytics tracking still fires (unchanged code path).

**Manual checks (viewport <992px, e.g. mobile emulation):**
- Confirm hover images never appear, and confirm tapping a project row still navigates to `/projects/[slug]` as before.

**Automated tests:** the codebase does not appear to have an existing component test suite for `ProjectLink` or the home page listing (none found in `next/components` or `next/app`); no automated test changes are planned unless the user requests introducing one. If desired, a future test could mount `ProjectsList` with two mock projects and assert that firing `mouseenter` on the second link's row while the first is active removes the `active` class from the first and adds it to the second synchronously.

## 11. Implementation Order

1. **next/components/ProjectsList.js** — new file. Created first since both other files depend on its existence/shape (its prop and callback names must be settled before wiring `page.js` and `ProjectLink` to it).
2. **next/components/ProjectLink.js** — existing file, modified second. Updating the consumer of `activeSlug`/`onHover` next means it can be built and reasoned about directly against the new `ProjectsList` contract.
3. **next/app/page.js** — existing file, modified last. Wiring the page to render `ProjectsList` last ensures both dependent pieces already exist and match, so this final step is a straightforward swap of inline JSX for a component usage.
