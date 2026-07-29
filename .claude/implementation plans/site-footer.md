# Site Footer

## 1. Goal

The site currently has no footer. Every page ends abruptly after the last piece of `main` content. This plan adds a global footer matching a supplied design reference: a top row of social/contact links, a large centered `FLOWERS` wordmark rendered from `FLOWERS-Full.svg`, and a bottom row with copyright and location.

## 2. Current System Behaviour

`next/app/layout.js` renders, in order: `MainNav` (desktop header), `MobileNav`, `HomeLink` (animated wordmark near the top of the page), `main` (page content), `MobileMenu` (full-screen mobile nav overlay), and conditionally `Screensaver`. Nothing renders after `{children}` inside `main` — the page simply ends. There is no footer component, no footer styles, and no footer-related CSS file.

Social links and a mailto contact link already exist in the header (`MainNav.js`) and mobile menu (`MobileMenu.js`), sourced from `getGlobalData()` (`next/queries/layoutQuery.js`), which fetches `site.social_links` from the Kirby CMS. These are unrelated to this feature — per direction, the footer's links are hardcoded, not CMS-driven, so this data flow is not reused.

The `FLOWERS-Full.svg` wordmark already exists in `next/public/FLOWERS-Full.svg` (viewBox `0 0 1310.65 215.45`) and is already rendered elsewhere via `next/image` in `HomeLink.js`, which also defines a reusable aspect-ratio constant (`1312 / 217`) to compute `height` from a target `width`.

The click-to-copy contact pattern already exists as `CopyLink.js`: a button that copies a `mailto:`-stripped URL to the clipboard and shows "Copied!" for one second.

## 3. Desired Behaviour

Every page shows a footer below its main content, with:

- Top-left: three inline links — `IG`, `YOUTUBE`, `SUBSTACK` — each opening its target in a new tab.
- Top-right: `CONTACT`, which copies `studio@flowersfullservice.art` to the clipboard on click (via `CopyLink`) and shows "Copied!" feedback, matching header behavior.
- A horizontal rule above this top row, matching the reference image.
- Center: the `FLOWERS-Full.svg` wordmark, rendered large and roughly full-width, matching the reference image proportions.
- Bottom-left: `©{current year}`, computed dynamically.
- Bottom-right: `NYC`.

Layout is static (scrolls normally with page content, not fixed/sticky), and uses the same responsive structure at all breakpoints (mobile and `lg:`), scaling type size and spacing rather than rearranging elements.

## 4. Architecture Considerations

**New component vs. inline in layout.js**: A dedicated `Footer` component (`next/components/Footer.js`) is created rather than inlining markup into `layout.js`, matching the existing pattern where every structural nav element (`MainNav`, `MobileNav`, `HomeLink`, `MobileMenu`) is its own component. This keeps `layout.js` as a thin composition point.

**Hardcoded links, no CMS/props**: Per explicit direction, the footer takes no `socialLinks` prop and makes no query. The four link URLs and the contact email are hardcoded as constants inside `Footer.js`. This diverges from the header's CMS-driven approach, but is intentional — the footer's link set (IG/YouTube/Substack) is a different set from the CMS `social_links` structure (which currently drives only the header/mobile menu), and introducing a second CMS field is explicitly out of scope for this change.

**Reusing `CopyLink`**: The `CONTACT` action reuses the existing `CopyLink` component unmodified, for behavioral and visual consistency with the header's contact link, and to avoid duplicating clipboard logic.

**Reusing the wordmark rendering pattern**: The footer reuses the same `next/image` + fixed aspect-ratio approach as `HomeLink.js` (constant `1312/217`), rather than inlining the raw SVG markup, since `next/image` already optimizes and serves `FLOWERS-Full.svg` correctly elsewhere and the file does not need per-instance style manipulation (no hover/animation on the footer wordmark, per the static-block decision).

**New CSS file (`footer.css`) vs. extending `nav.css`**: A new stylesheet is added rather than appending to `nav.css`, because the footer is a structurally distinct region (not part of the nav system) and `global.css` already establishes a per-feature `@import` convention (`nav.css`, `gallery.css`, `about.css`, `project.css`). Tailwind utility classes handle most layout directly in JSX; the CSS file is reserved only for the horizontal rule and any styling Tailwind utilities can't express cleanly (e.g. the exact wordmark sizing behavior if it needs a non-utility rule).

**No new dependencies**: `next/image`, `next/link`, and the existing `CopyLink` component cover all requirements. No new libraries are introduced.

**Placement in `layout.js`**: `Footer` is rendered as a sibling to `main`, after it and after `MobileMenu`/`Screensaver` in the JSX (order in the file does not affect visual stacking here since only `main` and `Footer` are in normal document flow; `MobileMenu` and `Screensaver` are almost certainly fixed/overlay-positioned). Placing `Footer` immediately after `<main>` keeps it in reading order directly beneath page content.

## 5. Data Flow

There is no external data flow for this feature. All content — the three social links, the contact email, and the `NYC` label — is a hardcoded constant inside `Footer.js`. The only runtime-computed value is the copyright year, derived once per render via `new Date().getFullYear()`. No props are passed into `Footer` from `layout.js`; it is a fully self-contained, data-free component (aside from importing the static SVG asset by path).

