# Implementation Plan: Deck Pages Redesign

## 1. Goal

The first deck portal implementation (`deck-portal.md`) modelled a deck as a
single scrolling page of mixed blocks with one deck-wide layout value. The studio
actually wants a deck to be a sequence of discrete pages, each on one of four
fixed layouts, viewed one at a time with forward/back navigation, like a slide
deck. This plan replaces the content model and the viewer while keeping the
authentication, session, and routing shell already built.

The four page layouts:

- `full-image` — image (or video) fills the page. No heading/text.
- `left-image` — image (or video) in the left column, heading/text blocks in the
  right column.
- `right-image` — image (or video) in the right column, heading/text blocks in
  the left column.
- `full-text` — heading/text blocks only, in a single centred column. No media.

## 2. Current System Behaviour

This describes the state after `deck-portal.md` was implemented. All of the
following exists and works:

- **Auth shell.** `next/utility/deckSession.js` signs/verifies a `deck_session`
  JWT cookie (`jose`, HS256, `PORTAL_SESSION_SECRET`), does a timing-safe
  password compare, and builds cookie options (path `/portal`, httpOnly,
  `sameSite: lax`, `secure` in production). `effectiveExpiry` caps the cookie
  lifetime at the deck's expiry date or 90 days.
- **Unlock route.** `next/app/(portal)/portal/[token]/unlock/route.js` handles
  `POST` only: reads `{ password }`, calls `getDeckSecret(token)`, returns 400
  (missing), 404 (unknown deck), 410 (expired), 401 (wrong password), or 200 with
  the `deck_session` cookie set.
- **Gate + render page.** `next/app/(portal)/portal/[token]/page.js` is a
  `force-dynamic` server component. It calls `getDeckForRender(token)` (→
  `notFound()` if null), checks expiry (renders an "expired" message), reads and
  verifies the `deck_session` cookie against `params.token`, and either renders
  `PasswordGate` (locked) or `DeckContent` (unlocked). It fetches block content
  only when unlocked. `generateMetadata` returns a generic title and
  `robots: { index: false, follow: false }`.
- **Password form.** `next/app/(portal)/portal/[token]/PasswordGate.js` is a
  client component: controlled password input, `POST` to
  `/portal/<token>/unlock`, `router.refresh()` on success, distinct messages for
  401 / 410 / network.
- **Portal layout.** `next/app/(portal)/layout.js` renders the FLOWERS logo
  header and a flush content wrapper (no shared `Container`), with group-level
  `robots: noindex`. `<html>`/`<body>`/providers come from the root layout.
  `next/app/(site)/layout.js` holds the public-site chrome; every public route
  lives under `next/app/(site)/`.
- **Deck renderer (to be removed).** `next/components/DeckContent.js` is a client
  component that takes `layout`, `blocks`, `intro`, `title`, `client` and maps a
  flat block array: `heading` → `<h*>`, `text` → `rich-text` div, `imageSection`
  → the existing `MediaItem` per media entry. Wrapper class `deck deck-<layout>`.
- **Queries.** `next/queries/deckQuery.js` exports:
  - `getDeckForRender(token)` — `title`, `client`, `parentSlug`, `layout`,
    `expiry`; returns `null` unless the resolved page's parent slug is `decks`.
  - `getDeckSecret(token)` — `password`, `expiry`, `parentSlug`; same guard.
  - `getDeckContent(token)` — `intro` (kirbytext) plus `body` blocks via
    `page.body.toBlocks`, with the `imageSection` → nested `media` shape copied
    from `projectQuery.js`.
  All three call `kirbyFetch` (KQL `POST`, `Authorization: Basic`,
  `cache: "no-store"`) with `query: site.page("page://<sanitised token>")`.
  `sanitizeToken` strips everything except `[A-Za-z0-9]`.
- **Kirby blueprints (on SiteGround, not in the repo build).**
  `cms/site/blueprints/pages/deck.yml` currently has: `title`, `client` (text),
  `password` (text), `layout` (select: editorial / grid / full-bleed), `expiry`
  (date), `intro` (textarea), `body` (blocks: `heading`, `text`, `imageSection`).
  `cms/site/blueprints/pages/decks.yml` is the container listing `deck` children.
  `cms/site/blueprints/site.yml` has a `Decks` tab. `cms/content/<n>_decks/decks.txt`
  is the container page. A `client_link` info field was proposed but not yet
  added.
- **Media components (reused unchanged).** `next/components/MediaItem.js` takes a
  `media` object and renders `VideoPlayer` when `media.videoMp4` or
  `media.vimeoUrl` is truthy, otherwise `DefImage` (`next/image` wrapper) plus an
  optional `caption`. `VideoPlayer` handles mp4 `<video>` and
  `@u-wave/react-vimeo`.
- **Styling.** `next/styles/deck.css` holds `.deck`, `.deck-editorial`,
  `.deck-grid`, `.deck-full-bleed`. Imported from `next/styles/global.css`.
  Partials use `@apply` and `theme('screens.lg')`; root font-size is 10px.
- **Available libraries.** `framer-motion@10`, `swiper@11`, `classnames`,
  `next@14.0.1` (App Router). Tailwind `theme.fontSize` is fully overridden:
  only `sm/md/base/lg/xl/xxl` exist (no `2xl`/`3xl`).

The KQL plugin (`cms/site/plugins/kql`) allows: `site.page(...)`; model field
access via `content()->get()` for unknown methods; `Field` methods `value`,
`or`, `isNotEmpty`, plus all registered field methods (`toDate`, `kirbytext`,
`toBlocks`, `toFile`, `toFiles`); model methods including `children`, `find`,
`index`, `parent`, `slug`, `title`, `content`, `num`, `status`. Note `content`
is a reserved model method — a content field named `content` is unreachable, so
block fields are named `body`.

## 3. Desired Behaviour

