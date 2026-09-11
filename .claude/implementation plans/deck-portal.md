# Implementation Plan: Client Deck Portal

## 1. Goal

FLOWERS needs a password-protected area of the website where the studio can share
curated "decks" (ordered text, images, and video) with a single client. The
workflow the studio wants:

1. A staff member builds a deck in the Kirby Panel and sets a password on it.
2. They send the client a link plus that password by their own email.
3. The client opens the link, enters the password, and sees only that deck.

Nothing about the deck content may be visible to a visitor who does not have the
password, and the deck pages must not appear in search engines or in the public
site navigation.

## 2. Current System Behaviour

- The site is a Next.js 14 App Router project in `next/`, deployed on Vercel.
  A single Kirby CMS (PHP, flat-file) runs separately on SiteGround and is
  reached only through KQL (Kirby Query Language) POST requests.
- `next/queries/kirbyFetch.js` is the only path to the CMS. It POSTs a query
  body to `process.env.API_HOST` with an `Authorization: Basic ${process.env.AUTH}`
  header, always uses `cache: "no-store"`, and retries up to 3 times when the
  response is not JSON.
- Each content type has a query module in `next/queries/` (for example
  `projectQuery.js`) that builds a KQL `query` + `select` object and returns the
  parsed JSON. The response shape is always `{ code, status, result }`.
- Project pages demonstrate the exact content model this feature needs:
  `next/app/projects/[slug]/page.js` (server component) fetches with
  `getProjectData(slug)`, calls `notFound()` on a missing result, and renders
  `next/components/ProjectContent.js` (client component). `ProjectContent`
  flattens `mediaContent` blocks into a list and renders each through
  `next/components/MediaItem.js`, which delegates video to
  `next/components/VideoPlayer.js` (mp4 `<video>` or `@u-wave/react-vimeo`) and
  images to `next/components/DefImage.js` (a thin wrapper over `next/image`).
- Kirby block types live in the `cms/site/plugins/flowers-blocks` plugin.
  `imageSection` holds a `slug` and 1–2 `imageSectionMedia` child blocks; each
  `imageSectionMedia` has a single image `media` file, an optional `video_mp4`
  file, an optional `vimeo_url` string, and a `caption`. The KQL select in
  `projectQuery.js` walks `page.media_content.toBlocks` -> `block.media.toBlocks`
  -> the file/url fields.
- `cms/site/blueprints/site.yml` defines the Panel structure with tabs: Pages,
  Projects, Clients, GlobalData, Metadata. `Clients` is a `structure` field on
  `site` (names only) used to populate a select on projects and the About page.
  There is also an unrelated `cms/content/3_Clients/` page tree with a bare
  `client.yml` blueprint (title only); it is not wired to anything the public
  site renders and is not used by this feature.
- `next/app/layout.js` is the only layout. It renders `<html>`, a large `<head>`
  block of analytics/JSON-LD scripts, `<body>`, wraps everything in
  `ThemeProvider` and `AppWrapper` (context providers), mounts `GoogleAnalytics`
  and `AnalyticsPageTracker`, and renders the site chrome: `MainNav`,
  `MobileNav`, `HomeLink`, `Footer`, `MobileMenu`, `Screensaver`, and
  `<main><Container>{children}</Container></main>`. It calls
  `getGlobalData()` (`next/queries/layoutQuery.js`) for `socialLinks` and
  `screensaverImages`.
- Navigation links (`Home`, `Gallery`, `About`) are hard-coded in
  `next/components/MainNavLinks.js`. Adding a top-level Kirby page does not add
  it to the nav.
- There is no `middleware.ts`, no cookie/session handling, and no auth library
  anywhere in `next/`.
- `next/next.config.js` whitelists specific Kirby image hostnames under
  `images.remotePatterns`. `cms/site/config/config.php` sets `kql.auth => false`
  and sends an `Access-Control-Allow-Origin: http://localhost:3000` header
  (irrelevant for server-side fetches).
- MongoDB helper (`next/utility/db.ts`) and Postmark routes exist but are not
  used by this feature.

## 3. Desired Behaviour

- A new top-level `Decks` section appears in the Kirby Panel. Staff can create a
  deck page under it with: title, client display name, password, layout choice
  (editorial / grid / full-bleed), an optional expiry date, an optional intro
  paragraph, and an ordered `content` field of heading / rich-text / image-or-
  video blocks.
- Each deck has a stable, unguessable URL: `/portal/<uuid>` where `<uuid>` is the
  Kirby page UUID that Kirby already assigns every page.
- Visiting `/portal/<uuid>` with no valid session shows a minimal password
  screen (FLOWERS logo, a password input, a submit button, an error slot). The
  page sends **no deck content** to the browser in this state.
- Submitting the correct password sets a signed, httpOnly session cookie scoped
  to that one deck and reloads into the deck view. Submitting a wrong password
  re-shows the form with a generic "Incorrect password" message.
- The deck view renders the deck's blocks according to its `layout` value, with
  no public-site nav, footer, or screensaver. Images and video reuse the
  existing `MediaItem` / `VideoPlayer` / `DefImage` components.
- A valid session cookie keeps the client in without re-entering the password
  until the cookie expires (at the deck's expiry date, or 90 days from unlock,
  whichever is sooner).
- If the deck's expiry date has passed, both the password screen and any valid
  cookie are refused with an "This link has expired" message.
