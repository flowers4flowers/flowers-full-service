# Implementation Plan: Figma Deck Embed

## 1. Goal

Replace the custom, Kirby-authored deck viewer with a much simpler model: a deck
is a password-protected wrapper page that embeds a Figma Slides deck (or any
Figma file/prototype URL) directly via iframe. The studio keeps designing decks
entirely in Figma; Kirby's only job is holding the password, expiry, and a link
to the Figma deck. No content is authored in Kirby, no pipeline renders or
stores anything — the client's browser loads Figma's own embeddable viewer.

This supersedes both `deck-pages-redesign.md` (the four-layout, Kirby
child-page content model) and `deck-figma-publishing.md` (the
render-to-image/R2/MongoDB pipeline), neither of which is being carried
forward. The authentication shell built in `deck-portal.md` — Kirby password +
expiry fields, the signed session cookie, the unlock route, the password form —
is kept exactly as built.

## 2. Current System Behaviour

The repository is currently in the state left by `git restore` after the
Figma-publishing plan was abandoned, with one leftover inconsistency:

- **Auth shell (kept, working).** `next/utility/deckSession.js` signs/verifies a
  `deck_session` JWT cookie (`jose`, HS256, `PORTAL_SESSION_SECRET`),
  timing-safe password compare, cookie options (path `/portal`, httpOnly,
  `sameSite: lax`, `secure` in production), `effectiveExpiry` (min of deck
  expiry or 90 days). `next/utility/deckAccess.js` exposes
  `resolveDeckAccess(token)` → `{ status: "notfound" | "expired" | "locked" |
  "unlocked", meta }`, combining `getDeckForRender`, an expiry check, and cookie
  verification against the token. `next/app/(portal)/portal/[token]/unlock/route.js`
  (`POST`, 400/404/410/401/200-with-cookie) and
  `next/app/(portal)/portal/[token]/PasswordGate.js` (client form, posts to
  `unlock`, `router.refresh()` on success) are unchanged and fully functional.
- **Broken leftover.** `next/app/(portal)/portal/[token]/page.js` and
  `next/app/(portal)/portal/[token]/[page]/page.js` still `import DeckCover
  from "../../../../components/DeckCover"` and `import DeckPage from
  "../../../../components/DeckPage"` respectively, but both component files
  were deleted in the most recent commit (`105250d packages`). The app will not
  currently build. This plan resolves it by rewriting both route files (the
  `[page]` route is deleted outright) rather than restoring the missing
  components.
- **Surviving old-viewer code.** `next/queries/deckQuery.js` still has
  `getDeckForRender(token)` (KQL: `title`, `client`, `parentSlug`, `intro`,
  `expiry`; `null` unless `parentSlug === "decks"`), `getDeckSecret(token)`
  (`password`, `expiry`, `parentSlug`), and `getDeckPages(token)` (one KQL
  request over `page.children.listed` reading each child `deckpage`'s `layout`,
  `visual` file, `video_mp4`, `vimeo_url`, `body` blocks — the four-layout
  model). `next/components/DeckNav.js` (client — prev/next `<Link>`s, arrow
  keys, swipe, counter) is the only deck-viewer component still present.
  `next/styles/deck.css` still carries `.deck-nav*`, `.deck-cover*`, and
  `.deck-page*` / `.deck-page--*` rules for the old viewer.
- **Portal shell (kept, unrelated to content model).**
  `next/app/(portal)/layout.js` renders the FLOWERS logo in a small header and a
  flush content wrapper (no shared `Container`), with group-level
  `robots: { index: false, follow: false }`. `next/app/(site)/layout.js` and the
  route-group split for the public site are untouched by any of this.