- A deck in the Kirby Panel contains an ordered list of child "deck pages". The
  studio adds, reorders (drag), and deletes them like any Kirby subpages.
- Each deck page has: a `layout` select (the four values above), a single image
  file, an optional mp4 file, an optional Vimeo URL, and a `body` blocks field
  containing only `heading` and `text` blocks.
- The deck itself keeps `title`, `client`, `password`, `expiry`, `intro`, and
  gains a `client_link` info field that displays the full shareable portal URL
  for copy-paste. The deck-level `layout` and `body` fields are removed.
- The portal shows exactly one "slide" at a time:
  - `/portal/<uuid>` renders an auto-generated **cover** slide: deck `title`,
    `client`, and `intro` (if set). This is also where the password gate appears
    when locked or the "expired" message when expired.
  - `/portal/<uuid>/<n>` renders content page `n` (1-indexed, in Panel sort
    order). `n` out of range → 404. Locked → redirect to `/portal/<uuid>`.
- Navigation (present on both cover and content pages once unlocked):
  - Previous / next controls rendered as real links (`<Link>`), so each slide is
    a normal navigable URL with browser back/forward support and prefetch.
  - `ArrowLeft` / `ArrowRight` keyboard shortcuts.
  - Horizontal swipe on touch devices.
  - A counter showing `n / N` on content pages (N = number of content pages).
    The cover shows no counter.
  - From the cover, "previous" is hidden/disabled and "next" goes to page 1.
    From page 1, "previous" goes to the cover. From page N, "next" is
    hidden/disabled.
- Layout rendering:
  - `full-image`: the media fills the available width; body blocks are ignored
    even if present.
  - `left-image` / `right-image`: two columns at `lg` and up (image column and
    text column, 50/50 by default), the text column vertically centred. Below
    `lg` they stack with the image first, then the text, regardless of
    left/right.
  - `full-text`: body blocks in one centred, width-limited column.
- The deck view has no public-site chrome (inherited from the existing
  `(portal)` layout). All `/portal/*` responses stay `noindex`.
- Everything in the auth shell (Section 2, first six bullets) keeps working with
  no behavioural change.

## 4. Architecture Considerations

**Deck pages are real Kirby subpages, not a structure or blocks field.** Chosen
by the studio for drag-reordering and unlimited nesting of heading/text blocks
per page without the row-drawer friction of a `structure` field. Cost: a new
page blueprint, a `pages` section on `deck.yml`, and a template file. Because
rendering is entirely in Next via KQL, the `deckpage.php` template only needs to
exist (it can return an empty string or a minimal placeholder) so Kirby will let
the Panel assign the `deckpage` template; the Kirby front end is never hit for
these pages.

**Media fields live directly on the deck page, named to match `MediaItem`.** The
deck page carries `image` (single file), `video_mp4` (single file), `vimeo_url`
(text). The `getDeckPages` query aliases these into the exact object shape
`MediaItem` already consumes (`{ media: { url, width, height, alt }, videoMp4:
{ url, mime, type } | null, vimeoUrl: string, caption: string }`), so no media
component changes are needed. `caption` is not a deck-page field in v1; it is
passed as an empty string. This mirrors how `projectQuery.js` shapes
`imageSection` media.

**Each slide is its own server-rendered route; navigation is link-based.** Two
route files: the existing `[token]/page.js` (cover) and a new
`[token]/[page]/page.js` (content). This keeps every slide a shareable,
refresh-stable URL and lets Next prefetch the neighbouring slide. The trade-off
is no cross-slide animated transition without extra work (a `template.js` or a
client-side pager); v1 accepts instant navigation. The static `unlock` segment
still resolves before the dynamic `[page]` segment, so the unlock route is
unaffected; `[page]` is validated as a positive integer and anything else 404s.

**Auth/expiry/cookie checking is extracted into one helper.** A new
`next/utility/deckAccess.js` exposes `resolveDeckAccess(token)` returning
`{ status: "notfound" | "expired" | "locked" | "unlocked", meta }`. Both route
files call it so the gate logic exists once. `meta` is the `getDeckForRender`
result (now without `layout`). The cover route maps `locked` → render
`PasswordGate`, `expired` → message, `notfound` → `notFound()`. The content
route maps `locked` → `redirect("/portal/<token>")`, `expired` → redirect to the
same, `notfound` → `notFound()`; `unlocked` → render the page.

**`DeckNav` is the only client component in the viewer.** Server components
render each slide's static content; `DeckNav` (client) adds keyboard listeners,
a touch swipe handler, and renders the prev/next `<Link>`s and counter. It
receives the computed target hrefs as props (no routing logic of its own beyond
`useRouter().push` for key/swipe, using the same hrefs). This keeps interactive
JS minimal and slides server-rendered.

**`DeckContent.js` is deleted, not adapted.** Its flat-block model does not map
onto per-page layouts, and nothing else imports it. The cover route stops
importing it.

**No new dependencies.** Keyboard and swipe are a few lines of native event
handling; `framer-motion`/`swiper` are not needed for v1 and pulling `swiper`
into the portal for a non-animated pager would add weight for no benefit.

**Known limitations carried forward:** Kirby media files are public URLs (a
shared asset URL bypasses the gate); `kirbyFetch` uses `no-store` so every slide
navigation re-queries Kirby (acceptable at expected traffic; a short
`revalidate` can be added later). Both are unchanged from `deck-portal.md`.

## 5. Data Flow

**Authoring.** In the Panel, staff open a deck and use its `Pages` section to
create child `deckpage` pages. For each, they pick a `layout`, upload an `image`
(and optionally an `video_mp4` or paste a `vimeo_url`), and add `heading`/`text`
blocks in `body`. They drag to reorder. Kirby writes one folder per deck page
under the deck's content directory, each with a numeric sort prefix. The deck's
`client_link` info field shows `https://www.flowersfullservice.art/portal/<uuid>`
computed from the deck page's UUID; staff copy that plus the password into an
email.