## 6. Component Responsibilities

### `Footer` (`next/components/Footer.js`)

**Responsible for:**
- Rendering the top link row (IG/YouTube/Substack + Contact).
- Rendering the horizontal rule above the top row.
- Rendering the centered wordmark image.
- Rendering the bottom row (copyright year + NYC).
- Computing the current year for the copyright line.

**Not responsible for:**
- Fetching or receiving any CMS data (explicitly out of scope).
- Clipboard-copy logic itself (delegated to `CopyLink`).
- Any scroll-based show/hide behavior (explicitly static, unlike `MainNav`/`HomeLink`).
- Mobile menu or nav state (`useAppState` context is not touched).

**Props:** none. This is a zero-prop, server-renderable component (no `"use client"` directive needed, since it has no hooks, state, or browser APIs of its own — `CopyLink` is already marked `"use client"` internally and can be used as a child of a server component).

**Internal state:** none.

### `CopyLink` (existing, unmodified)

Used as-is for the `CONTACT` link, passing `title="Contact"` and `url="mailto:studio@flowersfullservice.art"`.

## 7. Files Affected

- `next/components/Footer.js` — new file; the footer component described above.
- `next/styles/footer.css` — new file; footer-specific styles (rule styling, any layout rules not cleanly expressed via Tailwind utilities).
- `next/styles/global.css` — add `@import './footer.css';` so the new stylesheet is loaded, following the existing import list pattern.
- `next/app/layout.js` — import and render `<Footer />` after `<main>`.

## 8. Step-by-Step Implementation

**Step 1 — Create `next/styles/footer.css`**
Add a new, currently near-empty stylesheet scoped under a `#site-footer` (or similar) id selector, mirroring the `#main-nav` / `#home-link` id-scoping convention already used in `nav.css`. Start with just the horizontal rule style and any wordmark-container rule that Tailwind utility classes can't express (for instance, if the wordmark needs a min/max width clamp beyond what Tailwind's arbitrary values comfortably do). Everything else (flex layout, justify-between, padding, text sizing) should be done with Tailwind utility classes directly in `Footer.js`, consistent with how `MainNav.js` and `HomeLink.js` mix minimal CSS files with heavy utility-class usage.
Gotcha: keep selectors scoped to the footer's root id so nothing leaks into other pages; do not add unscoped element selectors (e.g. bare `a`, `p`) that could affect unrelated components.

**Step 2 — Register the import in `next/styles/global.css`**
Add `@import './footer.css';` to the existing import list. Order doesn't matter relative to the others since selectors are id-scoped and won't collide, but appending it at the end keeps the list in the same order features were added, consistent with existing style.

**Step 3 — Create `next/components/Footer.js`**
Build the component with this internal structure:
- A top-level `<footer id="site-footer">` wrapping element with responsive horizontal padding matching the rest of the site's content padding (`px-5 lg:px-14`, matching `main`'s className in `layout.js`, so the footer's link rows align with page content edges).
- A `<hr>` or a `border-t` div above the top row, matching the reference image's full-width rule.
- A top row: a flex container with `justify-between items-start`, containing:
  - A left group: a small vertical stack (`flex flex-col` on mobile, matches reference which shows IG/YOUTUBE/SUBSTACK stacked even at the shown width) of three `next/link` elements, each `target="_blank"`, each pointing to one hardcoded URL:
    - IG → `https://www.instagram.com/flowersfullservice/`
    - YOUTUBE → `https://youtu.be/nxyKLUwG1g4?si=UBM-Xtziblg3kcRX`
    - SUBSTACK → `https://fl0wers.substack.com` (verify protocol/subdomain formatting when implementing — the value was given without a scheme; normalize to `https://fl0wers.substack.com`).
  - A right group: the `CopyLink` component with `title="Contact"` and `url="mailto:studio@flowersfullservice.art"`.