- An unknown or malformed token returns the standard 404.
- All `/portal/*` responses carry `robots: noindex, nofollow`. The public site
  navigation never links to a deck.
- Every existing public route (`/`, `/about`, `/gallery`, `/projects/[slug]`,
  `/shop`, `/info`) continues to work unchanged, with the same nav/footer/
  screensaver and the same URLs.

## 4. Architecture Considerations

**Password logic lives entirely in Next, not Kirby.** The only things added to
the SiteGround server are blueprint YAML files and one container content folder.
This was a deliberate constraint: the studio edits Kirby through the Site Tools
file manager only, with no Git or SSH deploy, so PHP changes there are costly and
risky. Keeping auth in the Next app means all real logic ships through the normal
Vercel pipeline.

**Password is stored in plaintext in a Panel text field.** Accepted trade-off:
the studio needs to read the password back to send it to the client, and the
threat model is "marketing decks behind a shared password over HTTPS", not
credentials. The comparison is done server-side with a timing-safe check. The
password value is only ever fetched by the server route that verifies it and is
never included in any query whose result reaches a client component.

**Session is a stateless signed token (JWT via `jose`), not a database row.**
No audit log was requested, so there is nothing to persist. `jose` is chosen
because it is small, has no native dependencies, and works in both the Node and
Edge runtimes (leaving the door open to move the check into `middleware.ts`
later). The token payload is `{ deckId }` with a standard `exp` claim; it is
signed with `HS256` using a new `PORTAL_SESSION_SECRET` env var. If that secret
is absent the portal fails closed.

**Route groups split the layout.** Next 14 App Router allows exactly one root
layout and it always renders. To give the portal a bare page while keeping the
public site's chrome, the site chrome and `getGlobalData()` move out of the root
layout into a new `app/(site)/layout.js`, and the portal gets `app/(portal)/layout.js`.
Route groups do not change URLs, so `/about` etc. are untouched. This is a
mechanical move of existing route folders one directory deeper; the main risk is
relative import paths, addressed per-file in the steps below.

**Token = Kirby page UUID.** Kirby already assigns a UUID to every page
(visible as `Uuid:` in the content `.txt` files). Reusing it means zero extra
fields and no generation logic. The lookup resolves the UUID to a page and then
asserts the page's parent is the `decks` container, so a UUID from any other page
type cannot be used to reach the portal renderer.

**Layout is a data value, not a template.** The three layouts are a `select`
field rendered by branching in one React component plus CSS. Adding a fourth
later is one option value and one code branch, with no CMS deploy.

**Draft decks are invisible.** KQL with `kql.auth => false` returns only
published pages. A deck must be published in the Panel before its link works;
until then the link 404s. This is documented for the studio rather than worked
around.

**Known limitation carried forward:** Kirby serves media files from public,
directly-addressable URLs. A deck asset URL shared on its own bypasses the
password gate. This is acceptable for the current use and is explicitly out of
scope; closing it would require proxying or signing every asset.

## 5. Data Flow

**Authoring:** A staff member creates a deck page in the Kirby Panel under
`Decks`, fills in client name, password, layout, optional expiry and intro, and
adds content blocks. Kirby writes a `deck.txt` file and assigns a page UUID.
The staff member copies `https://www.flowersfullservice.art/portal/<uuid>` and
the password and emails them to the client by hand.

**First visit (no cookie):** The client requests `/portal/<token>`. The
`(portal)/portal/[token]/page.js` server component reads the `deck_session`
cookie, finds none (or one that does not match this token), and calls
`getDeckForRender(token)` which issues a KQL request through `kirbyFetch` for the
deck's title, client, layout, and expiry — **not** the password, **not** the
blocks. If the deck does not resolve to a child of `decks`, it calls
`notFound()`. If the expiry has passed it renders the "expired" state. Otherwise
it renders `PasswordGate` (client component) with just the deck title.

**Unlock:** `PasswordGate` POSTs `{ password }` as JSON to
`/portal/<token>/unlock`. The `route.js` handler calls `getDeckSecret(token)`
(KQL request selecting only `password` and `expiry`), rejects with 404 if the
deck is missing, rejects with 410 if expired, and does a timing-safe compare of
the submitted password against the stored one. On mismatch it returns 401 with
`{ error: "incorrect" }`. On match it signs a JWT `{ deckId: token }` with `exp`
set to `min(deckExpiry, now + 90d)`, sets it as the `deck_session` httpOnly
cookie (path `/portal`, `secure` in production, `sameSite: lax`), and returns
`{ ok: true }`.

**Authenticated view:** `PasswordGate` reloads the route on success. The server
component now finds a `deck_session` cookie, verifies its signature and `exp`
with `PORTAL_SESSION_SECRET`, and confirms `payload.deckId === token`. On
success it calls `getDeckForRender(token)` (meta) and `getDeckContent(token)`
(the blocks) and renders `DeckContent` with the `layout` prop. `DeckContent`
maps each block to markup — `heading`/`text` inline, `imageSection` media items
through the existing `MediaItem` component — inside a layout-specific wrapper.
Images load from the Kirby host already whitelisted in `next.config.js`.

**Return visit:** Same as the authenticated view as long as the cookie is
present and unexpired. If the cookie fails verification or is for another deck,
the flow falls back to the password screen.