**Cover request.** Client requests `/portal/<token>`.
`[token]/page.js` calls `resolveDeckAccess(token)`:
`getDeckForRender(token)` runs a KQL request for `title`, `client`, `parentSlug`,
`expiry`; if null or `parentSlug !== "decks"` → `notFound()`. Expiry in the past
→ "expired" message. Cookie read from `next/headers` `cookies()`, verified with
`verifyDeckToken`; `payload.deckId === token` → unlocked. Locked → render
`PasswordGate` with the deck title. Unlocked → fetch `getDeckPageCount(token)`
(or reuse a lightweight slice of `getDeckPages`) to know `N`, then render
`DeckCover` (title/client/intro) wrapped by `DeckNav` with `prevHref = null`,
`nextHref = N > 0 ? "/portal/<token>/1" : null`.

**Unlock.** Unchanged. `PasswordGate` → `POST /portal/<token>/unlock` → cookie
set → `router.refresh()` re-runs `[token]/page.js`, now unlocked, showing the
cover.

**Content page request.** Client navigates (link, key, or swipe) to
`/portal/<token>/<n>`. `[token]/[page]/page.js` validates `n` is a positive
integer (else `notFound()`), calls `resolveDeckAccess(token)`
(`notfound` → `notFound()`; `locked`/`expired` → `redirect("/portal/<token>")`),
then calls `getDeckPages(token)` which runs one KQL request for
`page.children.listed` selecting each child's `layout`, media fields (aliased),
and `body` blocks (`heading`/`text` only). If `n > pages.length` → `notFound()`.
It renders `DeckPage` for `pages[n-1]` wrapped by `DeckNav` with
`prevHref = n === 1 ? "/portal/<token>" : "/portal/<token>/<n-1>"` and
`nextHref = n < pages.length ? "/portal/<token>/<n+1>" : null`, and
`counter = "<n> / <pages.length>"`.

**Rendering a page.** `DeckPage` switches on `layout`:
`full-image` → `MediaItem` only (media object from the aliased query fields);
`left-image` / `right-image` → a two-column wrapper with `MediaItem` in one
column and the mapped `body` blocks (`heading` → `<h*>`, `text` → `rich-text`
div) in the other; `full-text` → the mapped blocks in a centred column.
`DefImage`/`VideoPlayer` load media from the Kirby host already allowlisted in
`next.config.js`.

## 6. Component Responsibilities

### `next/app/(portal)/portal/[token]/page.js` — server component (modified)

- **Responsible for:** the cover slide. Calling `resolveDeckAccess`; rendering
  `PasswordGate` (locked), the expired message (expired), `notFound()`
  (notfound); when unlocked, determining `N` and rendering `DeckCover` inside
  `DeckNav`. Keeps `force-dynamic` and the `noindex` `generateMetadata`.
- **Not responsible for:** password comparison, cookie writing, per-page
  layout rendering, page-number validation.
- **Props:** `{ params: { token } }`.
- **State:** none.

### `next/app/(portal)/portal/[token]/[page]/page.js` — server component (new)

- **Responsible for:** one content slide. Validating `params.page` is a positive
  integer; calling `resolveDeckAccess` and redirecting to `/portal/<token>` when
  not unlocked; fetching `getDeckPages`; bounds-checking `n`; rendering
  `DeckPage` for the selected page inside `DeckNav` with computed prev/next
  hrefs and the counter string. Exports `force-dynamic` and a `noindex`
  `generateMetadata`.
- **Not responsible for:** the cover, auth mechanics beyond calling the helper,
  layout-specific markup (delegated to `DeckPage`).
- **Props:** `{ params: { token, page } }`.
- **State:** none.

### `next/utility/deckAccess.js` — helper module (new)

- **Responsible for:** `resolveDeckAccess(token)` — run `getDeckForRender`,
  classify into `notfound` / `expired` / `locked` / `unlocked` by combining the
  null check, the expiry check, and the `deck_session` cookie verification
  (`cookies()` + `verifyDeckToken`, `payload.deckId === token`). Return
  `{ status, meta }`.
- **Not responsible for:** rendering, redirecting (callers decide), fetching page
  content.
- **Exports:** `resolveDeckAccess`.
- **Note:** imports `next/headers` `cookies`, so it is server-only; keep it out
  of any client bundle.

### `next/components/DeckCover.js` — server component (new)

- **Responsible for:** presentational cover — deck `title` (large), `client`,
  and `intro` HTML (`rich-text` div) when present. Static markup only.
- **Not responsible for:** navigation controls, data fetching, auth.
- **Props:** `title: string` (required), `client: string` (optional),
  `intro: string` (optional, kirbytext HTML).
- **State:** none.

### `next/components/DeckPage.js` — server component (new)

- **Responsible for:** rendering one deck page by `layout`. For
  `left-image`/`right-image`/`full-image` it renders `MediaItem` with the passed
  `media` object. For `left-image`/`right-image`/`full-text` it maps `blocks`
  (`heading` → `<h1>`–`<h6>` by `level`, default `h2`, plain text;
  `text` → `<div className="rich-text" dangerouslySetInnerHTML>` from the
  kirbytext HTML). Applies the wrapper class
  `deck-page deck-page--<layout>` and, for split layouts, an
  `is-image-<left|right>` modifier so CSS can place the columns.
- **Not responsible for:** navigation, fetching, deciding which page is current,
  video playback internals (delegated to `MediaItem`/`VideoPlayer`).
- **Props:** `layout: "full-image" | "left-image" | "right-image" | "full-text"`
  (required); `media: { media: { url, width, height, alt } | null, videoMp4:
  { url, mime, type } | null, vimeoUrl: string, caption: string }` (required for
  non-`full-text` layouts, ignored for `full-text`); `blocks: Array<{ type,
  html, text, level }>` (required, may be empty).
