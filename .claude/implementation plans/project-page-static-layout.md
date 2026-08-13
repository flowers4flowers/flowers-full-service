# Project Page Static Layout & Short Description Field

## 1. Goal

Replace the current scroll-triggered, variable-width media layout on the project detail page (`/projects/[slug]`) with a static two-column layout: project text (title, meta, description) fixed on the left, and every media item (image or video) stacked in a single always-visible column of uniform width on the right, using native lazy loading instead of scroll-linked reveal animation.

Add a "short description" field to the Kirby CMS project blueprint that is always shown on the page, with the existing (long) description hidden behind a "Read More" toggle that expands inline underneath it.

## 2. Current System Behaviour

The route `next/app/projects/[slug]/page.js` fetches project data via `getProjectData` (`next/queries/projectQuery.js`) and renders `ProjectContent` (`next/components/ProjectContent.js`).

`ProjectContent` renders:
- A 12-column header grid: client, date range, then title + location.
- If `description` is present, a single always-visible block rendering `description` (already converted to HTML via `page.description.kirbyText` in the query) via `dangerouslySetInnerHTML`.
- A loop over `mediaContent` (an array of Kirby "imageSection" blocks), rendering one `MediaSection` per block.

`MediaSection` (`next/components/MediaSection.js`):
- Uses `framer-motion`'s `useInView` on the section's ref (`margin: "-50% 0px -50% 0px"`) to add a `show` class when the section crosses the viewport center.
- `.media-section` starts at `opacity: 0` and transitions to `opacity: 1` via the `.show` class (see `next/styles/project.css`).
- On `lg+`, each `.media-section` is pinned to `height: 100vh`, creating a full-viewport-height scroll-snap-like effect per block.
- Within a section, each media item's width is chosen dynamically: portrait images get `w-full lg:w-1/3`; landscape images or any video (`vimeoUrl`/`videoMp4`) get `w-full lg:w-5/12`. Items sit in a `flex flex-wrap` row, so a section's items appear side-by-side, not stacked.
- Images render through `DefImage` (`next/components/DefImage.js`), which wraps `next/image` and tracks an `onLoad` callback to toggle a `loaded` class, driving a CSS opacity fade-in independent of the section-level fade.
- Videos render through `VideoPlayer` (`next/components/VideoPlayer.js`), which shows a poster (`DefImage`) with a play button until clicked, then plays an inline `<video>` or Vimeo embed.

Data shape from `projectQuery.js`: `mediaContent` is an array of blocks, each with `slug` and a `media` array of items (`vimeoUrl`, `caption`, `videoMp4`, `media` — the poster/image file). This block grouping exists purely as a Kirby editorial structure (one "imageSection" block can hold multiple media items); it currently doubles as the visual grouping unit for the scroll-fade sections.

CMS blueprint `cms/site/blueprints/pages/project.yml` defines project fields in two columns: `title`, `start_date`, `end_date`, `location`, `description` (textarea), `client` on the left; `featured_image` and `media_content` (blocks) on the right. There is currently one description field, always rendered in full when present.

## 3. Desired Behaviour

- The project page shows a two-column layout on large screens: left column holds title, meta (client/dates/location), short description (always visible), and a "Read More" button that expands the full description inline below it. This column is sticky on `lg+` screens (stays in place while the right column scrolls) and stacks normally above the media column on mobile.
- The right column stacks every media item (image or video) from every block in `media_content`, in original order, flattened — block grouping is no longer used for layout (no more per-block `<section>` with its own fade/height). All items render at the same fixed column width; height follows each item's natural aspect ratio (no cropping).
- No scroll-linked fade-in/reveal remains. Images/videos are simply present in the DOM and become visible as soon as they load; lazy loading is delegated to `next/image`'s native `loading="lazy"` behavior (default), so offscreen images are not fetched until they approach the viewport, but there is no custom `IntersectionObserver` or opacity animation gating their appearance.
- The CMS gets a new `short_description` textarea field, always required to show below title/meta. The existing `description` field becomes the "full" text, hidden until "Read More" is clicked. If `short_description` is empty for a given project, the short-description block is simply omitted (no fallback truncation of the full description).