- A center block: a `next/link` wrapping a `next/image` pointing at `/FLOWERS-Full.svg`, `alt="FLOWERS"`, using the same `WORDMARK_ASPECT_RATIO = 1312 / 217` constant pattern as `HomeLink.js` (duplicate the constant locally in `Footer.js` rather than importing it from `HomeLink.js`, since `HomeLink.js` does not currently export it and coupling an unrelated nav component to the footer for one constant is not justified — see Edge Cases for a note on keeping these two constants in sync if the SVG ever changes). Width should be responsive (e.g. full container width up to a max, via Tailwind's `w-full` and a `max-w-[...]` utility), with `height` compute via `Math.round(width / WORDMARK_ASPECT_RATIO)` at whatever fixed reference width is passed to `next/image`'s required `width`/`height` props (Next.js requires static numeric width/height unless using `fill`; follow the same fixed-intrinsic-size-with-responsive-CSS-scaling approach `HomeLink.js` already uses, or use the `fill` prop with a fixed-aspect-ratio wrapper div if a more fluid dimension is preferred — decide based on how `next/image` is configured in `next.config.js`, checked in Step 3 execution).
- A bottom row: a flex container with `justify-between items-center`, containing:
  - Left: `©{new Date().getFullYear()}`.
  - Right: `NYC`.
- Should the wordmark link somewhere (e.g. back to `/`)? The reference image doesn't indicate a link target for it; default to rendering it as a plain (non-link) image unless later feedback says otherwise, since `HomeLink`'s wordmark being a link is tied to its nav role, not an inherent property of the asset.

Gotchas:
- `next/image` needs a valid `width`/`height` (or `fill`) — check `next.config.js` for any `images` configuration (domains, `unoptimized`, etc.) before assuming defaults.
- Font classes: confirm whether `IG`/`YOUTUBE`/`SUBSTACK`/`CONTACT`/`©`/`NYC` should use `font-primary` (used for the big body/heading text in `page.js`) or `font-secondary` (used for nav links in `MainNav.js`/`MobileNav`-adjacent components) — the reference image's link/label text visually matches a bold sans, consistent with `font-secondary font-bold` used in `MainNav.js`'s link list. Use that same class combination for consistency unless the reference's exact typeface differs after visual comparison in the browser.
- Hover states: `MainNav` links use `lg:hover:opacity-50 transition-opacity duration-300` on hover; apply the same to the footer's IG/YouTube/Substack links for consistency (`CopyLink` already has its own hover treatment).

**Step 4 — Wire `Footer` into `next/app/layout.js`**
Import `Footer` from `../components/Footer` and render `<Footer />` immediately after the closing `</main>` tag, before `<MobileMenu ... />`. This keeps it in normal document flow directly following page content. No props are passed.
Gotcha: confirm `MobileMenu` and `Screensaver` are fixed/overlay-positioned (their CSS classes in `nav.css` suggest so — `#mobile-menu` uses `transform`/`translateY` for a slide-in overlay). If either turns out to be part of normal flow, placement relative to `Footer` may need adjusting so the footer isn't visually pushed around by them.

## 9. Edge Cases

- **Aspect ratio constant drift**: `WORDMARK_ASPECT_RATIO` is duplicated between `HomeLink.js` and `Footer.js`. If `FLOWERS-Full.svg` is ever replaced with a differently-proportioned asset, both constants must be updated together, or the footer wordmark will render stretched. Not extracted into a shared constant in this plan since only one other file uses it and the two components are not otherwise coupled — but flag this as a candidate for extraction if a third consumer appears.
- **Long/short viewport widths**: at very narrow mobile widths, the top row's three-link left group plus the right-aligned `CONTACT` need to not overlap or wrap awkwardly. Verify in-browser at common breakpoints (375px, 768px, 1024px+) that the flex layout holds up; the reference image only shows one (wide) viewport.
- **SUBSTACK URL scheme**: the value supplied (`fl0wers.substack.com`) has no protocol. Using it verbatim as an `href` would produce a relative link. Must be normalized to `https://fl0wers.substack.com` before use.
- **YouTube link is a single video, not a channel**: `https://youtu.be/nxyKLUwG1g4?si=...` opens one specific video rather than the channel. This was explicitly supplied by the user, so it is used as-is, but it means clicking "YOUTUBE" in the footer will not lead visitors to browse other videos — only this one. Worth reconfirming with the user before shipping if a channel link was actually intended.
- **Clipboard API availability**: `CopyLink` calls `navigator.clipboard.writeText` directly with no fallback or permission check. This is pre-existing behavior (already used in the header), so no new handling is added here, but it means the footer's contact copy will silently fail in contexts without Clipboard API access (e.g. non-HTTPS, very old browsers) — consistent with existing header behavior, not a regression.

## 10. Test Considerations

**Manual verification:**
- Load the homepage and at least one other route (e.g. `/gallery` or a project page) and confirm the footer renders identically at the bottom of both, proving it's global via `layout.js`.
- Click each of IG, YouTube, and Substack links and confirm they open the correct destination in a new tab.
- Click CONTACT and confirm `studio@flowersfullservice.art` lands on the clipboard and "Copied!" feedback shows, matching header behavior.
- Resize the viewport across mobile, tablet, and desktop widths and confirm the three-row structure holds without overlap or unwanted wrapping.
- Confirm the copyright year matches the current system year and that the wordmark renders at the correct aspect ratio (not stretched or squashed) at each breakpoint.
- Confirm the footer does not visually collide with `MobileMenu`'s slide-in overlay or the `Screensaver` component when either is active.

**Automated tests:** none exist in this codebase for UI components currently (no test files found under `next/`); no new automated tests are introduced by this plan, consistent with existing project conventions.

## 11. Implementation Order

1. `next/styles/footer.css` — new file. Written first so the class/id hooks it defines exist before `Footer.js` references them.
2. `next/styles/global.css` — existing file, modified. Adds the import immediately after creating the stylesheet, so it's active before the component is built and tested.
3. `next/components/Footer.js` — new file. Built third once its styling hooks are in place; contains all markup, hardcoded content, and the wordmark image.
4. `next/app/layout.js` — existing file, modified last. Wires the finished `Footer` component into the global layout, making it visible site-wide for manual testing.