- **State:** none.

### `next/components/DeckNav.js` — client component (new)

- **Responsible for:** wrapping slide content and providing navigation. Renders
  `children`, a previous control (`<Link href={prevHref}>` when `prevHref` is
  non-null, otherwise a disabled/hidden element), a next control (same with
  `nextHref`), and the `counter` text when provided. Adds a `keydown` listener
  (`ArrowLeft` → push `prevHref`, `ArrowRight` → push `nextHref`, ignored when
  the target is null or focus is in an input) and touch `touchstart`/`touchend`
  handlers computing horizontal delta (threshold ~50px) to push prev/next.
  Cleans up listeners on unmount.
- **Not responsible for:** computing hrefs (passed in), knowing about tokens or
  page counts, any data fetching, rendering the slide's inner content.
- **Props:** `children: ReactNode` (required); `prevHref: string | null`
  (required); `nextHref: string | null` (required); `counter: string | null`
  (optional) — e.g. `"3 / 8"`.
- **State:** none required; a `useRef` may hold the touch start X.

### `next/queries/deckQuery.js` — data module (modified)

- **Responsible for:** dropping `layout` from `getDeckForRender`'s select;
  adding `getDeckPages(token)` → ordered array of
  `{ layout, media, blocks }` from `page.children.listed`, aliasing the deck
  page's `image`/`video_mp4`/`vimeo_url` into the `MediaItem` shape and selecting
  `body.toBlocks` limited to `heading`/`text` fields (`type`, `html` =
  `block.text.kirbytext`, `text` = `block.text`, `level` = `block.level`).
  Optionally `getDeckPageCount(token)` (or the cover route reuses `getDeckPages`
  and reads `.length`).
- **Not responsible for:** auth, expiry logic, rendering shape beyond the alias.
- **Exports (after change):** `getDeckForRender`, `getDeckSecret` (unchanged),
  `getDeckContent` (removed — no longer used), `getDeckPages`, and optionally
  `getDeckPageCount`.

### `next/components/DeckContent.js` — deleted

- Superseded by `DeckCover` + `DeckPage` + `DeckNav`. No remaining importers
  after `[token]/page.js` is updated.

### Kirby `cms/site/blueprints/pages/deckpage.yml` — page blueprint (new)

- **Responsible for:** the deck page edit form — `layout` select, `image` files
  field (single, `query: page.images`), `video_mp4` files field (single, accept
  `video/mp4`), `vimeo_url` text, `body` blocks field (`fieldsets: [heading,
  text]`).
- **Not responsible for:** any deck-level field.

### Kirby `cms/site/blueprints/pages/deck.yml` — page blueprint (modified)

- **Responsible for:** deck-level fields only. Remove `layout` and `body`. Keep
  `title`, `client`, `password`, `expiry`, `intro`. Add `client_link` info field
  (`text: "https://www.flowersfullservice.art/portal/{{ page.uuid.id }}"`). Add a
  `pages` section (`create: deckpage`, `templates: [deckpage]`, `sortable: true`,
  `status: listed`).

### Kirby `cms/site/templates/deckpage.php` — template (new)

- **Responsible for:** existing so Kirby accepts the `deckpage` template
  assignment. Contents can be an empty file or a one-line placeholder; the Kirby
  front end never serves it.

## 7. Files Affected

### Kirby (edit locally for reference, upload via SiteGround file manager)

| File | New/Mod | Why |
| --- | --- | --- |
| `cms/site/blueprints/pages/deckpage.yml` | New | Deck page edit form (layout, media, body blocks). |
| `cms/site/templates/deckpage.php` | New | Lets Kirby assign the `deckpage` template; not rendered. |
| `cms/site/blueprints/pages/deck.yml` | Mod | Remove `layout`/`body`; add `client_link` info field and the child-pages section. |

### Next

| File | New/Mod | Why |
| --- | --- | --- |
| `next/queries/deckQuery.js` | Mod | Drop `layout` from `getDeckForRender`; add `getDeckPages` (and optionally `getDeckPageCount`); remove `getDeckContent`. |
| `next/utility/deckAccess.js` | New | Single source of truth for notfound/expired/locked/unlocked. |
| `next/app/(portal)/portal/[token]/page.js` | Mod | Cover slide: use `resolveDeckAccess`, render `DeckCover` in `DeckNav`; stop importing `DeckContent`. |
| `next/app/(portal)/portal/[token]/[page]/page.js` | New | One content slide by number, with redirect-on-locked and bounds checks. |
| `next/components/DeckCover.js` | New | Presentational cover. |
| `next/components/DeckPage.js` | New | Per-layout page renderer. |
| `next/components/DeckNav.js` | New | Client-side prev/next links, keyboard, swipe, counter. |
| `next/components/DeckContent.js` | Deleted | Replaced by the three components above. |
| `next/styles/deck.css` | Mod | Replace editorial/grid/full-bleed rules with the four `deck-page--*` layouts, split columns, and mobile stacking; add cover and nav styles. |

Unaffected: `deckSession.js`, `unlock/route.js`, `PasswordGate.js`,
`(portal)/layout.js`, `(site)/layout.js`, `app/layout.js`, `MediaItem.js`,
`VideoPlayer.js`, `DefImage.js`, `next.config.js`, `robots.txt`, `sitemap.js`.

## 8. Step-by-Step Implementation

### Step 1 — `next/queries/deckQuery.js`

- In `getDeckForRender`, delete the `layout` entry from the `select` object and
  from the returned object. The cover route no longer needs it and content pages
  carry their own layout.