## 6. Component Responsibilities

### `app/(portal)/portal/[token]/page.js` — server component (new)

- **Responsible for:** resolving the token to a deck (meta only), enforcing
  expiry, reading and verifying the session cookie, deciding between three
  states (expired / locked / unlocked), fetching block content only when
  unlocked, exporting `metadata` with `robots: { index: false, follow: false }`,
  calling `notFound()` for unknown tokens.
- **Not responsible for:** comparing passwords, setting cookies, rendering block
  markup, any public-site chrome.
- **Props:** receives `{ params: { token } }` from the router.
- **State:** none (server component).

### `app/(portal)/portal/[token]/unlock/route.js` — route handler (new)

- **Responsible for:** handling `POST`, reading `{ password }` from the JSON
  body, fetching the deck secret, checking existence and expiry, timing-safe
  password comparison, signing the session JWT, setting the `deck_session`
  cookie, returning `{ ok }` / error JSON with correct status codes.
- **Not responsible for:** rendering anything, GET requests (not implemented),
  rate limiting (out of scope for v1).
- **Input:** `Request` with JSON body `{ password: string }` and route param
  `token`.
- **State:** none.

### `app/(portal)/portal/[token]/PasswordGate.js` — client component (new)

- **Responsible for:** rendering the password form, controlled input state,
  submitting to `/portal/<token>/unlock` via `fetch`, showing a generic error on
  401, showing a network-error fallback, calling `router.refresh()` on success.
- **Not responsible for:** knowing the real password, deciding expiry, rendering
  deck content.
- **Props:** `token: string` (required) — used to build the unlock URL;
  `deckTitle: string` (optional) — shown above the form.
- **State:** `password: string`, `status: "idle" | "submitting" | "error"`,
  `errorKind: "incorrect" | "network" | null`.

### `app/(portal)/layout.js` — layout (new)

- **Responsible for:** the minimal portal shell — a wrapper element, the FLOWERS
  logo, optional theme toggle, and a portal-specific max-width/padding wrapper
  (not the shared `Container`, so `full-bleed` decks can go edge to edge).
  Exports `metadata` with `robots: { index: false, follow: false }` as a
  baseline for the whole group.
