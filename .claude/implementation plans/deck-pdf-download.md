# Implementation Plan: Deck PDF Download

## 1. Goal

Let staff optionally attach a PDF to a deck in the Kirby Panel, and show a
download link for it on that deck's portal page once the client has unlocked
it. This is additive to the Figma-embed deck viewer built in
`deck-figma-embed.md` — it does not change how the Figma deck itself is
displayed.

## 2. Current System Behaviour

- **Kirby.** `cms/site/blueprints/pages/deck.yml` (SiteGround, not
  version-controlled) has `title`, `client`, `password`, `expiry`,
  `figma_url`, and `client_link` (an `info` field rendering
  `https://www.flowersfullservice.art/portal/{{ page.uuid.id }}`). No file
  upload field exists on the deck.
- **Query.** `next/queries/deckQuery.js`'s `getDeckForRender(token)` runs one
  KQL request selecting `title`, `client`, `parentSlug`, `intro`, `expiry`,
  `figmaUrl` (`page.figma_url.value`), returning `null` unless
  `parentSlug === "decks"`. `getDeckSecret(token)` is separate (`password`,
  `expiry`, `parentSlug`), used only by the unlock route.
- **Access.** `next/utility/deckAccess.js`'s `resolveDeckAccess(token)` calls
  `getDeckForRender`, checks expiry, checks the `deck_session` cookie, and
  returns `{ status: "notfound" | "expired" | "locked" | "unlocked", meta }`.
- **Route.** `next/app/(portal)/portal/[token]/page.js` is the single deck
  route (`force-dynamic`). It switches on `status`: `notfound` → `notFound()`;
  `expired` → a message; `locked` → `<PasswordGate token deckTitle=
  {meta.title} />`; `unlocked` → if `meta.figmaUrl` is falsy, a "This deck is
  not ready yet." message, otherwise `<DeckEmbed figmaUrl={meta.figmaUrl} />`.
- **Viewer.** `next/components/DeckEmbed.js` (client) renders the Figma iframe
  with a fade-out loader. `next/app/(portal)/layout.js` wraps every portal
  route in a header (`py-8 px-6`, the FLOWERS logo, `--deck-header-h: 80px` is
  the assumed/matching height in `next/styles/deck.css`) and a flush content
  wrapper — it receives only `{ children }`, with no access to per-deck data,
  since Next layouts cannot receive props from the pages they wrap.
- **Styling.** `next/styles/deck.css` currently defines `:root {
  --deck-header-h: 80px; }`, `.deck-embed` (`position: relative; height:
  calc(100vh - var(--deck-header-h));`), `.deck-embed__frame` (absolutely
  positioned, fills `.deck-embed`), and `.deck-embed__loader` (centred overlay
  with an `.is-hidden` fade state).
- **Kirby file URLs are public.** Every file Kirby serves (already true for
  deck images elsewhere in this project) is reachable at a plain URL with no
  auth of its own; access control is entirely "the URL isn't shown to you
  until you're past the password gate." This project has already accepted that
  trade-off for deck media.

## 3. Desired Behaviour

- The deck edit form in Kirby gains one new, optional field: `pdf`, accepting
  a single PDF file.
- On `/portal/<token>`, once unlocked (regardless of whether the deck has a
  Figma URL set), if the deck has a PDF attached, a small download control
  appears fixed in the top-right corner of the page, vertically aligned with
  the FLOWERS logo in the header — visually part of the top bar without any
  change to the shared layout file.
- Clicking it downloads the PDF. The suggested filename is always
  `<deck title>.pdf` (sanitised for filesystem safety), regardless of what the
  file was originally named when uploaded.
- If a deck has no PDF attached, nothing renders — no placeholder, no
  disabled state.
- The link points directly at the Kirby-served file URL. It is only ever
  rendered in the page's output after the visitor is unlocked, but the URL
  itself carries no additional protection — a leaked link works without a
  password, exactly like the existing trade-off for deck images. This is
  accepted, not fixed, in this plan.

## 4. Architecture Considerations

**The download control is rendered by the page, not the shared layout.**
`next/app/(portal)/layout.js` wraps every portal route and has no access to
per-deck data (Next layouts receive only `children`, not props from the page
they wrap, and this project is not introducing a context provider or a second
data fetch in the layout just for this). Fixed positioning
(`position: fixed`) lets an element rendered by the page visually sit in the
same row as the logo header without needing to live inside `layout.js` or
receive any data through it. This keeps the change contained to the deck
route and its own new component.