- Add `getDeckPages(token)`:
  - Sanitise `token` with the existing `sanitizeToken`; return `[]` if invalid.
  - KQL body: `query: site.page("page://<id>")`, `select` a single key
    `pages` with `query: "page.children.listed"` and a nested `select`:
    - `layout: "page.layout.value"`
    - `caption` is not selected (deck pages have no caption field in v1).
    - `image`: `{ query: "page.image.toFile", select: { url: true, width: true,
      height: true, alt: true } }`
    - `videoMp4`: `{ query: "page.video_mp4.toFile", select: { url: true,
      mime: true, type: true } }`
    - `vimeoUrl: "page.vimeo_url"`
    - `body`: `{ query: "page.body.toBlocks", select: { type: true, html:
      "block.text.kirbytext", text: "block.text", level: "block.level" } }`
  - Normalise each returned child into
    `{ layout: <string or "full-text" fallback>, media: { media: <image or
    null>, videoMp4: <obj or null>, vimeoUrl: <string>, caption: "" },
    blocks: Array.isArray(body) ? body : [] }`.
  - Return the array (empty if `result.pages` is missing).
- Optionally add `getDeckPageCount(token)` selecting
  `count: "page.children.listed.count"`; if KQL rejects `.count` in a select
  string, skip this and let the cover route call `getDeckPages(token)` and read
  `.length`. Prefer the simpler path: no `getDeckPageCount`, cover route reuses
  `getDeckPages`.
- Remove `getDeckContent` and its helper usage.
- Gotcha: `page.children.listed` returns only pages with a numeric sort prefix
  (status "listed"). The `deck.yml` pages section must create listed pages
  (Step 8). Draft deck pages will not appear.
- Gotcha: `layout` may be empty if a page was created before a value was picked;
  default it to `full-text` (the only layout that renders sensibly with no
  media).
- Connects to: every renderer step consumes this shape; `MediaItem` needs
  `media.media.url` etc., which the alias produces.

### Step 2 — `next/utility/deckAccess.js`

- Export `async function resolveDeckAccess(token)`:
  - `const meta = await getDeckForRender(token)`; if `!meta` return
    `{ status: "notfound", meta: null }`.
  - If `meta.expiry` and `new Date(meta.expiry) < new Date()` return
    `{ status: "expired", meta }`.
  - `const cookieValue = cookies().get(DECK_SESSION_COOKIE)?.value`;
    `const payload = cookieValue ? await verifyDeckToken(cookieValue) : null`;
    `const unlocked = payload?.deckId === token`.
  - Return `{ status: unlocked ? "unlocked" : "locked", meta }`.
- Import `cookies` from `next/headers`, `getDeckForRender` from
  `../queries/deckQuery`, `DECK_SESSION_COOKIE` + `verifyDeckToken` from
  `./deckSession`.
- Gotcha: this must only ever be imported by server components / route handlers.
  Do not import it from a `"use client"` file.
- Connects to: both slide routes call this instead of repeating the logic.

### Step 3 — `next/components/DeckCover.js`

- Server component (no `"use client"`). Props `title`, `client`, `intro`.
- Render a wrapper `div.deck-cover` with an `<h1>` for `title`, a `<p>` for
  `client` when present, and a `rich-text` `div` with
  `dangerouslySetInnerHTML={{ __html: intro }}` when `intro` is truthy.
- No scroll reset needed (server component, and slides are short); if a reset is
  wanted it belongs in `DeckNav` (client) on route change.
- Connects to: rendered by the cover route inside `DeckNav`.

### Step 4 — `next/components/DeckPage.js`

- Server component. Props `layout`, `media`, `blocks`.
- Define a local `renderBlocks(blocks)` that maps:
  - `type === "heading"` → a heading element whose tag is `block.level` when it
    matches `/^h[1-6]$/`, else `h2`; text content `block.text` (plain).
  - `type === "text"` → `<div className="deck-page__text rich-text"
    dangerouslySetInnerHTML={{ __html: block.html }} />`.
  - anything else → nothing.
  - keys: array index.
- Switch on `layout`:
  - `full-image` → `<div className="deck-page deck-page--full-image">` containing
    `<MediaItem media={media} />` only.
  - `full-text` → `<div className="deck-page deck-page--full-text">` containing
    `renderBlocks(blocks)` in a `div.deck-page__text-col`.
  - `left-image` / `right-image` → `<div className={"deck-page deck-page--" +
    layout}>` containing a `div.deck-page__media-col` with `<MediaItem
    media={media} />` and a `div.deck-page__text-col` with
    `renderBlocks(blocks)`. DOM order: media column first, text column second;
    CSS handles visual left/right via the `deck-page--right-image` modifier
    (e.g. `order` on the columns at `lg`). Keeping DOM order fixed gives the
    "image first on mobile" behaviour for free.
  - unknown `layout` → treat as `full-text`.
- Guard: if a non-`full-text` layout has `media.media == null && media.videoMp4
  == null && !media.vimeoUrl`, render the media column empty (do not crash);
  `MediaItem` would throw on `media.media.url` if called with an empty image and
  no video, so branch: only render `<MediaItem>` when there is something to show,
  otherwise render an empty `div.deck-page__media-col`.
- Import `MediaItem` from `./MediaItem`.
- Connects to: rendered by the content route inside `DeckNav`; consumes Step 1's
  shape.

### Step 5 — `next/components/DeckNav.js`

- `"use client"`. Props `children`, `prevHref`, `nextHref`, `counter`.
- `const router = useRouter()` from `next/navigation`.
- `useEffect` for keydown: on `ArrowLeft` push `prevHref` if non-null; on
  `ArrowRight` push `nextHref` if non-null; ignore when
  `event.target` is an `INPUT`/`TEXTAREA` or `event.metaKey/ctrlKey`. Add and
  remove the listener on `window`. Re-run when `prevHref`/`nextHref` change.
- `useEffect` (or inline handlers on the wrapper) for touch: record
  `touchstart` `clientX` in a ref; on `touchend` compute `deltaX`; if
  `deltaX < -50` push `nextHref`; if `deltaX > 50` push `prevHref`; ignore when
  the corresponding href is null or vertical movement dominates.