- **Not responsible for:** `<html>`/`<body>` (still the root layout's job),
  context providers (still root), any public-site nav/footer/screensaver,
  `getGlobalData()`.
- **Props:** `{ children }`.
- **State:** none.

### `components/DeckContent.js` — client component (new)

- **Responsible for:** taking the deck's block array and `layout` string and
  rendering it; branching wrapper/container classes on `layout`; mapping
  `heading` -> `<h*>`, `text` -> rich-text `div` (`dangerouslySetInnerHTML`
  with Kirbytext HTML), `imageSection` -> its media items rendered through the
  existing `MediaItem`; rendering the optional intro above the blocks; scrolling
  to top on mount (mirrors `ProjectContent`).
- **Not responsible for:** fetching data, auth, video playback internals
  (delegated to `MediaItem`/`VideoPlayer`), SEO.
- **Props:** `layout: "editorial" | "grid" | "full-bleed"` (required);
  `blocks: Array<Block>` (required) — normalised block objects from
  `getDeckContent`; `intro?: string` (optional) — Kirbytext HTML;
  `client?: string`, `title?: string` (optional) — for an optional header.
- **State:** none required beyond a mount effect for scroll reset.

### `queries/deckQuery.js` — data module (new)

- **Responsible for:** three functions —
  `getDeckForRender(token)` (title, client, layout, expiry; asserts parent is
  `decks`), `getDeckSecret(token)` (password + expiry only),
  `getDeckContent(token)` (the `content` blocks, selected with the same nested
  shape `projectQuery.js` uses for `imageSection`, plus `text`/`heading`
  fields). Each builds a KQL body and calls `kirbyFetch`.
- **Not responsible for:** comparing passwords, caching decisions (inherits
  `kirbyFetch`'s `no-store`), shaping React props beyond light normalisation.
- **Exports:** the three async functions above; each returns a plain object or
  `null` when the deck is absent.

### `utility/deckSession.js` — helper module (new)

- **Responsible for:** `signDeckToken(deckId, expiresAt)` and
  `verifyDeckToken(cookieValue)` using `jose` + `PORTAL_SESSION_SECRET`;
  `comparePassword(submitted, stored)` using `crypto.timingSafeEqual` over
  trimmed UTF-8 buffers with a length-guard; the `deck_session` cookie name and
  cookie option builder; a helper to compute the effective expiry
  (`min(deckExpiry, now + 90d)`); throwing/returning a clear failure if the
  secret env var is missing.
- **Not responsible for:** reading/writing cookies itself (callers use
  `next/headers` `cookies()` and the `NextResponse` cookie API), any Kirby
  access.
- **Exports:** `signDeckToken`, `verifyDeckToken`, `comparePassword`,
  `DECK_SESSION_COOKIE`, `buildSessionCookieOptions`, `effectiveExpiry`.

### `app/(site)/layout.js` — layout (new, holds moved code)

- **Responsible for:** everything the current root layout renders *below*
  `<body>` except the providers and analytics trackers: `getGlobalData()`,
  `MainNav`, `MobileNav`, `HomeLink`, `Footer`, `MobileMenu`, `Screensaver`,
  and `<main><Container>{children}</Container></main>`.
- **Not responsible for:** `<html>`, `<head>`, `<body>`, `ThemeProvider`,
  `AppWrapper`, `GoogleAnalytics`, `AnalyticsPageTracker` (all stay in root).
- **Props:** `{ children }`.
- **State:** none.

### `app/layout.js` — root layout (modified, slimmed)

- **Responsible for:** `<html lang="en">`, the full `<head>` script/JSON-LD
  block, `<body>`, `ThemeProvider`, `AppWrapper`, `GoogleAnalytics`,
  `AnalyticsPageTracker`, the base `metadata` export, and rendering `{children}`
  directly (no `Container`, no nav).
- **Not responsible for:** any site chrome or global CMS data (moved to
  `(site)`).

## 7. Files Affected

### Kirby (edit locally for version control, then upload via Site Tools file manager)

| File | New/Mod | Why |
| --- | --- | --- |
| `cms/site/blueprints/pages/deck.yml` | New | Defines the deck page fields (client, password, layout, expiry, intro, content blocks). |
| `cms/site/blueprints/pages/decks.yml` | New | Defines the `Decks` container page that lists deck children in the Panel. |
| `cms/site/blueprints/site.yml` | Mod | Add a `Decks` tab with a `pages` section (drafts + listed) targeting `template: deck`. |
| `cms/content/<n>_decks/decks.txt` | New | The container page content file so `Decks` exists as a real page and can hold children. `<n>` = next free numeric prefix on the live server. |

### Next

| File | New/Mod | Why |
| --- | --- | --- |
| `next/package.json` / lockfile | Mod | Add `jose` dependency. |
| `next/.env` (and `.env.example` if present) | Mod | Add `PORTAL_SESSION_SECRET`. |
| `next/utility/deckSession.js` | New | Token sign/verify, timing-safe password compare, cookie config, expiry math. |
| `next/queries/deckQuery.js` | New | KQL queries: deck meta, deck secret, deck content. |
| `next/app/layout.js` | Mod | Slim to root shell (html/head/body/providers/analytics + children). |
| `next/app/(site)/layout.js` | New | Holds the site chrome and `getGlobalData()` moved out of root. |
| `next/app/(site)/page.js` | Moved | Home page relocated under the `(site)` group (URL unchanged). |
| `next/app/(site)/about/**` | Moved | Relocated under `(site)`. |
| `next/app/(site)/gallery/**` | Moved | Relocated under `(site)`. |
| `next/app/(site)/info/**` | Moved | Relocated under `(site)`. |
| `next/app/(site)/projects/**` | Moved | Relocated under `(site)`. |
| `next/app/(site)/shop/**` | Moved | Relocated under `(site)`. |
| `next/app/(portal)/layout.js` | New | Minimal portal shell + group-level noindex. |
| `next/app/(portal)/portal/[token]/page.js` | New | Gate + deck render server component. |
| `next/app/(portal)/portal/[token]/unlock/route.js` | New | POST handler: verify password, set session cookie. |
| `next/app/(portal)/portal/[token]/PasswordGate.js` | New | Client-side password form. |
| `next/components/DeckContent.js` | New | Renders deck blocks per layout, reusing `MediaItem`. |
| `next/styles/global.css` | Mod | Add `.deck-*` layout styles for editorial / grid / full-bleed. |
| `next/app/robots.js` | New (optional) | Explicitly `Disallow: /portal`. Belt-and-braces over the noindex meta. |
| `next/next.config.js` | Mod (conditional) | Only if deck media is served from a Kirby hostname not already in `images.remotePatterns`. |

Note: `next/app/global-error.js`, `next/app/not-found.js`, `next/app/sitemap.js`,
`next/app/favicon.ico`, and `next/app/api/**` stay at the root and are not moved.
`not-found.js` at the root continues to serve `notFound()` calls from both
groups.

## 8. Step-by-Step Implementation

### Step 1 — Add the `jose` dependency and the session secret

- In `next/`, add `jose` to `dependencies` and install so the lockfile updates.
- Add `PORTAL_SESSION_SECRET` to `next/.env` (a long random string) and to the
  Vercel project environment for all environments. If an `.env.example` exists,
  add the key there with a placeholder.
- Why: every later step that signs or verifies a session depends on both.
- Gotcha: the secret must be identical across all running instances or existing
  cookies stop verifying. Treat it as stable; rotating it logs everyone out.

### Step 2 — Build `next/utility/deckSession.js`

- Export `DECK_SESSION_COOKIE = "deck_session"`.
- `getSecretKey()`: read `process.env.PORTAL_SESSION_SECRET`; if missing, throw a
  clear error. Encode to a `Uint8Array` for `jose`.
- `signDeckToken(deckId, expiresAt: Date)`: use `jose`'s `SignJWT` with payload
  `{ deckId }`, `setProtectedHeader({ alg: "HS256" })`, `setIssuedAt()`,
  `setExpirationTime(expiresAt)`, sign with the secret key.
- `verifyDeckToken(value)`: `jwtVerify(value, key)`; return the payload on
  success, `null` on any thrown error (expired, bad signature, malformed).
- `comparePassword(submitted, stored)`: guard both are non-empty strings; trim
  both; convert to `Buffer`; if lengths differ return `false`; otherwise return
  `crypto.timingSafeEqual(a, b)`.
- `effectiveExpiry(deckExpiry: Date | null): Date`: `now + 90 days`, capped to
  `deckExpiry` when `deckExpiry` is set and earlier.
- `buildSessionCookieOptions(expiresAt)`: `{ httpOnly: true, sameSite: "lax",
  secure: process.env.NODE_ENV === "production", path: "/portal", expires:
  expiresAt }`.
- Why first: it is pure logic with no CMS or React dependency and is the unit
  most worth testing in isolation.
- Gotcha: keep this module free of `next/headers` imports so it can be used from
  both a server component and a route handler without runtime coupling.

### Step 3 — Build `next/queries/deckQuery.js`

- Import `kirbyFetch`.
- Shared token resolution: the KQL `query` string should resolve the UUID to a
  page and constrain it to the decks tree. Primary form:
  `page("page://<token>")`. Verify against the KQL docs for the deployed Kirby
  version; fallback form if `page()` does not accept a UUID string:
  `site.index.findBy("uuid", "<token>")`. Whichever is used, also `select` the
  parent slug (`parent: "page.parent.slug"`) so the caller can assert it equals
  `decks` and reject UUIDs pointing at other page types.
- `getDeckForRender(token)`: `select` `title`, `client`, `parentSlug`,
  `layout: "page.layout.value"`, `expiry: "page.expiry.toDate('Y-m-d')"` (or
  empty). Return `null` if `result` is falsy or `parentSlug !== "decks"`.
- `getDeckSecret(token)`: `select` only `password: true` and the same `expiry`
  and `parentSlug`. Return `null` under the same conditions. This function's
  result must never be passed to a client component.
- `getDeckContent(token)`: `select` `intro: "page.intro.kirbytext"` and
  `content` via `page.content.toBlocks` with a per-type `select`:
  - `type: true`, and for text/heading blocks `text: "block.text.kirbytext"`
    and `level: "block.level"` (heading only);
  - for `imageSection`: `slug: true` and `media: { query: "block.media.toBlocks",
    select: { ... same file/url/caption/vimeo shape as projectQuery.js ... } }`.
  Normalise into `{ intro, blocks: [...] }`.
- Why here: the page and route handler both import from this module; it must
  exist before them.
- Gotcha: mirror `projectQuery.js`'s nested `query`/`select` structure exactly
  for `imageSection` so the output can flow into the existing `MediaItem` with no
  reshaping. Confirm the built-in `text`/`heading` block field names
  (`text`, `level`) against the Kirby blocks reference before finalising.

### Step 4 — Author the Kirby blueprints and container page

- `cms/site/blueprints/pages/deck.yml`: `title: Deck`; two columns.
  - Column 1 `fields`: `client` (text, required, label "Client name");
    `password` (text, required, help "Sent to the client by email. Visible to
    staff."); `layout` (select, options `editorial` / `grid` / `full-bleed`,
    default `editorial`, required); `expiry` (date, optional, help "After this
    date the link stops working.").
  - Column 2 `fields`: `intro` (textarea, optional, `buttons` limited);
    `content` (blocks) with `fieldsets: [heading, text, imageSection]`.
- `cms/site/blueprints/pages/decks.yml`: `title: Decks`; a `pages` section
  showing drafts and listed children with `template: deck`, `create: deck`.
- `cms/site/blueprints/site.yml`: add a `Decks` tab after `Clients` with a
  `pages` section, `parent: site.find('decks')`, `templates: [deck]`, showing
  drafts, listed, and unlisted (mirror the existing `Projects` tab pattern).
- `cms/content/<n>_decks/decks.txt`: a minimal file with `Title: Decks`. Pick
  `<n>` as the next unused numeric prefix by looking at the live `cms/content/`
  directory in the file manager (repo currently shows up to `6_shop`, but the
  live server is authoritative — check there).
- Upload order in the file manager: the two page blueprints and the container
  folder first, then the modified `site.yml` last (so the tab does not point at a
  missing page mid-upload).
- Why now: a published test deck is needed to build and verify the Next side.
- Gotcha: there is no Kirby `template` PHP file for `deck` and none is needed
  (Kirby renders nothing for these pages directly; only KQL reads them). The
  Panel does not require a template file to exist for a blueprint. If Kirby is in
  a mode that 404s templateless pages on the front end, that is fine — the portal
  never hits the Kirby front end.
- Gotcha: after creating a deck in the Panel, it starts as a draft. It must be
  set to "listed" or "unlisted" (published) for KQL to return it.

### Step 5 — Slim the root layout and add the `(site)` layout

- Create `next/app/(site)/` and move these folders into it unchanged for now:
  `about/`, `gallery/`, `info/`, `projects/`, `shop/`, and `page.js`.
- Create `next/app/(site)/layout.js`: an `async` function component returning a
  fragment. Move into it from the current root layout: the `getGlobalData()`
  call, the `socialLinks` / `screensaverImages` destructure, `MainNav`,
  `MobileNav`, `HomeLink`, `Footer`, `MobileMenu`, `Screensaver`, and
  `<main><Container>{children}</Container></main>`. Keep its imports pointing at
  `../../components/*` and `../../queries/layoutQuery` (one level deeper than the
  old root layout).
- Edit `next/app/layout.js`: remove the moved imports and markup. It keeps
  `<html>`, the `<head>` block, `<body>`, `ThemeProvider`, `AppWrapper`,
  `GoogleAnalytics`, `AnalyticsPageTracker`, the `metadata` export, and renders
  `{children}` directly inside `<body>` (after the existing `<noscript>` GTM
  iframe).
- Fix relative imports in every moved file: each moved page/component import path
  gains one `../` because the file is now one directory deeper (for example
  `next/app/(site)/projects/[slug]/page.js` importing
  `../../../queries/projectQuery` becomes `../../../../queries/projectQuery`).
  A route group folder `(site)` is a real path segment for relative resolution.
- Why now, before the portal: this proves the refactor in isolation. If a
  public page breaks, it is this step, not the portal code.
- Gotcha: `global-error.js`, `not-found.js`, `sitemap.js`, `favicon.ico`, and
  `api/` must stay at `next/app/` root. Do not move them.
- Gotcha: `metadata` set in the root layout still applies globally; per-route
  `generateMetadata` in moved pages is unaffected by the group.
- Verify before continuing: run the dev server and load `/`, `/about`,
  `/gallery`, a real `/projects/<slug>`, `/shop`, `/info`. Nav, footer,
  screensaver, and theming must look identical to before.

### Step 6 — Add the `(portal)` layout

- Create `next/app/(portal)/layout.js`: a simple component with a wrapper
  element, the FLOWERS logo (`/FLOWERS.png` via `next/image`, same as the nav),
  and a portal container `div` with its own max-width/padding utility classes
  (not `Container`). Export
  `const metadata = { robots: { index: false, follow: false } }`.
- It does **not** render `<html>`/`<body>` (root layout owns those) and does not
  use any `getGlobalData()` output.
- Why: establishes the bare chrome all portal routes render inside.
- Gotcha: `ThemeProvider`/`AppWrapper` from the root still wrap this group, so
  `dark:` classes keep working; do not re-add providers here.

### Step 7 — Build `PasswordGate.js`

- `"use client"`. Props `token`, `deckTitle`.
- Render: optional `<h1>{deckTitle}</h1>`, a `<form>` with a single
  `type="password"` input (controlled), a submit button, and a `<p>` error slot.
- On submit: `preventDefault`; set `status = "submitting"`; `fetch(
  \`/portal/${token}/unlock\`, { method: "POST", headers: { "Content-Type":
  "application/json" }, body: JSON.stringify({ password }) })`.
  - `res.ok` -> `router.refresh()` (from `next/navigation`) to re-run the server
    component, which now sees the cookie.
  - `res.status === 401` -> `status = "error"`, `errorKind = "incorrect"`.
  - `res.status === 410` -> `status = "error"`, `errorKind = "expired"`.
  - anything else / thrown -> `errorKind = "network"`.
- Disable the button while `status === "submitting"`.
- Why before the route/page: the page renders this; the route answers it.
- Gotcha: do not store or log the entered password anywhere; clear it on a
  successful refresh is unnecessary because the component unmounts.

### Step 8 — Build the unlock route handler

- `next/app/(portal)/portal/[token]/unlock/route.js`, `export async function
  POST(request, { params })`.
- Parse `{ password }` from `await request.json()`; if absent, `return
  NextResponse.json({ error: "missing" }, { status: 400 })`.
- `const deck = await getDeckSecret(params.token)`; if `null`, `return
  NextResponse.json({ error: "not_found" }, { status: 404 })`.
- If `deck.expiry` is set and in the past, `return NextResponse.json({ error:
  "expired" }, { status: 410 })`.
- `if (!comparePassword(password, deck.password)) return NextResponse.json({
  error: "incorrect" }, { status: 401 })`.
- Compute `const expiresAt = effectiveExpiry(deck.expiry ? new Date(deck.expiry)
  : null)`; `const token = await signDeckToken(params.token, expiresAt)`.
- Build the response `const res = NextResponse.json({ ok: true })`; `res.cookies
  .set(DECK_SESSION_COOKIE, token, buildSessionCookieOptions(expiresAt))`;
  return `res`.
- Wrap the body in `try/catch`; on a thrown error (for example missing secret)
  return `{ error: "server" }` with 500 and do not set a cookie.
- Why: this is the only place the password is read and the only place a cookie is
  minted.
- Gotcha: the cookie `path` must be `/portal` (matches
  `buildSessionCookieOptions`) so it is sent back on the deck route but not on
  the public site.
- Gotcha: `params` is per the route segment; the folder is `[token]`, so the
  key is `params.token` everywhere.

### Step 9 — Build the deck page server component

- `next/app/(portal)/portal/[token]/page.js`.
- `export const dynamic = "force-dynamic"` (it reads cookies and must never be
  statically cached).
- `export async function generateMetadata()` returning `{ title: "FLOWERS —
  Client Deck", robots: { index: false, follow: false } }` (no client name in
  the title, to avoid leaking it in a browser history / tab for a locked page).
- Default export `async function Page({ params })`:
  1. `const meta = await getDeckForRender(params.token)`; if `null`,
     `notFound()`.
  2. `const expired = meta.expiry && new Date(meta.expiry) < new Date()`.
  3. If `expired`, render a small "This link has expired" block and return.
  4. `const cookie = cookies().get(DECK_SESSION_COOKIE)?.value`;
     `const payload = cookie ? await verifyDeckToken(cookie) : null`;
     `const unlocked = payload?.deckId === params.token`.
  5. If not `unlocked`, `return <PasswordGate token={params.token}
     deckTitle={meta.title} />`.
  6. `const { intro, blocks } = await getDeckContent(params.token)`.
  7. `return <DeckContent layout={meta.layout || "editorial"} blocks={blocks}
     intro={intro} title={meta.title} client={meta.client} />`.
- Why after the route and gate: it wires them together.
- Gotcha: `cookies()` from `next/headers` is only valid in a dynamic render;
  `force-dynamic` guarantees that. Without it, a build-time render throws.
- Gotcha: step 6 must run only when `unlocked` — never fetch block content for a
  locked visitor.

### Step 10 — Build `DeckContent.js` and its styles

- `"use client"`. Props `layout`, `blocks`, `intro`, `title`, `client`.
- `useEffect(() => window.scrollTo(0, 0), [])` (mirror `ProjectContent`).
- Optional header: `title` and `client` in a small block at the top; render
  `intro` as `<div dangerouslySetInnerHTML={{ __html: intro }} />` with the
  existing `rich-text` class when present.
- Map `blocks`:
  - `heading` -> `<h2>` / `<h3>` based on `level` (default `h2`), text from
    `block.text` (already HTML from `.kirbytext`, so use
    `dangerouslySetInnerHTML` or strip tags for headings — prefer a plain-text
    heading: render `block.text` with tags stripped).
  - `text` -> `<div className="rich-text" dangerouslySetInnerHTML=...>`.
  - `imageSection` -> for each item in `block.media`, render `<MediaItem
    key=... media={item} />` (import the existing component unchanged).
  - unknown type -> render nothing.
- Wrapper: outer `div` gets `deck deck-<layout>`. In `global.css` add:
  - `.deck` base: vertical rhythm, readable measure for `.rich-text`.
  - `.deck-editorial`: single centered column, `max-width` ~48rem for text,
    media allowed wider (~64rem), stacked.
  - `.deck-grid`: media items in a 2-column CSS grid at `lg`, text blocks span
    both columns; 1 column below `lg`.
  - `.deck-full-bleed`: media items `width: 100%` with no max-width and near-zero
    horizontal padding; text blocks kept to a centered narrow column.
- Why last among the rendering pieces: it depends on the block shape from
  `getDeckContent` and on the portal layout not imposing `Container`.
- Gotcha: `MediaItem` expects the same field names as the project media items
  (`media.media.url`, `media.videoMp4`, `media.vimeoUrl`, `media.caption`);
  the `getDeckContent` select must produce exactly that. If a field name differs,
  fix it in the query, not in `DeckContent`.
- Gotcha: `MediaItem`/`DefImage` are `"use client"` and use `next/image`; the
  deck image host must be in `next.config.js` `images.remotePatterns`. It is the
  same Kirby host as projects, already whitelisted — confirm with a real deck
  image URL and only touch `next.config.js` if the hostname differs.

### Step 11 — Optional `app/robots.js`

- Add `next/app/robots.js` exporting a config with `rules: [{ userAgent: "*",
  allow: "/", disallow: "/portal/" }]` and the existing `sitemap` URL.
- Why: a crawler that discovers a leaked link still will not index it; redundant
  with the per-route `robots` metadata but cheap.
- Gotcha: if an `app/robots.*` or `public/robots.txt` already exists, merge
  rather than add a second one.

### Step 12 — QA pass

- Covered in Test Considerations below; do this before shipping.

## 9. Edge Cases

- **Unknown or malformed token:** `getDeckForRender` returns `null` ->
  `notFound()` -> the root `not-found.js`. No portal chrome leak, no distinction
  between "never existed" and "wrong id".
- **UUID of a non-deck page:** `getDeckForRender` checks `parentSlug === "decks"`
  and returns `null` otherwise -> `notFound()`.
- **Deck still a draft:** KQL returns nothing -> same as unknown token. Document
  for the studio: publish the deck before sending the link.
- **Expiry passed:** page renders the "expired" state before checking the
  cookie; the unlock route returns 410. A previously valid cookie does not
  bypass this because expiry is re-checked on every render.
- **Valid cookie for a different deck:** `payload.deckId !== token` ->
  treated as locked -> password screen. The cookie is not cleared (it is still
  valid for its own deck at its own path, though in practice the path is
  `/portal` so it is sent for all decks; the `deckId` check is what scopes it).
- **`PORTAL_SESSION_SECRET` missing in an environment:** `verifyDeckToken`
  returns `null` (locked) and the unlock route's `try/catch` returns 500 without
  a cookie. The portal fails closed; no deck content is served. Surfaces quickly
  in testing.
- **Password field left blank in the Panel:** `comparePassword` guards against
  empty `stored` and returns `false`, so the deck can never be unlocked. Note
  `required: true` on the blueprint field already prevents saving it blank; the
  guard is defence in depth.
- **Client shares the link and password:** by design any holder of both gets in.
  Expiry is the mitigation; regenerating access means changing the password in
  the Panel (existing cookies keep working until they expire — acceptable, or
  rotate `PORTAL_SESSION_SECRET` to force everyone out).
- **Direct asset URL shared:** loads without the gate. Known, out of scope.
- **Very large deck / many videos:** `kirbyFetch` uses `no-store` so every load
  re-queries Kirby; acceptable at expected volume. If it becomes slow, add a
  short `revalidate` to the content query later — not in v1.
- **Route-group move breaks a relative import:** caught by the Step 5 verify
  pass; every moved file's imports must gain one `../`.
- **`next/image` rejects a deck image host:** add the hostname to
  `images.remotePatterns`; until then images 404 in the deck view only.
- **Trailing slash / casing in the token:** UUIDs are case-sensitive; the route
  param is passed through verbatim. A wrong-case token simply resolves to
  `null` -> 404.

## 10. Test Considerations

**Manual (local dev against the real Kirby):**

1. Create a deck in the Panel with each of the three layouts, an intro, a
   heading block, a text block, an image `imageSection`, and a video
   `imageSection` (mp4 and Vimeo). Publish it. Note its UUID from the content
   file or Panel.
2. Visit `/portal/<uuid>`: expect the password screen, FLOWERS logo, no site
   nav/footer/screensaver. View source — confirm no block content, no client
   name, no password in the HTML.
3. Submit a wrong password: expect the form again with "Incorrect password".
4. Submit the correct password: expect a reload into the deck view rendering all
   block types; video plays via the existing player; images load.
5. Switch the deck's `layout` value in the Panel and reload each: confirm
   editorial (single column), grid (2-col media), full-bleed (edge-to-edge
   media) visibly differ.
6. Refresh and reopen the tab: still unlocked (cookie present).
7. Delete the `deck_session` cookie in dev tools: back to the password screen.
8. Set the deck's `expiry` to yesterday: both the password screen and a
   still-present cookie show "This link has expired"; the unlock POST returns
   410.
9. Visit `/portal/not-a-real-uuid` and `/portal/<uuid-of-a-project>`: both 404.
10. Confirm the response for `/portal/<uuid>` has
    `X-Robots-Tag`/`<meta name="robots">` noindex (from the metadata export).
11. Regression: load `/`, `/about`, `/gallery`, `/projects/<slug>`, `/shop`,
    `/info` — chrome, theming, and behaviour unchanged after the route-group
    move.
12. Build (`next build`) and confirm no static-render error from `cookies()` in
    the portal route (the `force-dynamic` guard).

**Automated (recommended, not blocking):**

- Unit tests for `utility/deckSession.js`: `signDeckToken` + `verifyDeckToken`
  round-trip; `verifyDeckToken` rejects a tampered token, a token signed with a
  different secret, and an expired token; `comparePassword` is true only for an
  exact trimmed match and false on length mismatch; `effectiveExpiry` caps at the
  deck date and otherwise returns +90 days.
- Optional Playwright flow: locked -> wrong password -> correct password ->
  content visible -> cookie cleared -> locked again.

**Deploy checklist:**

- `PORTAL_SESSION_SECRET` set in every Vercel environment before the code ships.
- Kirby blueprints + container page uploaded and a first deck published.
- `jose` present in the deployed lockfile.

## 11. Implementation Order

1. `next/package.json` (+ lockfile) — **modify** — add `jose`; nothing else
   compiles against the session helper without it.
2. `next/.env` and Vercel env — **modify** — add `PORTAL_SESSION_SECRET` so the
   helper and route can run locally and in preview.
3. `next/utility/deckSession.js` — **new** — pure token/password/cookie helper,
   independently unit-testable, depended on by the route and the page.
4. `next/queries/deckQuery.js` — **new** — the three KQL functions the route and
   page call; verify UUID-lookup and block-field KQL against the Kirby/KQL docs
   here.
5. `cms/site/blueprints/pages/deck.yml` — **new** — deck fields.
6. `cms/site/blueprints/pages/decks.yml` — **new** — container listing.
7. `cms/content/<n>_decks/decks.txt` — **new** — makes `Decks` a real page.
8. `cms/site/blueprints/site.yml` — **modify** — add the `Decks` tab; upload
   last so it never points at a missing page. After this, create and publish a
   test deck in the Panel.
9. `next/app/(site)/layout.js` — **new** — receives the site chrome +
   `getGlobalData()` moved out of root.
10. `next/app/layout.js` — **modify** — slim to the root shell; done together
    with the move of `page.js`, `about/`, `gallery/`, `info/`, `projects/`,
    `shop/` into `next/app/(site)/` and the `../` import fixes. Verify all public
    routes before proceeding.
11. `next/app/(portal)/layout.js` — **new** — bare portal shell + group noindex.
12. `next/app/(portal)/portal/[token]/PasswordGate.js` — **new** — client form
    that posts to the unlock route.
13. `next/app/(portal)/portal/[token]/unlock/route.js` — **new** — verify
    password, mint and set the session cookie.
14. `next/app/(portal)/portal/[token]/page.js` — **new** — resolve deck, enforce
    expiry, verify cookie, branch locked/unlocked, fetch content only when
    unlocked.
15. `next/components/DeckContent.js` — **new** — render blocks per layout,
    reusing `MediaItem`.
16. `next/styles/global.css` — **modify** — `.deck` / `.deck-editorial` /
    `.deck-grid` / `.deck-full-bleed` styles.
17. `next/next.config.js` — **modify, only if needed** — add the deck media
    hostname to `images.remotePatterns` if it differs from the project host.
18. `next/app/robots.js` — **new, optional** — `Disallow: /portal/`.
19. QA pass per Test Considerations, then deploy checklist.