**Filename is built client-independent, in the component, from `title`.** The
deck title is already fetched by `getDeckForRender` for other purposes
(`PasswordGate`'s heading). Reusing it avoids a second Kirby field just for a
display name. The HTML `download` attribute controls the *suggested* saved
filename regardless of the source URL's actual filename, so a fixed
`<title>.pdf` name is a browser-native feature, not something requiring
server-side renaming of the uploaded file. Kirby lets the underlying uploaded
filename be anything; this plan does not touch it.

**No filename sanitisation library.** Deck titles are short, staff-entered
strings; a minimal inline replacement of characters invalid in filenames on
Windows/macOS (`\ / : * ? " < > |`) with `-` is enough, done directly in the
component. Pulling in a slugify dependency for this is not warranted.

**Direct Kirby URL, not a proxied download route.** Chosen explicitly over
streaming the PDF through a cookie-checked Next route (the pattern used for
images in the reverted `deck-figma-publishing.md` plan). That approach closes
the leaked-link gap but reintroduces a server round-trip and a new route for
a single optional file, which is more machinery than this feature's value
justifies given the project's established preference for the simpler option
here. If a specific deck's PDF is sensitive enough to need real protection,
that is a reason to revisit this decision for that case, not to build the
proxy speculatively now.

**Field name `pdf` does not collide with a reserved Kirby method.** Checked
against the KQL plugin's `Model::allowedMethodsForFiles()` list (`audio`,
`code`, `documents`, `file`, `files`, `hasAudio`, `hasCode`, `hasDocuments`,
`hasFiles`, `hasImages`, `hasVideos`, `image`, `images`, `videos`) — `pdf` is
not among them, so `page.pdf` resolves as a normal content field via
`content()->get('pdf')`, the same way `client`, `password`, and `figma_url`
already do. This is the same class of check that forced the `visual`/`body`
renames earlier in this project's history, done proactively here rather than
discovered by a KQL 400 error.

**Download control shows in both `unlocked` sub-states.** The deck route
currently branches, once unlocked, into "no Figma URL → not ready message" or
"Figma URL set → embed". A deck can reasonably have a PDF attached before its
Figma URL is ready, or independently of it, so the download control is
computed once per request and included in both branches rather than only the
embed branch.

## 5. Data Flow

**Authoring.** A staff member opens a deck in the Kirby Panel and uploads a
PDF into the new `pdf` field (or leaves it empty). Kirby stores the file
alongside the deck page's content as it does for any other file field.

**Request.** A client requests `/portal/<token>`. `resolveDeckAccess` calls
`getDeckForRender`, whose single KQL request now also asks for the `pdf`
field's file URL. The route receives `meta.pdfUrl` (a URL string or empty
string) alongside the existing `meta` fields. Once `status === "unlocked"`,
the route computes a `download` control element when `meta.pdfUrl` is
truthy, passing `meta.pdfUrl` and `meta.title` to it, and includes that
element in whichever of the two unlocked branches it returns.

**Render.** `DeckDownload` builds the display filename by trimming `title`,
replacing filesystem-unsafe characters, and appending `.pdf`; it renders a
single `<a href={pdfUrl} download={fileName}>` fixed in the top-right corner.
No further data movement — the browser handles the actual file transfer
directly from Kirby's server when the link is clicked.

## 6. Component Responsibilities

### `next/queries/deckQuery.js` — module (modified)

- **Responsible for:** `getDeckForRender` gains `pdf: { query:
  "page.pdf.toFile", select: { url: true } }` in its `select` object, and
  `pdfUrl: result.pdf?.url || ""` in its returned object.
- **Not responsible for:** filename sanitisation or anything about how the
  download control renders — this module only surfaces the raw file URL.

### `next/components/DeckDownload.js` — component (new)

- **Responsible for:** computing the sanitised `<title>.pdf` filename from the
  `title` prop; rendering the fixed-position `<a>` download link with `href`
  set to `pdfUrl`, the `download` attribute set to that filename, and a
  visible label/icon.
- **Not responsible for:** deciding whether to render at all (the caller only
  renders this component when `pdfUrl` is truthy — see Step 4), auth, data
  fetching.
- **Props:** `pdfUrl: string` (required, assumed non-empty by the time this
  renders); `title: string` (required, used to build the filename; falls back
  to a fixed default like `"Deck"` if empty after sanitisation so the
  attribute is never blank).
- **State:** none. No `"use client"` needed — a plain anchor tag needs no
  interactivity.

### `next/app/(portal)/portal/[token]/page.js` — server component (modified)

- **Responsible for:** after the `locked` branch, computing `const download =
  meta.pdfUrl ? <DeckDownload pdfUrl={meta.pdfUrl} title={meta.title} /> :
  null;` once, then including `{download}` in both the "not ready" and the
  `DeckEmbed` returns.