- Render: a `div.deck-nav` wrapping `children`, then a `div.deck-nav__controls`
  containing:
  - previous: when `prevHref` render `<Link href={prevHref}
    className="deck-nav__prev" aria-label="Previous">`; else render the same
    element with `aria-disabled` and no `href` (or omit it).
  - `counter` when non-null → `<span className="deck-nav__counter">{counter}</span>`.
  - next: mirror of previous with `nextHref`.
- Gotcha: `<Link>` prefetches by default in production — good, the neighbouring
  slide loads ahead of the click. No action needed.
- Gotcha: keep the keydown listener passive to typed input by the
  INPUT/TEXTAREA check; the password field is on the cover only when locked, and
  `DeckNav` is not rendered in that state, but the check is cheap insurance.
- Connects to: both routes wrap their slide in this; hrefs and counter are
  computed server-side and passed down.

### Step 6 — `next/app/(portal)/portal/[token]/page.js`

- Replace the body of the default export:
  - `const { status, meta } = await resolveDeckAccess(params.token)`.
  - `status === "notfound"` → `notFound()`.
  - `status === "expired"` → return the existing "This link has expired."
    message block.
  - `status === "locked"` → `return <PasswordGate token={params.token}
    deckTitle={meta.title} />` (unchanged).
  - `status === "unlocked"`:
    - `const pages = await getDeckPages(params.token)`.
    - `const nextHref = pages.length > 0 ? \`/portal/${params.token}/1\` : null`.
    - `return <DeckNav prevHref={null} nextHref={nextHref} counter={null}>
      <DeckCover title={meta.title} client={meta.client} intro={meta.intro} />
      </DeckNav>`.
- `meta.intro`: `getDeckForRender` currently does not select `intro`. Add
  `intro: "page.intro.kirbytext"` to its `select` and returned object in Step 1
  so the cover can show it. (Adjust Step 1 accordingly.)
- Remove the `import DeckContent` line and the `getDeckContent` import; add
  imports for `resolveDeckAccess`, `getDeckPages`, `DeckNav`, `DeckCover`.
- Keep `export const dynamic = "force-dynamic"` and `generateMetadata`.
- Gotcha: `notFound()` and `redirect()` throw; do not wrap the calls in
  `try/catch`.
- Connects to: shares `resolveDeckAccess` with Step 7; hands off to the viewer
  components.

### Step 7 — `next/app/(portal)/portal/[token]/[page]/page.js`

- New file. `export const dynamic = "force-dynamic"`. `generateMetadata` returns
  the same generic title + `robots: { index: false, follow: false }`.
- Default export `async function Page({ params })`:
  - `const n = Number(params.page)`; if `!Number.isInteger(n) || n < 1` →
    `notFound()`.
  - `const { status } = await resolveDeckAccess(params.token)`.
  - `status === "notfound"` → `notFound()`.
  - `status !== "unlocked"` (locked or expired) →
    `redirect(\`/portal/${params.token}\`)`.
  - `const pages = await getDeckPages(params.token)`.
  - `if (n > pages.length) notFound()`.
  - `const page = pages[n - 1]`.
  - `const prevHref = n === 1 ? \`/portal/${params.token}\` :
    \`/portal/${params.token}/${n - 1}\``.
  - `const nextHref = n < pages.length ? \`/portal/${params.token}/${n + 1}\`
    : null`.
  - `const counter = \`${n} / ${pages.length}\``.
  - `return <DeckNav prevHref={prevHref} nextHref={nextHref} counter={counter}>
    <DeckPage layout={page.layout} media={page.media} blocks={page.blocks} />
    </DeckNav>`.
- Imports: `notFound`, `redirect` from `next/navigation`; `resolveDeckAccess`
  from `../../../../../utility/deckAccess`; `getDeckPages` from
  `../../../../../queries/deckQuery`; `DeckNav` from
  `../../../../../components/DeckNav`; `DeckPage` from
  `../../../../../components/DeckPage`. Count the depth carefully: this file is
  one segment deeper than `[token]/page.js`, so it needs five `../` to reach
  `next/` (the same depth as the `unlock/route.js` file).
- Gotcha: the static `unlock` route at `[token]/unlock/route.js` resolves before
  this dynamic `[page]` segment for the path `/portal/<token>/unlock`; no
  conflict, but do not add a `page.js` under `unlock/`.
- Gotcha: `redirect()` must be called outside any `try/catch`.
- Connects to: consumes Step 1 and Step 2; renders Step 4 inside Step 5.

### Step 8 — `cms/site/blueprints/pages/deckpage.yml` (upload)

- `title: Deck page`.
- One column, `fields`:
  - `layout`: `type: select`, `required: true`, `default: full-text`,
    `options: { full-image: "Full image", left-image: "Left image",
    right-image: "Right image", full-text: "Full text" }`.
  - `image`: `type: files`, `label: Image`, `multiple: false`,
    `query: page.images`, `help: Image or video poster. Not used for Full text.`
  - `video_mp4`: `type: files`, `label: Video MP4`, `multiple: false`,
    `accept: video/mp4`, `help: Optional. Overrides Vimeo if set.`
  - `vimeo_url`: `type: text`, `label: Vimeo URL`, `help: Optional.`
  - `body`: `type: blocks`, `label: Text`, `fieldsets: [heading, text]`.
- Gotcha: `heading` and `text` are Kirby built-in block types; no plugin change.
- Connects to: `deck.yml`'s pages section creates pages with this blueprint;
  `getDeckPages` reads these exact field names.

### Step 9 — `cms/site/templates/deckpage.php` (upload)

- Create the file with a single line returning nothing meaningful, for example a
  PHP open tag and a comment, or an empty snippet. Kirby requires a template
  file to exist for a template name to be assignable in some configurations; if
  the deployed Kirby allows blueprint-only templates, this file is harmless
  either way.