- **Kirby (SiteGround, file-manager deploy only, not git-tracked).** The last
  blueprint state this project specified is: `cms/site/blueprints/pages/deck.yml`
  with `title`, `client`, `password`, `expiry`, `client_link` (an `info` field
  rendering `https://www.flowersfullservice.art/portal/{{ page.uuid.id }}`),
  `intro`, and a `pages` section (`create: deckpage`, `status: all`);
  `cms/site/blueprints/pages/deckpage.yml` (the per-page `layout`/`visual`/
  `video_mp4`/`vimeo_url`/`body` fields) and `cms/site/templates/deckpage.php`
  (a stub). `cms/site/blueprints/pages/decks.yml` (container listing),
  `cms/site/blueprints/site.yml` (the `Decks` tab), and
  `cms/content/<n>_decks/decks.txt` (the container page) are unaffected by any
  deck plan and stay as they are. Because Kirby is not version-controlled here,
  this plan treats the above as the working assumption and calls out where to
  verify it against the live Panel before editing.
- **Unrelated media components.** `next/components/MediaItem.js`, `DefImage.js`,
  `VideoPlayer.js` are used by `projects`/`gallery` and were used by the old
  deck viewer; this plan does not touch them and the new deck viewer does not
  use them at all.

## 3. Desired Behaviour

- Kirby's deck form has exactly: `title`, `client`, `password`, `expiry`,
  `client_link` (unchanged), and one new field, `figma_url` — a link to the
  Figma deck (Slides, prototype, or design file; any `figma.com` URL). No
  layout, no blocks, no child pages.
- `/portal/<token>` behaves exactly as it does today up through the password
  gate: unknown token → 404; past expiry → "This link has expired."; no valid
  session → the password form; wrong password → "Incorrect password."; correct
  password → unlocked.
- Once unlocked:
  - If the deck has no `figma_url` set, show "This deck is not ready yet."
    (mirrors the expired-message styling).
  - Otherwise, render the Figma deck as a full-bleed iframe filling the space
    below the FLOWERS logo header. While the iframe is loading, show a centred
    branded loader (FLOWERS mark or "Loading deck…"); it fades out once the
    iframe fires its `load` event.
- There is no pagination route, no prev/next controls, no keyboard/swipe
  handling on our side — Figma's own embedded viewer provides whichever
  navigation its content type supports (Slides: slide-by-slide; prototype:
  click-through; design file: pan/zoom).
- The wrapper page (header, loader, background) matches the site's visual
  language (fonts, colours, dark/light theme); the embedded Figma content itself
  renders in Figma's own UI and cannot be restyled — this is an accepted,
  visible seam, not a bug to chase.
- The Figma file behind `figma_url` must have link-sharing set to "Anyone with
  the link can view" for the embed to render for a client with no Figma
  account. This is a deliberate, accepted trade-off: the Kirby password gates
  the wrapper page, not the Figma file itself. Documented in the blueprint's
  help text and in this plan; not something the code can enforce or detect.

## 4. Architecture Considerations

**Figma only allows iframing through its `/embed` endpoint.** A direct
`figma.com/design/...`, `/proto/...`, or `/deck/...` URL cannot be placed in an
`<iframe src>` — Figma blocks framing of those routes. The documented mechanism
is `https://www.figma.com/embed?embed_host=<identifier>&url=<url-encoded
original link>`, which Figma explicitly serves as embeddable. This plan always
constructs (or passes through) that `/embed` URL; it never puts a raw
`figma.com` share link directly into an iframe.

**Defensive, idempotent URL handling instead of parsing the link type.** Rather
than branching on whether `figma_url` is a Slides deck, a prototype, or a
design file, the code treats any stored value uniformly: if it already starts
with `https://www.figma.com/embed`, use it as-is (this covers the case where
whoever configured the deck pasted the exact embed URL/code Figma's own
"Share → Embed" feature generates); otherwise wrap it as
`https://www.figma.com/embed?embed_host=<identifier>&url=` +
`encodeURIComponent(figma_url)`. This sidesteps the one genuinely uncertain
area of this plan — the precise embed query parameters Figma expects for a
Slides deck specifically (versus the better-documented prototype/file embed
parameters) — without blocking implementation on it. If Slides needs a
different parameter shape than assumed here, the fallback (staff paste Figma's
own generated embed URL) still works without a code change. This should be
verified against Figma's current embed documentation and against the real deck
URL during Step 8's manual testing, not assumed correct from memory.