- **Not responsible for:** anything about the download link's markup or
  styling (delegated to `DeckDownload`).
- **Props/state:** unchanged from `deck-figma-embed.md`.

### `next/app/(portal)/layout.js` — unchanged

- Confirmed out of scope per Section 4 — the header stays exactly as it is;
  the download control only visually aligns with it via fixed positioning.

### Kirby `cms/site/blueprints/pages/deck.yml` — modified (SiteGround upload)

- Add `pdf`: `type: files`, `label: PDF`, `multiple: false`, `accept:
  application/pdf`, `help: Optional. Shown as a download link on the portal
  page once the client is unlocked.` Placed after `figma_url`, before
  `client_link`.

## 7. Files Affected

### Kirby (SiteGround file manager)

| File | New/Mod | Why |
| --- | --- | --- |
| `cms/site/blueprints/pages/deck.yml` | Mod | Add the optional `pdf` file field. |

### Next

| File | New/Mod | Why |
| --- | --- | --- |
| `next/queries/deckQuery.js` | Mod | `getDeckForRender` returns `pdfUrl`. |
| `next/components/DeckDownload.js` | New | The fixed-position download link. |
| `next/app/(portal)/portal/[token]/page.js` | Mod | Render the download control in both unlocked branches. |
| `next/styles/deck.css` | Mod | Add `.deck-download` positioning/appearance rules. |

Unaffected: `deckAccess.js`, `deckSession.js`, `unlock/route.js`,
`PasswordGate.js`, `(portal)/layout.js`, `DeckEmbed.js`, `(site)/layout.js`,
`app/layout.js`, everything under the public site.

## 8. Step-by-Step Implementation

### Step 1 — `next/queries/deckQuery.js`

- In `getDeckForRender`, add `pdf: { query: "page.pdf.toFile", select: { url:
  true } }` to the `select` object.
- Add `pdfUrl: result.pdf?.url || ""` to the returned object.
- Why first: every later step depends on `meta.pdfUrl` being available.
- Gotcha: `page.pdf.toFile` resolves to `null` when the field is empty (the
  same pattern already used for optional single-file fields elsewhere in this
  query module); `result.pdf` will then be `null`, and the optional-chaining
  default handles it.
- Connects to: `[token]/page.js` (Step 3) reads `meta.pdfUrl`.

### Step 2 — Kirby blueprint change (SiteGround)

- Open the live `deck.yml`, add the `pdf` field as specified in Section 6,
  after `figma_url` and before `client_link`. Upload.
- On a test deck, upload a PDF into the new field to have something real to
  test against.
- Why now: unblocks manual testing of the rest of the steps.
- Gotcha: `multiple: false` restricts the Panel to a single file for this
  field; it does not need any special validation beyond `accept:
  application/pdf`.

### Step 3 — `next/components/DeckDownload.js`

- No `"use client"` — plain server-renderable anchor.
- A local, non-exported `sanitiseFilename(title)` function: trim `title`;
  replace any of `\ / : * ? " < > |` with `-`; if the result is empty after
  trimming, fall back to `"Deck"`; return `` `${result}.pdf` ``.
