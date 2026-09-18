# Fix white flash during navigation in the client deck portal

## 1. Goal

Eliminate the flash of white/cream that appears when navigating between pages inside the client deck portal (`/portal/[token]` and its sub-states: password gate, expired, Figma embed, PDF viewer). The flash is visible during initial load and during in-portal navigation (e.g. submitting the password gate, switching between deck states).

## 2. Current System Behaviour

The whole site shares one root layout (`next/app/layout.js`) that renders a single `<html><body>`. The `<html>` element's background is driven by the CSS variable `--color-bg` (`next/styles/style-guide.css`):

- Default (light theme): `--color-bg: #F0EFEB` (cream), set on `:root`.
- Dark theme: `--color-bg: #000000`, set only when `html` has the `dark` class.

The `dark` class is toggled by a blocking inline script in `next/app/layout.js` (lines 55-63) that reads `localStorage.getItem('theme')` or falls back to `prefers-color-scheme`. This is a **site-wide** light/dark toggle for the marketing site, unrelated to the portal. A client opening a shared deck link has, in the overwhelming majority of cases, never set this preference, so `html` renders with the cream background.

`body` has no explicit `background-color` (style-guide.css lines 62-67), so it shows whatever `html` has underneath.

The portal route group layers a black background only on a child `<div>`:

- `next/app/(portal)/layout.js` wraps children in `<div className="portal-shell portal-shell--dark" style={{backgroundColor:"#000000"}}>`.
- `next/app/(portal)/portal/[token]/loading.js` (Next's automatic route-level Suspense fallback) also renders a black `<div>`.

Because the `<html>`/`<body>` behind these divs is cream, any moment where the black div is not yet painted, or is unmounted/remounted during a transition, exposes the cream background as a white-ish flash. This happens on:

- Initial page load, before hydration/paint of the portal shell div completes.
- `PasswordGate.js` calling `router.refresh()` after a successful unlock (next/app/(portal)/portal/[token]/PasswordGate.js line 35), which re-runs the `force-dynamic` server component in `page.js` and swaps the rendered subtree.
- The `next/dynamic(() => import(DeckPdfViewer), { ssr: false })` swap in `page.js` (lines 9-12), which has no `loading` option, so there is a client-only mount gap with nothing guaranteed to render in its place besides whatever was already there.

## 3. Desired Behaviour

Inside the `/portal` route group, the page background must be black at all times, on every navigation and every intermediate render state, with no dependency on the site-wide theme toggle or on any JavaScript running before first paint. Analytics tags (Google Analytics, GTM, Microsoft Clarity) must continue to fire on portal pages, matching current behaviour. The site-wide dark-mode toggle script must not run on portal pages, since the portal is unconditionally black regardless of the visitor's site theme preference.

## 4. Architecture Considerations

Next.js App Router supports multiple root layouts: a route group's `layout.js` may render its own `<html>` and `<body>` instead of relying on the shared one in `app/layout.js`, as long as the route group is not nested under a layout that already renders `<html>`. Doing this for `(portal)` removes the dependency on the marketing site's `--color-bg` variable and its JS-driven `dark` class entirely — the portal's `<html>`/`<body>` background is a static, always-black CSS rule, so there is no state to get out of sync and no script timing to race against. This is a structural fix rather than a patch: it makes the flash impossible by construction, instead of papering over it with an inline script that has to run before the browser's first paint.

Trade-off: `next/app/layout.js` currently owns metadata, font preconnects, the theme-toggle script, and the GA/GTM/Clarity tags. Splitting the portal into its own root layout means these are no longer inherited automatically — each needs an explicit decision. Per the confirmed scope: GA/GTM/Clarity are re-added to the portal's own layout (tracking must keep working); the theme-toggle script and font/metadata concerns tied to the marketing site are not carried over, since the portal doesn't use `--color-bg`-driven theming.

Because `(portal)` becomes its own root, Next.js requires it to define its own `<html>` and `<body>` tags and its own minimal `metadata`/`viewport` exports — it can no longer rely on `next/app/layout.js`'s `metadata` export for things like `metadataBase`, so the portal's `generateMetadata` in `page.js` (already present) continues to apply per-page, but the root-level `metadata` object in the portal's own layout should set a sane default (`robots: noindex`, matching the existing `(portal)/layout.js` metadata block) rather than inheriting the marketing site's OpenGraph/Twitter data.

## 5. Data Flow

No application data flow changes. This is purely a rendering/DOM-structure and styling change:

- Request comes in for `/portal/[token]`.
- Next.js resolves the route through `(portal)`'s own root layout instead of the shared `app/layout.js`.
- The portal root layout renders `<html><body style="background:#000">` and injects the GA/GTM/Clarity scripts directly (duplicated from `app/layout.js`, scoped to this layout only).
- `page.js` continues to call `resolveDeckAccess(token)` and render one of: expired message, `PasswordGate`, `DeckEmbed`, `DeckPdfViewer`, or "not ready yet" — unchanged.
- `loading.js` continues to serve as the route-level Suspense fallback while `page.js`'s async work resolves — unchanged, still black.

## 6. Component Responsibilities

**`next/app/(portal)/layout.js` (modified — becomes a root layout)**
- Responsible for: rendering the portal's own `<html>` and `<body>`, setting the permanent black background on `body`, rendering the GA/GTM/Clarity analytics scripts, setting portal-wide `metadata` (noindex/nofollow), wrapping `children` in the existing `portal-shell portal-shell--dark` div (kept for the CSS class hooks already used elsewhere, e.g. deck.css).
- Not responsible for: the site-wide theme toggle, font preconnects for the marketing site, marketing SEO metadata (title/OG/Twitter) beyond the per-page overrides already supplied by `page.js`'s `generateMetadata`.
- Props: `children` (React node, required) — the matched route's rendered output.
- Internal state: none (server component).

**`next/app/layout.js` (unchanged in structure, unaffected by the split)**
- Continues to serve every non-portal route exactly as today. No code path inside it needs to change, since `(portal)` no longer nests under it once it defines its own root `<html>`.

**`next/app/(portal)/portal/[token]/page.js` (modified)**
- Responsible for: resolving deck access and rendering the correct state (expired / locked / figma / pdf / not-ready), and passing a black-matching `loading` fallback to the `DeckPdfViewer` dynamic import.
- Not responsible for: the page-level background (owned by the root layout now) or analytics.
- Props: `params` (object with `token`, required, from route segment).
- Internal state: none (server component); access resolution is awaited per-request.

**`next/app/(portal)/portal/[token]/loading.js` (unchanged)**
- Responsible for: black placeholder while `page.js`'s async `resolveDeckAccess` call is pending. No changes needed; verified already black and now consistent with the always-black root layout underneath it.

**`next/components/DeckPdfViewer.js` (unchanged, verified only)**
- Its own `deck-pdf-viewer` container already sets `background-color: #000000` in `next/styles/deck.css` (line 45). No change required, but confirmed as part of this fix so the dynamic-import loading gap (handled at the `next/dynamic` call site in `page.js`, not inside this component) has a consistent black backdrop once it does mount.

**`next/components/DeckEmbed.js` (unchanged, verified only)**
- Its loader (`deck-embed__loader`) has no explicit background color in `deck.css`; it currently relies on the black `portal-shell` behind it. Since the portal shell/root layout is now unconditionally black, this remains correct with no code change, but is flagged in Edge Cases below in case the loader div needs to be full-bleed.

## 7. Files Affected

- `next/app/(portal)/layout.js` — converted from a nested layout into a root layout with its own `<html>`/`<body>`, black background, re-added GA/GTM/Clarity scripts, portal-scoped metadata.
- `next/app/(portal)/portal/[token]/page.js` — add a `loading` option to the `next/dynamic()` call for `DeckPdfViewer` so the client-only swap-in has an explicit black placeholder instead of an implicit gap.
- `next/styles/style-guide.css` — add an explicit `background-color: var(--color-bg);` rule on `body` (currently missing) as a general correctness fix for the marketing site, unrelated to the portal split but noticed during investigation; does not affect the portal once it has its own root layout.
- `next/app/layout.js` — no functional change required; confirm (during implementation) that removing `(portal)` from its subtree does not break any relative import or shared context (`AppWrapper`, `ThemeProvider`) that the portal pages might still rely on (see Edge Cases).

## 8. Step-by-Step Implementation

**Step 1 — Confirm portal pages' dependency on `AppWrapper` / `ThemeProvider`.**
Before restructuring, check whether `PasswordGate.js`, `DeckEmbed.js`, or `DeckPdfViewer.js` consume any context provided by `AppWrapper` (`next/context`) or `ThemeProvider` (`next/context/ThemeContext`), both of which currently wrap `<body>` in `app/layout.js`. If a portal component calls a hook from either provider, that provider must be added inside the new portal root layout too (wrapping the portal's own `<body>` contents), otherwise it will throw at runtime once `(portal)` no longer nests under the shared layout. This is a read-only investigation step with no file changes yet, but its outcome determines whether Step 2 needs to add provider wrapping.

**Step 2 — Rewrite `next/app/(portal)/layout.js` as a root layout.**
Change the component to render `<html lang="en"><body>` instead of a bare `<div>`. Move the black background from the current inline `style={{backgroundColor:"#000000"}}` on the wrapper div onto `<body>` (as an inline style or a dedicated CSS class — inline style is simplest and matches the existing pattern already used in `loading.js` and the current `(portal)/layout.js`). Keep the existing `portal-shell portal-shell--dark` div wrapping `children` inside `<body>`, since `deck.css`/`style-guide.css` selectors may depend on that class existing somewhere in the tree — do not delete it, just nest it one level deeper under the new `<body>`. Add the GA/GTM/Clarity script blocks, copied from `next/app/layout.js` (the `<GoogleAnalytics gaId=... />` component, the GTM inline script, the Clarity inline script, and the GTM `<noscript>` iframe) into this file's `<head>`/`<body>`, matching their original placement (GTM/Clarity scripts in `<head>`, `GoogleAnalytics` component and GTM noscript iframe inside `<body>`). Update the exported `metadata` object to keep the existing `robots: { index: false, follow: false }` and add a minimal `title` (e.g. "FLOWERS — Client Deck", matching what `page.js`'s `generateMetadata` already sets, as a fallback for routes under `(portal)` that don't override it, such as the `unlock`/`pdf-file` route handlers which don't render a page). Do not add the theme-toggle script or the `dark`-class logic — the portal has no light mode.

**Step 3 — Verify no duplicate `<html>`/`<body>` rendering conflict.**
Next.js will use whichever root layout matches the requested route; `(portal)` becomes fully independent of `app/layout.js` for anything under `/portal`. Confirm (by starting the dev server and requesting a `/portal/[token]` URL) that there is exactly one `<html>` and one `<body>` in the rendered output, and that non-portal routes are unaffected (spot-check the homepage still renders with the marketing layout, theme toggle, and analytics intact).

**Step 4 — Add a `loading` fallback to the `DeckPdfViewer` dynamic import in `page.js`.**
In `next/app/(portal)/portal/[token]/page.js`, extend the `nextDynamic(() => import(...), { ssr: false })` call to also pass `loading: () => <div className="deck-pdf-viewer" />` (or an equivalent minimal element carrying the `deck-pdf-viewer` class, which already has `background-color: #000000` in `deck.css`). This ensures the moment between the dynamic import resolving on the client and `DeckPdfViewer` itself mounting its internal `Document`/`Page` loading state is covered by the same black background, rather than an unstyled empty node.

**Step 5 — Add the missing `body` background rule to `style-guide.css`.**
Add `background-color: var(--color-bg);` to the existing `body { ... }` rule block (around line 62-67). This is a defensive correctness fix for the marketing site only (so `body` never silently relies on `html`'s background showing through); it has no effect on the portal once Step 2 gives it its own independent `<body>` with a hardcoded black background.

**Step 6 — Manual verification pass.**
Run through Test Considerations (section 10) end to end, in both a fresh session (no `localStorage` theme set) and with the site's theme explicitly set to light, to confirm the portal is unaffected either way, since it no longer reads `--color-bg` or the `dark` class at all.

## 9. Edge Cases

- **Shared context dependency (Step 1 finding).** If any portal component does depend on `AppWrapper`/`ThemeProvider`, forgetting to re-wrap it in the new portal root layout will cause a hard runtime error (context used outside provider), not a silent visual bug — this must be resolved before shipping, not deferred.
- **Route handlers under `(portal)` with no page.** `next/app/(portal)/portal/[token]/unlock/route.js` and `.../pdf-file/route.js` are API route handlers, not pages — they don't render HTML and are unaffected by the root-layout split, but confirm they don't import anything from `next/app/layout.js` directly (unlikely, but worth a grep during Step 1).
- **`DeckEmbed`'s loader has no explicit background.** Since it currently relies entirely on the ancestor black background, if a future change ever renders `DeckEmbed` outside the portal shell (e.g. in a preview/storybook context), its loader would show through as transparent/white. Not in scope to fix now since the portal shell always wraps it today, but worth a one-line comment or follow-up ticket if it recurs.
- **`favicon`/`metadataBase` inheritance.** The marketing site's `metadataBase` (used for resolving relative OG image URLs) lives only in `app/layout.js`'s `metadata` export. Since the portal no longer inherits from it, any portal metadata that relies on relative URLs (none currently observed) would break; the plan's Step 2 metadata is intentionally minimal (title + robots) to avoid this.
- **GTM/Clarity double-firing.** Confirm the GTM/Clarity scripts are not somehow loaded twice for a portal page (e.g. if a client navigates from a marketing page into the portal via a full page load vs. a client-side transition) — since the two route groups now have fully separate root layouts, a navigation between them is always a full document load in Next.js App Router, so no double-injection risk exists, but this is worth confirming visually in the browser's Network tab during Step 6.

## 10. Test Considerations

Manual checks (no automated test suite currently covers layout/CSS concerns in this codebase, so this is verification-only, not new test code):

- Load a valid, unlocked `/portal/[token]` deck link directly (fresh browser profile / incognito, no `localStorage` set) and confirm no white/cream flash on first paint.
- Repeat with the site's `localStorage.theme` explicitly set to `"light"` beforehand (e.g. by visiting the marketing site and toggling theme) to confirm the portal is unaffected by that setting.
- Load a locked deck link, submit the correct password in `PasswordGate`, and watch the transition through `router.refresh()` into the deck view — confirm no flash at the moment the page re-renders.
- Load a deck with `contentType: "figma"` and confirm the `DeckEmbed` loader-to-iframe transition shows no flash.
- Load a deck with `contentType: "pdf"` and confirm the `next/dynamic` swap-in and the `Document`/`Page` loading states inside `DeckPdfViewer` show no flash, particularly on a throttled network (Chrome DevTools "Slow 3G") where the client-only mount gap is more visible.
- Confirm GA/GTM/Clarity network requests still fire when visiting a portal page (check the Network tab for requests to `googletagmanager.com`, `google-analytics.com`, `clarity.ms`).
- Spot-check a non-portal marketing page to confirm the shared root layout, theme toggle, and analytics still work unchanged.

## 11. Implementation Order

1. `next/app/(portal)/layout.js` — existing file being modified; must be done first since it's the structural change everything else depends on (root layout split, black `<body>`, re-added analytics scripts, portal metadata).
2. `next/app/(portal)/portal/[token]/page.js` — existing file being modified; add the `loading` fallback to the `DeckPdfViewer` dynamic import once the surrounding root layout is confirmed working, so the fallback's black background has a black `<body>` to sit on during testing.
3. `next/styles/style-guide.css` — existing file being modified; lowest-risk, independent change (marketing-site `body` background fallback), can be done last since it doesn't affect the portal's own fix.
4. Manual verification pass across all portal states and one marketing page, per section 10, before considering the change complete.