## 4. Architecture Considerations

- **Flattening media at the query layer vs. component layer**: Flattening is done in `projectQuery.js` by keeping the existing nested `page.media_content.toBlocks` → `block.media.toBlocks` query (Kirby's data model doesn't change — editors still work with `imageSection` blocks in the Panel), but the query result stays block-shaped. Flattening into a single ordered array of media items happens in `ProjectContent.js` immediately after the fetch (a single `.flatMap`), not in `MediaSection.js`, because `MediaSection.js` is being removed as a per-block wrapper entirely. This avoids touching the Kirby query/block schema (which would require Panel/content-file migration) while still giving the frontend a flat list. Trade-off: the frontend does the flattening work per request; this is negligible given typical project media counts.
- **Removing `MediaSection.js` vs. keeping it as a single non-looped wrapper**: `MediaSection.js` is deleted and replaced by inline rendering of a new `MediaItem` component per flattened media entry, since the "section" concept (block-level fade, 100vh height, flex-wrap row) no longer applies — the file's remaining responsibility (deciding image vs. video and passing sizing classes) is small enough to fold into one component without a wrapping section element per block.
- **Sticky left column**: implemented with CSS (`position: sticky; top: <value>`) on the left column's grid item, scoped to `lg+` via the existing Tailwind breakpoint convention (`lg:` prefixes matching current code, e.g. `line 35, 36, 42` in `ProjectContent.js`). This is a pure CSS change, no JS scroll listeners, keeping consistency with removing framer-motion scroll logic elsewhere on this page.
- **Removing framer-motion dependency from this page**: `useInView` is dropped from `MediaSection.js`. `framer-motion` itself is not uninstalled from `package.json` since it may be used elsewhere in the codebase (not verified as unused globally); only the usage on this page is removed.
- **Read More state**: `ProjectContent.js` is already a client component (`"use client"`), so a local `useState` boolean (e.g. `isFullDescriptionOpen`) is sufficient; no global app state (`useAppState`) involvement needed for this toggle, since it's page-local UI state, consistent with how `useAppState` is currently used only for the project title (nav breadcrumb), not content toggles.
- **Same-width images without cropping**: achieved by giving every media item's wrapping element a fixed width (e.g. `w-full` of the right column, which itself has a fixed column width from the grid) and letting `next/image` render `width`/`height` from the CMS file metadata so the browser reserves the correct aspect-ratio box (avoiding layout shift), while the rendered width is constrained by CSS (`w-full h-auto`) to the column width, not the image's intrinsic width.
- **CMS field addition is additive**: `short_description` is a new field key; no renaming of `description`, so no content-file migration script is required. Existing content files remain valid; they simply won't show a short description until an editor fills it in (per your instruction, the block is hidden when empty, not backfilled from `description`).

## 5. Data Flow

1. Kirby Panel: an editor fills in `short_description` (new field) and `description` (existing field) as separate textareas on the project page's blueprint form, alongside `media_content` blocks (unchanged block structure).
2. Kirby stores both fields as plain text/markdown in the page's content `.txt` file (`Short-description: ...`, `Description: ...` sections), following the same key-value format visible in the sample content file.
3. `getProjectData(slug)` in `projectQuery.js` queries the page and requests `shortDescription: "page.short_description.kirbyText"` in addition to the existing `description: "page.description.kirbyText"`, plus the existing `mediaContent` block query (unchanged shape).
4. `next/app/projects/[slug]/page.js` awaits `getProjectData(slug)` and passes the full `data` object to `ProjectContent` unchanged (no changes needed in `page.js` beyond what already exists, since it just forwards `data`).
5. `ProjectContent.js` destructures `shortDescription`, `description`, and `mediaContent` from `data.result`. It flattens `mediaContent` (array of blocks, each with a `media` array) into a single array of media items via `mediaContent.flatMap(block => block.media)`, preserving original order.
6. `ProjectContent.js` renders the left column with `shortDescription` (if non-empty) always visible, and a "Read More" button that toggles local state to reveal `description` inline beneath it (only rendered/expanded when `description` exists).
7. `ProjectContent.js` maps the flattened media array to a new `MediaItem` component (one per entry), rendering `DefImage` for images or `VideoPlayer` for videos, each at the same fixed column width.
8. No data flows back from the page to Kirby; this is a read-only content display page.