**No `sandbox` attribute on the iframe.** Figma's app needs full script,
same-origin storage, and popup capability to function; sandboxing it would
break the embed. This is a deliberate omission, not an oversight, and is called
out so a future security review does not "fix" it by adding one.

**`allow` attribute kept minimal and flagged for verification.** `fullscreen`
is the one permission this plan is confident is relevant (present-mode /
fullscreen inside Figma's viewer). Additional permissions some Figma
documentation associates with embeds (e.g. clipboard access) are not added
speculatively; if a real deck's interactive features need one, add it then.

**No pagination, no custom navigation UI.** The previous two plans built a
page-by-page viewer (`DeckPage`, `DeckCover`, `DeckNav`, a `[token]/[page]`
route) because the content lived in discrete Kirby pages or rendered manifest
pages. That model is gone entirely — Figma's embedded viewer is the whole
experience once the gate is passed. `DeckNav.js` is deleted; the `[page]`
route directory is deleted; nothing replaces them.

**One deck route, not two.** `/portal/<token>` now handles both "not yet
unlocked" and "unlocked, show the embed" — there is no separate cover/content
distinction to route between, so the `[token]/[page]/page.js` split from the
prior plans is unnecessary and removed.

**`figmaUrl` is added to the existing `getDeckForRender` query rather than a
new query function.** The prior Figma-publishing plan added a separate
`getDeckFigmaUrl` because it was called from a standalone import script with
its own lifecycle. Here, the only consumer is the single deck route, which
already calls `getDeckForRender` (via `resolveDeckAccess`) for `title` /
`client` / `expiry`. Folding `figmaUrl` into the same KQL request avoids a
second round trip and keeps `deckAccess.js` completely untouched (it already
passes `meta` through unmodified).

**No new dependencies, no new environment variables, no new external
services.** This is the material simplification versus the previous plan: no
Figma API token, no Cloudflare R2, no MongoDB collection, no dev scripts. The
only moving part beyond what already exists is one Kirby field and one React
component.

**Visual seam is accepted, not hidden.** Figma's embedded UI (its own toolbar,
fonts, cursor, possible small attribution) cannot be restyled — it is
cross-origin content in an iframe. The plan's contribution to "looks nice like
the rest of the site" is entirely in the surrounding chrome: the existing
FLOWERS logo header, full-bleed layout, and a branded loading state. This is
stated explicitly so it is not treated as a defect during review.

## 5. Data Flow