- Render `<a href={pdfUrl} download={sanitiseFilename(title)}
  className="deck-download">` containing a short visible label (e.g.
  "Download PDF" text, styled small) — exact wording left to match the site's
  existing tone (short, lowercase-uppercase-via-CSS like other buttons in this
  project, e.g. `PasswordGate`'s submit button uses `uppercase font-primary
  font-bold`).
- Why after Step 1: needs real `pdfUrl`/`title` values to render meaningfully,
  though it can be written and reviewed independently.
- Connects to: rendered by Step 4.

### Step 4 — `next/app/(portal)/portal/[token]/page.js`

- Add `import DeckDownload from "../../../../components/DeckDownload";`.
- After the `locked` branch's `return`, add: `const download = meta.pdfUrl ?
  <DeckDownload pdfUrl={meta.pdfUrl} title={meta.title} /> : null;`.
- In the "not ready" branch, wrap the existing message and `{download}` in a
  fragment (`<>...</>`) so both render as siblings.
- In the final return, change `return <DeckEmbed figmaUrl={meta.figmaUrl}
  />;` to `return <>{download}<DeckEmbed figmaUrl={meta.figmaUrl}
  /></>;`.
- Why after Steps 1 and 3: needs both `meta.pdfUrl` and the `DeckDownload`
  component to exist.
- Gotcha: `download` being `null` when there is no PDF means both branches
  render exactly as before in that case — verify no visual change for decks
  without a PDF.
- Connects to: the last piece wiring data to display.

### Step 5 — `next/styles/deck.css`

- Add `.deck-download`: `position: fixed; top: 0; right: 0; height:
  var(--deck-header-h); display: flex; align-items: center; padding: 0
  1.5rem; z-index: 10;` (the `z-index` ensures it sits above the Figma iframe,
  which is a stacking-context-bearing element via its own rendering, not
  because the iframe would otherwise intercept clicks outside its own box —
  this is defensive, not strictly required). Style the visible label to match
  existing small-button conventions in `deck.css`/the portal (e.g. `font-
  primary`, `text-sm`/`text-md`, `uppercase`).
- Why last: the class name is only meaningful once `DeckDownload` (Step 3)
  uses it.

### Step 6 — Build and manual QA

- `npm run build` in `next/`. Expect no new routes, no errors; `DeckDownload`
  compiles as a server component.
- Then the checks in Section 10.

## 9. Edge Cases

- **No PDF attached.** `meta.pdfUrl` is `""`, `download` is `null`, nothing
  renders in either unlocked branch. No visual change from
  `deck-figma-embed.md`'s current behaviour.
- **Deck title is empty or entirely made of filesystem-unsafe characters.**
  `sanitiseFilename` falls back to `"Deck.pdf"` rather than producing a blank
  or malformed `download` attribute.
- **Multiple files somehow present on the field.** `multiple: false` in the
  blueprint prevents this from the Panel; `.toFile` on a files field returns
  a single file (the first) regardless, so even a manually-edited content file
  with multiple entries would not error.
- **PDF URL leaked or shared onward.** Accepted per Section 4 — the file has
  no protection beyond not being shown before the gate. Documented, not
  mitigated, consistent with deck images.
- **Very large PDF.** No special handling — the browser downloads directly
  from Kirby; this Next app is not in the transfer path and has no
  timeout/size exposure.
- **Mobile Safari and the `download` attribute.** Some mobile browsers open a
  PDF in a new tab/viewer instead of forcing a save-to-disk download; this is
  a known, long-standing browser inconsistency with the `download` attribute
  and is not something this plan can control from either the server or the
  anchor tag. Not treated as a bug.
- **Deck has a PDF but no Figma URL.** The "not ready" message still shows the
  download control — deliberate, per Section 4.
- **`PORTAL_SESSION_SECRET` missing / session invalid.** Unchanged from prior
  plans — the gate stays locked, `meta`/`download` are never reached.

## 10. Test Considerations

**Prerequisites**

- Kirby `deck.yml` updated per Step 2; a test deck with a PDF uploaded, and
  (for full coverage) a second test deck left without one.

**Manual**

1. Unlock the deck with a PDF attached → a small download control appears
   fixed top-right, aligned with the logo header.
2. Click it → the PDF downloads (or opens, on browsers that do that) with the
   filename `<deck title>.pdf`, not the original uploaded filename.
3. Unlock a deck with no PDF attached → no download control appears, no
   layout shift or placeholder.
4. On a deck with a PDF but no `figma_url` set → the "not ready" message shows
   alongside the download control.
5. Confirm the control stays visually aligned with the header on a resized/
   mobile viewport (fixed positioning, not affected by the Figma iframe's own
   scrolling).
6. Confirm the control does not appear on the locked (password) screen or the
   expired-link screen — only after `status === "unlocked"`.
7. Test a deck title containing characters like `/` or `:` — confirm the
   downloaded filename is sanitised and not broken.

**Regression**

8. Existing deck-embed behaviour (loader, iframe fill, gate flow) unchanged
   for decks both with and without a PDF.

**Build**

9. `npm run build` clean; no new or broken routes.

**Automated**

- Not warranted for this plan's size; if desired, a unit test for
  `sanitiseFilename` covering an empty title, a title with unsafe characters,
  and a normal title would be the only reasonable candidate.

## 11. Implementation Order

1. `next/queries/deckQuery.js` — **modify** — add `pdfUrl` to
   `getDeckForRender`; everything else depends on it.
2. `cms/site/blueprints/pages/deck.yml` — **modify (SiteGround)** — add the
   `pdf` field; upload a test PDF to a test deck.
3. `next/components/DeckDownload.js` — **new** — the download link component.
4. `next/app/(portal)/portal/[token]/page.js` — **modify** — wire the
   download control into both unlocked branches.
5. `next/styles/deck.css` — **modify** — `.deck-download` positioning and
   appearance, once the component's class name is settled.
6. Build, then run the Section 10 checks against a deck with and without a
   PDF attached.