## 6. Component Responsibilities

### `ProjectContent.js` (existing, modified)
- **Responsible for**: overall two-column page layout; rendering title/meta header; rendering short description; owning and rendering the Read More toggle state and the full description reveal; flattening `mediaContent` into an ordered media list; mapping that list to `MediaItem` components; dispatching the project title to app state (unchanged existing behavior).
- **NOT responsible for**: deciding individual media item width/sizing (delegated to `MediaItem`/CSS), fetching data (delegated to `page.js`/`projectQuery.js`), video playback logic (delegated to `VideoPlayer`).
- **Props**: `data` (object, required) — the full Kirby fetch result, shape `{ result: { title, shortDescription, description, location, client, startDate, endDate, mediaContent, ... } }`. Unchanged prop signature from today, only the fields read from `data.result` change.
- **Internal state**: `isFullDescriptionOpen` (boolean, default `false`) — controls whether the full `description` block is expanded.

### `MediaItem.js` (new file, replaces `MediaSection.js`)
- **Responsible for**: rendering a single flattened media entry — choosing `DefImage` vs `VideoPlayer` based on presence of `vimeoUrl`/`videoMp4`, applying the fixed same-width wrapper class, rendering the caption if present.
- **NOT responsible for**: scroll detection, opacity/fade animation, grouping multiple items into a row, deciding overall column width (that's a layout-level class passed down or defined in `ProjectContent.js`/CSS, not computed per-item based on orientation).
- **Props**: `media` (object, required) — one entry from the flattened list, shape `{ vimeoUrl, caption, videoMp4, media: { url, width, height, alt, mime, type } }` (matches today's per-item shape from `projectQuery.js`, unchanged).
- **Internal state**: none.

### `DefImage.js` (existing, modified)
- **Responsible for**: rendering `next/image` with correct `src`/`alt`/`width`/`height`, relying on the library's built-in lazy loading.
- **NOT responsible for** (after this change): tracking load state or applying a fade-in transition class — this logic is removed.
- **Props**: unchanged signature (`src`, `alt`, `style`, `width`, `height`, `className`).
- **Internal state**: none after change (the `loaded` `useState` is removed).

### `VideoPlayer.js` (existing, unchanged)
- **Responsible for**: poster image + play button + inline/Vimeo playback, exactly as today.
- **NOT responsible for**: overall item width (still receives `className` from parent, but that value now comes from the new fixed-width scheme instead of orientation-based classes).
- **Props**: unchanged (`block`, `className`).

### `project.css` (existing, modified)
- **Responsible for**: defining the fixed media column width, stacked spacing between media items, and the sticky-left-column rule.
- **NOT responsible for**: any opacity/fade or `100vh` section rules — these are deleted.

### CMS blueprint `project.yml` (existing, modified)
- **Responsible for**: exposing `short_description` as a new Panel field alongside `description`.
- **NOT responsible for**: any migration of existing content values.

## 7. Files Affected

- `cms/site/blueprints/pages/project.yml` — add `short_description` textarea field to the left column's `data` section.
- `next/queries/projectQuery.js` — add `shortDescription` to the `select` object using `page.short_description.kirbyText`.
- `next/components/ProjectContent.js` — restructure to two-column layout, add Read More toggle state, flatten `mediaContent`, render `MediaItem` list instead of looping `MediaSection`.
- `next/components/MediaSection.js` — deleted.
- `next/components/MediaItem.js` — new file, single-item renderer replacing `MediaSection.js`'s per-item logic.
- `next/components/DefImage.js` — remove `loaded` state and fade-in class logic.
- `next/styles/project.css` — remove `.media-section` scroll/fade/100vh rules; add stacked-column and sticky-column rules.

No changes needed to `next/app/projects/[slug]/page.js` (already forwards the full `data` object and doesn't reference `description`/media shape directly), `VideoPlayer.js`, or `next/queries/kirbyFetch.js`.

## 8. Step-by-Step Implementation

### Step 1 — Add `short_description` field to the CMS blueprint
In `cms/site/blueprints/pages/project.yml`, add a new field under the existing `data` section (left column, `columns[0].sections.data.fields`), placed directly above the existing `description` field:

```
short_description:
  type: textarea
  label: Short Description
  size: small
```

Keep the existing `description` field as-is (label can optionally be updated to "Full Description" for Panel clarity, but the field key `description` must not change, to avoid a content migration). This is the only CMS change needed — Kirby content files don't need to be pre-populated; the field will simply be empty for existing projects until an editor fills it in.

Gotcha: field order in the YAML determines Panel form order, so placing it above `description` makes the editing experience match the page's visual order (short, then full).

### Step 2 — Fetch `shortDescription` in the query
In `next/queries/projectQuery.js`, add a new key to the `select` object in `getProjectData`, next to the existing `description` key:

```
shortDescription: "page.short_description.kirbyText",
```

Gotcha: use `kirbyText` (matching the existing `description` field's conversion) so any basic markdown/links entered in the short description render correctly as HTML, consistent with how `description` is already handled.

### Step 3 — Remove fade-in state from `DefImage.js`
Remove the `useState` import usage for `loaded`, the `onLoad` handler, and the conditional `loaded ? "loaded" : false` class construction. The component becomes a thin wrapper passing props straight to `next/image` plus the caller-supplied `className`. This must land before or alongside Step 5, since `MediaItem.js` will call `DefImage` and should not depend on the removed `loaded` class for any styling.

Gotcha: check `project.css` (and any other stylesheet) for `.def-image.loaded` selectors and remove them in Step 7 so no dead CSS remains.

### Step 4 — Delete `MediaSection.js` and create `MediaItem.js`
Delete `next/components/MediaSection.js`. Create `next/components/MediaItem.js` that accepts a single flattened `media` object (same shape as today's `block.media[index]` entries) and renders:
- If `media.videoMp4` or `media.vimeoUrl` is present: `<VideoPlayer block={media} className="media-item" />` (video renders inline as before, `VideoPlayer` itself is unchanged).
- Otherwise: a wrapper `<div className="media-item">` containing `<DefImage src={media.media.url} alt={media.media.alt} width={media.media.width} height={media.media.height} className="w-full h-auto" />`, and if `media.caption` is present, a `<p className="media-caption ...">` matching today's caption styling (reuse the existing caption class names from the deleted `MediaSection.js` for visual consistency, minus any hover-only opacity behavior that depended on the old section hover CSS — see Step 7).

Use a single shared class `media-item` (not per-item orientation classes) so every item gets the same fixed width purely from CSS (Step 7), matching the fixed-width, natural-aspect-ratio decision.

Gotcha: the old code used array index as key when mapping within a block; the new flattened list must use a stable key. Since flattened items don't have a natural unique id from the query, generate the key in `ProjectContent.js` at flatten time (e.g. combine block index and item index, `${blockIndex}-${itemIndex}`) and pass it down as the `key` prop when mapping — do not rely on `MediaItem.js` to produce its own key.

### Step 5 — Restructure `ProjectContent.js`
This is the main structural change:

1. Destructure `shortDescription` in addition to the existing fields from `data.result`.
2. Remove the two `console.log` debug lines (cleanup, unrelated to functionality but trivial to remove while touching this file).
3. Add `const [isFullDescriptionOpen, setIsFullDescriptionOpen] = useState(false);` (import `useState` from `react`).
4. Flatten media once near the top of the component body: `const mediaItems = mediaContent.flatMap((block, blockIndex) => block.media.map((item, itemIndex) => ({ ...item, key: \`${blockIndex}-${itemIndex}\` })));` — guard against `mediaContent` being empty/undefined (default to `[]` in the destructure or flatMap call) since a project could have no media blocks yet.
5. Replace the current single-grid section markup with a two-column layout: a left column div containing the existing header content (client/date/title/location, currently in the 12-col grid) plus, below it, the short description (rendered when `shortDescription` is truthy) and the Read More button; a right column div containing the mapped `mediaItems`.
6. Read More button: toggles `isFullDescriptionOpen`; label switches between "Read More" and "Read Less" (or similar) based on state; only rendered if `description` is truthy (if there's no full description at all, don't show a toggle for nothing to reveal).
7. Full description reveal: render the existing `dangerouslySetInnerHTML={{ __html: description }}` block conditionally on `isFullDescriptionOpen && description`, positioned directly below the short description/Read More button within the left column.
8. Right column maps `mediaItems` to `<MediaItem key={item.key} media={item} />`.

Gotcha: the left column must retain the `sticky` CSS class only at `lg+` (mobile keeps normal document flow, matching current responsive patterns like `lg:col-span-2` used elsewhere in this file). Gotcha: since the left column is sticky and can be shorter than the media column, ensure the sticky container has a bounded height/top offset so it doesn't overlap the site header/nav — check `next/styles/nav.css` and `MobileNav`/`HomeLink` header height (already being adjusted in the current branch's uncommitted changes) to pick a `top` offset that clears the fixed header; coordinate this value with whatever header height results from the in-progress nav changes on this branch.

### Step 6 — Verify `page.js` needs no changes
Confirm `next/app/projects/[slug]/page.js` still compiles: it only destructures `title`, `client`, `location`, `featuredImage` for metadata and passes the whole `data` object to `ProjectContent`, so no change is required here. This step is a verification checkpoint, not a code change.

### Step 7 — Update `project.css`
Remove the following rules entirely: `.media-section` (opacity/transition), `.media-section.show`, `.media-section .video-container button` transition/opacity rules tied to scroll reveal (keep the ones needed for the play-button hover/click behavior in `VideoPlayer`, since that's independent of scroll — re-verify which selectors are purely about the removed scroll-fade vs. the video play-button interaction before deleting, since both currently live under the same `.media-section` prefix), `.media-section .media-section-item` (100vh/flex-column rules), and the `@media (min-width: theme('screens.lg'))` block's `.media-section` height and `.media-section-item` margin/display rules.

Add new rules: a `.media-column` (or similar, applied to the right column wrapper) rule for spacing between stacked items (e.g. margin-bottom between `.media-item` entries) and a fixed width at `lg+` (matching the desired column width from the layout — coordinate exact width with the grid columns chosen in Step 5, e.g. if the left column is `lg:col-span-5` and right is `lg:col-span-6`, the media column's fixed width is implicitly the grid track width, so a percentage/`w-full` inside that grid cell suffices rather than a hardcoded pixel width). Add a `.sticky-column` (or equivalent) rule with `position: sticky; top: <header-height>;` for the left column, `lg+` only.

Re-attach the play-button hover styles (`.video-container button:hover svg path`) under whatever new class wraps videos, if the old selector path (`.media-section .video-container...`) no longer matches after the section wrapper is removed — this was flagged in the earlier gotcha as needing manual re-verification since it depended on the same parent class being deleted.

### Step 8 — Manual content check
Open one existing project (e.g. `2_rapha-pro-team-collection`) in the Panel after Step 1 to confirm the new `short_description` field appears and saves correctly, and confirm the page renders with the field empty (short-description block should not appear) before filling it in, then again after filling it in to confirm it appears and the Read More toggle correctly reveals the existing long `description` text for that project.

## 9. Edge Cases

- **Project with no `media_content` blocks at all**: `mediaContent` may be `undefined`/`[]`; the flatMap must not throw — default to an empty array so the right column simply renders nothing rather than erroring.
- **Project with `short_description` empty but `description` present**: per your instruction, hide the short-description block entirely; still show the Read More button (since full description exists) but there's nothing "short" above it — confirm this reads acceptably in the UI (a bare Read More button with no preceding text) since no fallback truncation was requested.
- **Project with `description` empty but `short_description` present**: show the short description; do not render a Read More button (nothing to expand).
- **Project with both empty**: neither block renders; no Read More button.
- **Media item missing both `media.media` (poster/image) and any video source**: matches today's existing potential gap (the original code already assumes `media.media` or a video source exists per item); no new handling required beyond what exists today, since this isn't part of the requested change.
- **Very tall media column vs. short text column with sticky positioning**: on very long project pages, the sticky left column will stay pinned for the whole scroll — confirm visually during Step 8 testing that this doesn't visually conflict with the footer when the media column ends (sticky elements should stop at the bottom of their grid cell in most browsers by default, but verify manually since Tailwind/CSS sticky can behave unexpectedly inside grid vs. flex parents).
- **Mobile (`<lg`) layout**: left column must not be sticky (would break normal mobile scroll UX) — ensure the sticky class is scoped with an `lg:` responsive prefix, not applied unconditionally.

## 10. Test Considerations

Manual checks (no automated test suite currently covers this page, based on the files reviewed):
- Load a project page with `short_description` filled in: confirm it displays, Read More button toggles the full description open/closed, and toggling doesn't cause layout jump in the media column.
- Load a project page with `short_description` empty: confirm no empty block/whitespace gap appears where it would have rendered.
- Load a project page with many media items (mixed portrait/landscape images and at least one video): confirm all items render at the same width, in original order, with no scroll-triggered fade (items should be visible in the DOM immediately, not requiring scroll to reach `opacity: 1`).
- Scroll a long project page on desktop: confirm the left column stays visibly pinned below the site header (not overlapping it) while the media column scrolls underneath.
- Resize to mobile width: confirm the left column is no longer sticky and stacks above the media column.
- Check Network tab: confirm below-the-fold images are not requested until scrolled near, verifying `next/image`'s native lazy loading is functioning (no `priority` prop causing eager load on every item).
- Confirm video items (`VideoPlayer`) still show poster image, play button, and play correctly (Vimeo and MP4 cases) inside the new stacked layout.
- Confirm the CMS Panel shows the new `short_description` field, that it saves to the content file, and that an existing project without the field set still loads/saves without error.

## 11. Implementation Order

1. `cms/site/blueprints/pages/project.yml` — existing file, modified: add `short_description` field first so the field exists in the Panel and content files before the frontend expects it.
2. `next/queries/projectQuery.js` — existing file, modified: fetch the new field next, so `ProjectContent.js` has `shortDescription` available in `data.result` when it's updated.
3. `next/components/DefImage.js` — existing file, modified: strip fade-in state early since both the new `MediaItem.js` and the existing `VideoPlayer.js` depend on this component and should be updated against its final form.
4. `next/components/MediaItem.js` — new file: create the replacement single-item renderer before deleting `MediaSection.js`, so there's no gap where media rendering is broken.
5. `next/components/MediaSection.js` — existing file, deleted: remove only after `MediaItem.js` exists and `ProjectContent.js` (next step) no longer references it.
6. `next/components/ProjectContent.js` — existing file, modified: the main layout/state rewrite, done after all its dependencies (query field, `MediaItem.js`, updated `DefImage.js`) are ready.
7. `next/styles/project.css` — existing file, modified: update styles last, once the final markup/class names from `ProjectContent.js` and `MediaItem.js` are settled, to avoid writing CSS against class names that change mid-implementation.
8. Manual Panel + browser verification (Step 8 / Section 10) — performed after all file changes, not a file change itself.