- Gotcha: if the Kirby front end is reachable and someone visits
  `https://<kirby>/decks/<deck>/<deckpage>`, this returns a blank page. That URL
  is not linked anywhere and the portal never uses it. Acceptable.

### Step 10 — `cms/site/blueprints/pages/deck.yml` (upload, edit)

- Remove the `layout` field and the `body` field entirely.
- Keep `title`, `client`, `password`, `expiry`, `intro`.
- Add to the fields (column 1, after `expiry`):
  `client_link`: `type: info`, `label: Client link`,
  `text: "https://www.flowersfullservice.art/portal/{{ page.uuid.id }}"`.
  If `{{ page.uuid.id }}` renders literally, fall back to `{{ page.uuid }}` and
  document that staff strip the `page://` prefix.
- Add a second column (or a section in the existing layout) with a `pages`
  section:
  `type: pages`, `label: Pages`, `template: deckpage`, `create: deckpage`,
  `sortable: true`, `status: listed`.
- Gotcha: existing decks created under the old blueprint keep their old
  `layout`/`body` content in their `.txt` file; those keys are simply ignored
  after this change. The test deck `testing` should have its child pages added
  fresh.
- Gotcha: upload `deckpage.yml` and `deckpage.php` before this file so the
  `pages` section's `create: deckpage` has a valid target.
- Connects to: `getDeckPages` depends on children being listed pages with the
  `deckpage` template.

### Step 11 — `next/styles/deck.css`

- Remove `.deck`, `.deck-editorial`, `.deck-grid`, `.deck-full-bleed` and their
  media queries.
- Add:
  - `.deck-nav` — a wrapper; `min-height` to fill the viewport below the portal
    header so a single slide occupies the screen (e.g.
    `min-height: calc(100vh - <header height>)`), `display: flex`,
    `flex-direction: column`.
  - `.deck-nav__controls` — a row pinned at the bottom (or overlaid left/right):
    previous on the left, `counter` centred, next on the right; generous tap
    targets (min 44px). Use `theme('screens.lg')` only if the layout differs by
    breakpoint.
  - `.deck-nav__prev[aria-disabled="true"]`, `.deck-nav__next[aria-disabled]` —
    reduced opacity, `pointer-events: none`.
  - `.deck-cover` — centred column, large `title`, `client` under it, `intro`
    as `rich-text` with a readable `max-width` (~680px). Vertically centred in
    the available space.
  - `.deck-page` — fills the slide area; `display: flex` to allow vertical
    centring of content.
  - `.deck-page--full-image .media-item` — `width: 100%`; image/video sized to
    fit within the slide (`max-height: calc(100vh - <chrome>)`,
    `object-fit: contain` via the existing `media-contain` utility if needed).
  - `.deck-page--full-text .deck-page__text-col` — centred, `max-width` ~680px.
  - `.deck-page--left-image`, `.deck-page--right-image` — below `lg`: `display:
    flex; flex-direction: column;` with `.deck-page__media-col` first. At `lg`
    and up: `display: grid; grid-template-columns: 1fr 1fr; gap: <x>;
    align-items: center;` so the text column is vertically centred against the
    image. For `.deck-page--right-image` at `lg`, set
    `.deck-page__media-col { order: 2; }` and
    `.deck-page__text-col { order: 1; }` so the image sits on the right while DOM
    order (media first) keeps mobile "image first".
  - `.deck-page__text-col .rich-text` / `.deck-heading` spacing — carry over the
    sizing from the old `.deck .rich-text` rule (18px, line-height 1.4) renamed
    under the new classes.
- Gotcha: the portal header height is fixed by `(portal)/layout.js`
  (`py-8` on a ~40px logo ≈ 104px). Use a CSS variable or a comment noting the
  assumption so the `100vh - N` math is maintainable.
- Connects to: classes emitted by Steps 3, 4, 5.

### Step 12 — delete `next/components/DeckContent.js`

- Remove the file. Confirm no remaining imports:
  after Step 6 the only importer is gone. A repo-wide search for `DeckContent`
  must return nothing.
- Connects to: closes out the replaced renderer.

### Step 13 — build and manual QA

- Covered in Sections 10.

## 9. Edge Cases

- **Deck with zero child pages.** Cover renders; `nextHref` is `null`, next
  control disabled. `/portal/<token>/1` → `n > pages.length` → `notFound()`.
- **`/portal/<token>/0` or `/portal/<token>/abc` or negative.** `Number()` /
  `Number.isInteger` guard → `notFound()`.
- **`/portal/<token>/<n>` accessed while locked.** `resolveDeckAccess` returns
  `locked` → `redirect("/portal/<token>")`, which shows the password gate. After
  unlock the client lands on the cover, not the deep page (acceptable; a
  `returnTo` param is out of scope).
- **Deck page with a split/full-image layout but no media.** Query yields
  `media.media = null`, `videoMp4 = null`, `vimeoUrl = ""`. `DeckPage` renders
  an empty media column instead of calling `MediaItem` (which would throw on
  `media.media.url`). Studio guidance: always attach media to non-text pages.
- **Deck page with `full-image` layout but body blocks filled.** Blocks are
  ignored by `DeckPage`; no error. The blueprint still shows the `body` field
  (Kirby `when` cannot express "layout is not full-image" cleanly); this is a
  documented authoring note, not a bug.
- **`layout` empty on a child page.** `getDeckPages` defaults it to `full-text`.
- **Draft child pages.** `page.children.listed` excludes them; they will not
  appear in the deck. Studio must publish each deck page.
- **Video-only page (mp4 or Vimeo, no image).** `MediaItem` already branches on
  `videoMp4 || vimeoUrl` before touching `media.media`, so a null image is fine
  as long as a video is present. The `DeckPage` guard should therefore check
  "no image AND no video AND no vimeo" before skipping `MediaItem`.