**Authoring.** A staff member opens a deck in the Kirby Panel, sets `title`,
`client`, `password`, `expiry` as before, and pastes the Figma deck's share URL
(having first set that Figma file's link-sharing to "Anyone with the link can
view") into the new `figma_url` field, then saves. `client_link` continues to
show `https://www.flowersfullservice.art/portal/{{ page.uuid.id }}` unchanged —
that is still the link sent to the client, unrelated to the Figma URL.

**Request.** A client opens `/portal/<token>`. The route calls
`resolveDeckAccess(token)`, which calls `getDeckForRender(token)` — one KQL
request now selecting `title`, `client`, `parentSlug`, `expiry`, and
`figmaUrl` — checks expiry, and checks the `deck_session` cookie. `notfound` →
`notFound()`. `expired` → the existing expired message. `locked` → the existing
`PasswordGate`, unchanged. `unlocked` with `meta.figmaUrl` falsy → the "not
ready" message. `unlocked` with `meta.figmaUrl` set → render `DeckEmbed` with
that URL as a prop.

**Rendering.** `DeckEmbed` (client component) computes the embed `src` once
(via the idempotent wrap/pass-through logic in Section 4), renders a wrapper
`div.deck-embed` containing a loader element and an `<iframe>` with that `src`.
The loader is visible by default; the iframe's `onLoad` handler flips a
`loaded` state, which the wrapper uses to hide the loader (CSS opacity
transition, not unmounting anything). Nothing is fetched or computed
server-side beyond the one Kirby query — from this point on it's the browser
talking directly to Figma inside the iframe.

**Unlock (unchanged).** `PasswordGate` posts to `/portal/<token>/unlock`, which
calls `getDeckSecret`, compares, and sets the session cookie exactly as before.
`router.refresh()` re-runs the server component, which now finds `unlocked` and
renders `DeckEmbed`.

## 6. Component Responsibilities

### `next/app/(portal)/portal/[token]/page.js` — server component (modified)

- **Responsible for:** the entire deck route. Calling `resolveDeckAccess`;
  rendering `notFound()` / the expired message / `PasswordGate` for their
  respective statuses; on `unlocked`, branching on whether `meta.figmaUrl` is
  present to show the "not ready" message or `DeckEmbed`. Keeps
  `export const dynamic = "force-dynamic"` and the existing `generateMetadata`
  (`title: "FLOWERS — Client Deck"`, `robots: { index: false, follow: false }`).
- **Not responsible for:** password comparison, cookie handling (delegated to
  `resolveDeckAccess` / the unlock route), building the embed URL (delegated to
  `DeckEmbed`), any pagination (none exists).
- **Props:** `{ params: { token } }` from the router.
- **State:** none (server component).

### `next/components/DeckEmbed.js` — client component (new)

- **Responsible for:** computing the Figma embed URL from the raw `figmaUrl`
  prop (pass-through if it already starts with
  `https://www.figma.com/embed`, else wrap it with `embed_host` +
  url-encoded `url`); rendering the iframe and the loading overlay; tracking a
  `loaded` boolean set by the iframe's `onLoad`; showing the loader until then.
- **Not responsible for:** auth, data fetching, knowing the deck's title/client,
  any navigation within the embedded content (Figma's own viewer handles that).
- **Props:** `figmaUrl: string` (required) — the raw value from Kirby.
- **State:** `loaded: boolean` (initially `false`).

### `next/queries/deckQuery.js` — module (modified)

- **Responsible for:** `getDeckForRender(token)` gains `figmaUrl:
  "page.figma_url.value"` in its `select` and its returned object. `getDeckPages`
  is deleted entirely. `getDeckSecret` is untouched.
- **Not responsible for:** anything about the embed URL's construction (that's
  `DeckEmbed`'s job) — this module only reads the raw stored string from Kirby.

### `next/utility/deckAccess.js` — unchanged

- Already returns `{ status, meta }` where `meta` is whatever
  `getDeckForRender` returns; no code change needed for `meta.figmaUrl` to flow
  through.

### `next/components/DeckNav.js` — deleted

- No more multi-slide navigation to control.

### `next/app/(portal)/portal/[token]/[page]/page.js` — deleted (whole directory)

- No more per-page route; superseded by the single `[token]/page.js` handling
  everything.

### `next/styles/deck.css` — modified

- Remove all `.deck-nav*`, `.deck-cover*`, and `.deck-page*` / `.deck-page--*`
  rules.
- Add `.deck-embed` (fills the viewport below the portal header, positioned
  context for the loader overlay) and `.deck-embed__frame` (`width: 100%;
  height: 100%; border: 0; display: block;`) and `.deck-embed__loader` (centred
  absolutely within `.deck-embed`, opacity-transitioned out when `loaded`).
  Keep the `--deck-header-h` custom property, still relevant for sizing the
  embed area against the fixed logo header.

### Kirby `cms/site/blueprints/pages/deck.yml` — modified (SiteGround upload)

- Add `figma_url` (`type: url`, `label: Figma Deck URL`, help text explaining
  it must have link-sharing set to "Anyone with the link can view").
- Remove `intro` and the entire `pages` section.
- Keep `title`, `client`, `password`, `expiry`, `client_link` exactly as they
  are today (verify against the live Panel before editing — see Section 8,
  Step 2 — since this file is not version-controlled).

### Kirby `deckpage.yml`, `deckpage.php` — deleted (SiteGround)

- The per-page content model no longer exists.

## 7. Files Affected

### Kirby (SiteGround file manager)

| File | New/Mod/Del | Why |
| --- | --- | --- |
| `cms/site/blueprints/pages/deck.yml` | Mod | Add `figma_url`; remove `intro` and the `pages` section. |
| `cms/site/blueprints/pages/deckpage.yml` | Del | Per-page content model removed. |
| `cms/site/templates/deckpage.php` | Del | Its blueprint is gone. |

### Next

| File | New/Mod/Del | Why |
| --- | --- | --- |
| `next/queries/deckQuery.js` | Mod | Remove `getDeckPages`; add `figmaUrl` to `getDeckForRender`. |
| `next/app/(portal)/portal/[token]/page.js` | Mod | Single deck route: gate states + "not ready" + `DeckEmbed`; fixes the current broken `DeckCover` import. |
| `next/app/(portal)/portal/[token]/[page]/page.js` | Del | No pagination route needed; fixes the current broken `DeckPage` import. |
| `next/components/DeckEmbed.js` | New | Iframe + loader component. |
| `next/components/DeckNav.js` | Del | No navigation to control. |
| `next/styles/deck.css` | Mod | Replace `.deck-nav*`/`.deck-cover*`/`.deck-page*` with `.deck-embed*`. |

Unaffected: `deckSession.js`, `deckAccess.js`, `unlock/route.js`,
`PasswordGate.js`, `(portal)/layout.js`, `(site)/layout.js`, `app/layout.js`,
`next.config.js`, `robots.txt`, `sitemap.js`, `MediaItem.js`, `DefImage.js`,
`VideoPlayer.js`, `decks.yml`, `site.yml`, the container content page.

## 8. Step-by-Step Implementation

### Step 1 — `next/queries/deckQuery.js`

- In `getDeckForRender`, add `figmaUrl: "page.figma_url.value"` to the `select`
  object and `figmaUrl: result.figmaUrl || ""` to the returned object.
- Delete the entire `getDeckPages` function.
- Why first: every later Next step depends on `meta.figmaUrl` being available,
  and removing `getDeckPages` here (rather than leaving it as unused dead code)
  keeps the module honest about what the new system actually uses.
- Gotcha: `figma_url` is not a reserved Kirby page method, so `page.figma_url`
  resolves via `content()->get()` as with `client` and `password`.
- Connects to: `[token]/page.js` (Step 3) reads `meta.figmaUrl` from this.

### Step 2 — Kirby blueprint changes (SiteGround)

- Before editing, open the live `deck.yml` in the Panel/file manager and
  confirm its current fields match Section 2's assumption (`title`, `client`,
  `password`, `expiry`, `client_link`, `intro`, a `pages` section). If it
  differs, adjust the edit below accordingly rather than blindly overwriting.
- Add `figma_url`: `type: url`, `label: Figma Deck URL`, `help: "Must have
  link-sharing set to 'Anyone with the link can view'. Paste the deck's share
  link (or Figma's own embed URL, if you used Share → Embed)."`
- Remove the `intro` field and the entire `pages` section.
- Delete `cms/site/blueprints/pages/deckpage.yml` and
  `cms/site/templates/deckpage.php`.
- Why now: unblocks manually testing the rest of the steps against a real deck.
  Set an existing test deck's `figma_url` to a Figma Slides link with public
  view access (the one provided during planning is a suitable candidate) once
  this is uploaded.
- Gotcha: upload the `deck.yml` change after deleting the `deckpage` files, so
  the Panel never briefly references a blueprint the `pages` section pointed at
  (moot in practice since both are removed together, but keeps upload order
  safe).

### Step 3 — `next/app/(portal)/portal/[token]/page.js`

- Remove the `import DeckCover from "../../../../components/DeckCover"` and
  `import DeckNav from "../../../../components/DeckNav"` and `import {
  getDeckPages } from "../../../../queries/deckQuery"` lines (this file
  currently only needs `resolveDeckAccess` from `deckAccess.js` and
  `PasswordGate`).
- Add `import DeckEmbed from "../../../../components/DeckEmbed"`.
- Keep the `notfound` → `notFound()`, `expired` → message, and `locked` →
  `<PasswordGate token={params.token} deckTitle={meta.title} />` branches
  exactly as they are.
- Replace the final branch: if `!meta.figmaUrl`, return the same-styled "not
  ready" block used elsewhere (`<div className="px-6 max-w-[420px] mx-auto
  pt-24"><p className="font-secondary text-md">This deck is not ready
  yet.</p></div>`); otherwise `return <DeckEmbed figmaUrl={meta.figmaUrl} />;`.
- Keep `export const dynamic = "force-dynamic"` and the existing
  `generateMetadata`.
- Why after Steps 1–2: needs `meta.figmaUrl` (Step 1) and a real value to test
  against (Step 2).
- Gotcha: this file's current broken state (importing a deleted `DeckCover`)
  means the app will not build until this step lands — treat Steps 1–3 as a
  单-unit before attempting any build.
- Connects to: renders the component built in Step 4.

### Step 4 — `next/components/DeckEmbed.js`

- `"use client"`. Local constant `EMBED_HOST = "flowersfullservice"` (or
  similar identifying string — any value is accepted by Figma's embed
  endpoint; it does not need prior registration).
- A small local helper (module-level function, not exported) `buildEmbedSrc(url)`:
  if `url` starts with `"https://www.figma.com/embed"`, return it unchanged;
  otherwise return `` `https://www.figma.com/embed?embed_host=${EMBED_HOST}&url=${encodeURIComponent(url)}` ``.
- `const [loaded, setLoaded] = useState(false)`.
- Render a wrapper `div.deck-embed`: a loader element (e.g. the FLOWERS mark or
  "Loading deck…" text) with a class toggled by `loaded` (hidden/opacity-0 once
  true), and `<iframe src={buildEmbedSrc(figmaUrl)} className="deck-embed__frame"
  title="Deck" allow="fullscreen" allowFullScreen onLoad={() =>
  setLoaded(true)} />`. No `sandbox` attribute (see Section 4).
- Why after Step 3: only meaningful once something renders it with a real
  `figmaUrl`.
- Gotcha: verify the constructed embed URL against the actual test deck during
  Step 8 — this is the one area flagged as genuinely uncertain (Section 4). If
  the wrapped URL does not render the deck cleanly, get the exact embed URL
  from Figma's Share → Embed dialog for that deck and paste that into Kirby's
  `figma_url` instead; the pass-through branch in `buildEmbedSrc` handles that
  case without any code change.
- Connects to: consumes `meta.figmaUrl` passed down from Step 3.

### Step 5 — delete `next/app/(portal)/portal/[token]/[page]/page.js`

- Remove the file and, if left empty, the `[page]` directory.
- Why now, not earlier: confirms nothing in Steps 1–4 still depends on it
  (nothing does — it was only ever reached via links `DeckNav` generated,
  which no longer exist after Step 6).
- Gotcha: this also removes the app's only other consumer of the old
  `getDeckPages`/`DeckPage` pattern; grep for `DeckPage` and `getDeckPages`
  afterward to confirm no references remain anywhere in `next/`.

### Step 6 — delete `next/components/DeckNav.js`

- Remove the file.
- Why after Step 5: Step 5 removes the only route that rendered it; confirm via
  grep for `DeckNav` before deleting that nothing else imports it (the
  `[token]/page.js` rewritten in Step 3 no longer does).

### Step 7 — `next/styles/deck.css`

- Remove every `.deck-nav*`, `.deck-cover*`, and `.deck-page*`/`.deck-page--*`
  rule (including their `@media` block).
- Keep the `:root { --deck-header-h: ... }` declaration.
- Add:
  - `.deck-embed` — `position: relative; min-height: calc(100vh -
    var(--deck-header-h)); display: flex;` (establishes the positioning context
    for the loader and fills the area below the portal header).
  - `.deck-embed__frame` — `width: 100%; height: 100%; border: 0; display:
    block;` (and implicitly `flex: 1` if needed so it fills `.deck-embed`).
  - `.deck-embed__loader` — centred absolutely within `.deck-embed`
    (`position: absolute; inset: 0; display: flex; align-items: center;
    justify-content: center;`), with a `transition: opacity 0.3s` and an
    `.is-hidden` (or similar) modifier setting `opacity: 0; pointer-events:
    none;` for the loaded state.
- Why last among the code changes: the class names are only settled once
  `DeckEmbed` (Step 4) exists.

### Step 8 — Build and manual QA

- `npm run build` in `next/`. Expect the route list to show `/portal/[token]`
  and `/portal/[token]/unlock` only (no `/portal/[token]/[page]`), and no
  references anywhere to `DeckPage`, `DeckCover`, `DeckNav`, or `getDeckPages`.
- Then the checks in Section 10, most importantly confirming the embed URL
  actually renders the specific Figma Slides deck cleanly.

## 9. Edge Cases

- **`figma_url` not set.** Handled explicitly — "This deck is not ready yet."
  No iframe is rendered.
- **`figma_url` set but the Figma file's sharing is not public.** Figma renders
  its own "request access" / sign-in prompt inside the iframe. This cannot be
  detected or intercepted from the parent page (cross-origin) — the only
  mitigation is the blueprint's help text reminding staff to set sharing before
  publishing a deck link.
- **`figma_url` is not a valid Figma URL (typo, wrong domain).** Figma's embed
  endpoint shows its own error state inside the iframe; again undetectable from
  our side. No client-side validation beyond the field being a `url` type in
  Kirby (format-only, not content-aware).
- **Iframe never fires `load` (network failure, Figma outage).** The loader
  would show indefinitely with the implementation as specced. Acceptable for
  v1 given how rarely this would happen; if it becomes an issue, a later
  addition (not in this plan) would be a timeout that swaps the loader for a
  "This is taking a while — open the deck directly" link using the raw
  (non-embed) Figma URL as an escape hatch.
- **Client on a very small viewport / in-app browser (e.g. opened from an email
  client's embedded browser).** Figma's own embed is responsive within its
  iframe; `.deck-embed__frame` filling 100%/100% is all this side needs to do.
  Not separately tested beyond a standard mobile-viewport check.
- **Dark mode.** The Figma iframe content stays light (or whatever Figma
  renders); the surrounding chrome (header, loader, background) follows the
  site's theme as normal. This is the accepted seam from Section 4, not a bug.
- **Deck link shared onward / found later.** Accepted per the clarification
  answer: the Figma file itself has no password once its sharing is public;
  only the `/portal/<token>` wrapper is gated. Documented, not mitigated.
- **`PORTAL_SESSION_SECRET` missing in an environment.** Unchanged from prior
  plans: `verifyDeckToken` fails closed, the gate always shows locked.
- **Existing decks authored under the old four-layout model.** Their `layout`/
  `body`/child-page content becomes orphaned data in Kirby once `deck.yml` and
  `deckpage.yml` are changed/removed; it is never read again. No migration is
  needed since nothing is in production.
- **Old broken build state.** Resolved as a side effect of Steps 1, 3, and 5 —
  called out explicitly so it is not mistaken for a new problem introduced by
  this plan.

## 10. Test Considerations

**Prerequisites**

- Kirby `deck.yml` updated per Step 2; a test deck's `figma_url` set to a real
  Figma Slides (or other) deck URL with link-sharing set to "Anyone with the
  link can view."

**Manual**

1. `/portal/<token>` with no session → password screen, unchanged look
   (FLOWERS logo header, no site nav). View source: no Figma URL, no deck
   content, before unlocking.
2. Wrong password → "Incorrect password." (unchanged).
3. Correct password → the branded loader appears, then fades out once the
   Figma deck has loaded inside the iframe; the deck fills the area below the
   header edge-to-edge.
4. Interact with the embedded deck (advance slides / pan / whatever the
   content type supports) — confirm it behaves like Figma's normal embedded
   viewer, with no interference from the page around it.
5. Refresh the page while unlocked — still unlocked, embed reloads (a fresh
   loader/fade cycle is expected and fine).
6. Clear the `deck_session` cookie → back to the password screen.
7. Set the deck's `expiry` to yesterday → "This link has expired." (unchanged),
   and the iframe never renders.
8. Clear the test deck's `figma_url` → "This deck is not ready yet." after
   unlocking.
9. Confirm `/portal/<unknown-token>` still 404s and
   `/portal/<token>/unlock` still routes to the `POST` handler unchanged.
10. Confirm `/portal/<token>/1` (the old paginated URL) now 404s — the route no
    longer exists.
11. Test on a real mobile device or emulator: header + full-bleed embed layout
    holds up, no horizontal scroll on the wrapper page.
12. If the deck's Figma sharing is intentionally left private for a quick
    negative test, confirm the page around the iframe still renders correctly
    even though Figma's own content inside shows an access-denied state (i.e.
    our page does not break, even if the embedded content does).

**Regression**

13. Public site routes (`/`, `/about`, `/gallery`, `/projects/<slug>`, `/shop`,
    `/info`) unaffected — this plan touches nothing under `(site)`.

**Build**

14. `npm run build` clean; route list shows `/portal/[token]` and
    `/portal/[token]/unlock` only under `/portal`; no build or type errors from
    the removed files' former importers.

**Automated**

- Not warranted for this plan's small surface area; a unit test for
  `buildEmbedSrc`'s pass-through-vs-wrap logic would be the only reasonable
  candidate if the team wants one (two cases: an already-`/embed` URL returned
  unchanged, and a normal share URL correctly wrapped with `embed_host` and a
  url-encoded `url` param).

## 11. Implementation Order

1. `next/queries/deckQuery.js` — **modify** — add `figmaUrl` to
   `getDeckForRender`; remove `getDeckPages`. Everything else depends on
   `meta.figmaUrl` existing.
2. `cms/site/blueprints/pages/deck.yml` — **modify (SiteGround)** — add
   `figma_url`, remove `intro`/`pages`; verify the live file first. Delete
   `deckpage.yml` and `deckpage.php` alongside it. Set a test deck's
   `figma_url` once uploaded.
3. `next/app/(portal)/portal/[token]/page.js` — **modify** — the single deck
   route; also fixes the current broken build. Depends on Step 1's
   `meta.figmaUrl` and, for testing, Step 2's real value.
4. `next/components/DeckEmbed.js` — **new** — the iframe/loader component
   rendered by Step 3.
5. `next/app/(portal)/portal/[token]/[page]/page.js` — **delete** — no longer
   reachable or needed once Step 3 removes the only links to it.
6. `next/components/DeckNav.js` — **delete** — no longer imported after
   Step 5.
7. `next/styles/deck.css` — **modify** — drop the old viewer's rules, add
   `.deck-embed*`; done once Step 4's class names are settled.
8. Build, then run the Section 10 checks against a real Figma Slides deck.