- **Keyboard navigation while a video has focus.** The INPUT/TEXTAREA check does
  not cover `<video>`; arrow keys may both seek the video and change slide.
  Acceptable for v1; if it bites, extend the ignore check to `VIDEO` and
  `IFRAME` targets.
- **Swipe vs vertical scroll on a tall `full-text` page.** The touch handler
  must ignore gestures where `|deltaY| > |deltaX|` so scrolling does not trigger
  navigation.
- **Expiry passes mid-session.** Every slide route calls `resolveDeckAccess`,
  which re-checks expiry on each navigation; the next slide load redirects to the
  cover's expired message.
- **`PORTAL_SESSION_SECRET` missing.** `verifyDeckToken` returns `null` →
  `locked` everywhere → gate shown, no content served. Unlock route still returns
  500. Unchanged from `deck-portal.md`.
- **Old `getDeckContent` referenced somewhere unexpected.** Grep before deleting;
  the plan assumes only `[token]/page.js` imported it.
- **`next/image` host mismatch for deck-page media.** Same Kirby host as
  projects, already allowlisted. If a deck page pulls an image from a different
  host, add it to `next.config.js` `images.remotePatterns`.

## 10. Test Considerations

**Prerequisites**

- Upload `deckpage.yml`, `deckpage.php`, then the revised `deck.yml`.
- On the `testing` deck, add at least four child pages, one per layout, each
  published: `full-image` with an image; `left-image` with image + two text
  blocks and a heading; `right-image` similar; `full-text` with a heading and two
  text blocks. Add one page with a Vimeo URL and no image to exercise the video
  branch.

**Manual — portal**

1. `/portal/<uuid>` locked → password screen (no nav, no site chrome). View
   source: no page content, no client name, no password.
2. Correct password → cover slide: title, client, intro (if set), a next control,
   no counter, no previous control.
3. Next → `/portal/<uuid>/1`. Counter shows `1 / N`. Previous returns to the
   cover.
4. Step through every page with the on-screen controls, then again with
   `ArrowLeft`/`ArrowRight`, then again by swiping on a touch device / emulator.
5. Verify each layout: `full-image` media fills, no text; `left-image` image left
   / text right at desktop, image on top at mobile; `right-image` image right /
   text left at desktop, image on top at mobile; `full-text` centred column, no
   media.
6. Last page → next control disabled. First page → previous goes to cover.
7. `/portal/<uuid>/999` → 404. `/portal/<uuid>/0` → 404. `/portal/<uuid>/x` →
   404.
8. Delete the `deck_session` cookie, then hit `/portal/<uuid>/2` directly →
   redirect to `/portal/<uuid>` showing the password screen.
9. Set the deck `expiry` to yesterday → cover and every `/portal/<uuid>/<n>`
   show / redirect to the expired message; unlock POST returns 410.
10. Refresh mid-deck on `/portal/<uuid>/3` → same slide reloads, still unlocked.
11. Confirm `robots` noindex on cover and content responses.
12. Video page: the Vimeo/mp4 page plays via the existing player; arrow keys
    still change slides (note the known video-focus caveat).

**Manual — regression**

13. Public routes `/`, `/about`, `/gallery`, `/projects/<slug>`, `/shop`,
    `/info` unchanged.
14. `/portal/<uuid>/unlock` still routes to the POST handler (e.g. a GET returns
    405/no-GET, not the `[page]` renderer).

**Build**

15. `npm run build` in `next/` succeeds; the route list includes
    `/portal/[token]` and `/portal/[token]/[page]` and no longer references
    `DeckContent`.

**Automated (optional)**

- Unit test `getDeckPages` normalisation with a stubbed `kirbyFetch` result:
  correct ordering, `layout` fallback to `full-text`, media alias shape, empty
  `body` handled.
- Unit test `resolveDeckAccess` branch table with stubbed `getDeckForRender` and
  cookie: notfound / expired / locked / unlocked.
- Playwright: unlock → cover → next → arrow-key navigation → deep-link a content
  page while logged out → redirected to gate.

## 11. Implementation Order

1. `next/queries/deckQuery.js` — **modify** — drop `layout` from
   `getDeckForRender`, add `intro` to it, add `getDeckPages`, remove
   `getDeckContent`; everything downstream needs the new data shape first.
2. `next/utility/deckAccess.js` — **new** — the shared gate helper both routes
   depend on.
3. `next/components/DeckCover.js` — **new** — presentational, no dependencies
   beyond CSS.
4. `next/components/DeckPage.js` — **new** — per-layout renderer, depends on the
   Step 1 shape and `MediaItem`.
5. `next/components/DeckNav.js` — **new** — client navigation wrapper, depends on
   nothing but props.
6. `next/app/(portal)/portal/[token]/page.js` — **modify** — cover route wired to
   `resolveDeckAccess` + `DeckCover` + `DeckNav`; stops importing `DeckContent`.
7. `next/app/(portal)/portal/[token]/[page]/page.js` — **new** — content slide
   route; comes after the components and helper it composes.
8. `next/components/DeckContent.js` — **delete** — only safe once Step 6 removed
   its last importer.
9. `next/styles/deck.css` — **modify** — swap the old layout rules for the four
   `deck-page--*` layouts plus cover and nav styles; do after the components so
   the class names are settled.
10. `cms/site/blueprints/pages/deckpage.yml` — **new (SiteGround)** — deck page
    form; upload before touching `deck.yml`.
11. `cms/site/templates/deckpage.php` — **new (SiteGround)** — template stub so
    the blueprint is assignable.
12. `cms/site/blueprints/pages/deck.yml` — **modify (SiteGround)** — remove
    `layout`/`body`, add `client_link` and the child-pages section; upload last.
13. Build, then run the manual QA in Section 10 against a `testing` deck with one
    child page per layout.
