# Top Nav Bar, Right-Aligned Links, "Contact" Copy Link

## 1. Goal

Reposition the desktop main navigation bar from the bottom of the viewport to the top, right-align all of its links into a single row, and replace the CMS-driven mailto link label with a hardcoded "Contact" link that copies the studio email address to the clipboard when clicked.

## 2. Current System Behaviour

`MainNav` (`next/components/MainNav.js`) is a `lg:`-only fixed bar pinned to `bottom-0` of the viewport (`#main-nav`, `fixed bottom-0 left-0 w-full`, z-index 3000). It uses a 12-column grid split into two groups:

- Columns 1–9: `MainNavLinks` (`next/components/MainNavLinks.js`) renders "Gallery" and "Shop" as a left-aligned two-item grid.
- Columns 10–12: an inline social `<nav>` inside `MainNav` itself, laid out with `flex justify-between`, rendering the CMS-driven `socialLinks` (e.g. Instagram, LinkedIn) as comma-separated `Link`s, plus one `CopyLink` for any link whose `href` contains `mailto`. `CopyLink` (`next/components/CopyLink.js`) already implements copy-to-clipboard: it strips `mailto:`, calls `navigator.clipboard.writeText(url)` on click, and shows "Copied!" as a 1-second flash, but otherwise displays `title` — which today is whatever label is set on that link in the CMS (`site.social_links`), not the fixed word "Contact". This same group also conditionally renders an `UpArrow` "scroll to top" button when the pathname includes `/projects` or `/gallery`.

`HomeLink` (`next/components/HomeLink.js`) is a separate `fixed top-0` bar (`#home-link`, z-index unset/default, but visually above `<main>`) containing the studio wordmark logo, centered. `next/styles/nav.css` reserves top padding on `<main>` via `#home-link + main { padding-top: 25.4vw; }` (20.3vw at `lg:`) so page content clears the fixed logo bar. `HomeLink` also hides itself (`translateY(-100%)`) when scrolling down past a threshold, coordinated through `AppWrapper` state (`state.hideHomeLink`).

Mobile (`MobileNav.js` + `MobileMenu.js`) is a fully separate pair of components — a bottom "Menu" button that opens a full-screen overlay — and is out of scope for this change.

## 3. Desired Behaviour

- `MainNav` sits in its own fixed strip pinned to the top of the viewport, above `HomeLink`'s logo bar (not merged into the same row as the logo).
- `HomeLink` shifts down to sit below the new `MainNav` strip, and `<main>`'s top padding increases by the height of the new nav strip so content still clears both bars.
- All of `MainNav`'s links — Gallery, Shop, each social link, and the mailto entry — render as a single horizontal list, right-aligned as one group (no more two-column split).
- The mailto entry always displays the label "Contact" regardless of what title is configured in the CMS for that link, and clicking it copies the email address to the clipboard using the existing `CopyLink` copy behavior (including the "Copied!" flash).
- The scroll-to-top up arrow remains the last item in this right-aligned row and keeps its existing conditional visibility (`/projects` or `/gallery` pages) and scroll-triggered opacity behavior.
- Mobile behavior (`MobileNav`, `MobileMenu`) is unchanged, including its CMS-driven mailto title.

## 4. Architecture Considerations

- **Collapsing two groups into one list**: `MainNavLinks` currently renders its own `<nav>` with a `<ul>`. Rather than deleting `MainNavLinks` and inlining everything into `MainNav`, keep `MainNavLinks` as the component responsible for the static site links (Gallery, Shop) but change its rendering so it emits `<li>` items compatible with a single shared `<ul>` in `MainNav`, and have `MainNav` render `MainNavLinks` and the social/contact items inside one shared `<ul className="... justify-end">` (or equivalent) rather than two separate `<nav>` grid columns. This keeps `MainNavLinks`' existing responsibility (active-link detection, analytics tracking for Gallery/Shop) intact while changing only the layout container.
- **Hardcoding "Contact"**: `CopyLink` takes `title` as a prop and just displays it as-is; it has no knowledge of what the label "should" be. The cleanest place to hardcode "Contact" is at the call site in `MainNav`, i.e. pass `title="Contact"` explicitly instead of `title={link.title}` when rendering the mailto `CopyLink`. This avoids modifying `CopyLink` itself (which is also used, unchanged, by `MobileMenu` with the CMS-driven title) and avoids a CMS change.
- **Positioning bottom vs top**: Switching `#main-nav` from `bottom-0` to `top-0` is a straightforward Tailwind class swap plus a z-index consideration — `#main-nav` must sit above `#home-link` (currently `#main-nav` is z-index 3000, `#home-link` has no explicit z-index, i.e. `auto`), so `MainNav` will naturally stack above `HomeLink` as long as both are `position: fixed`. The two bars need distinct vertical offsets so they don't overlap: `MainNav` at `top: 0`, and `HomeLink` pushed down by `MainNav`'s rendered height. Since `MainNav`'s height is not currently fixed to a static pixel value (it uses `py-10` padding around one line of text), the simplest reliable approach is to give `MainNav` a fixed/min height (or consistent vertical padding) and offset `HomeLink`'s `top` by that same amount using a CSS custom property or a fixed Tailwind offset class, keeping both values co-located in `nav.css` so they stay in sync.
- **`<main>` top padding**: `#home-link + main` uses an adjacent-sibling selector keyed to DOM order. Since `MainNav` renders before `MobileNav`/`HomeLink` in `layout.js` (`MainNav`, `MobileNav`, `HomeLink`, `<main>`), the adjacent-sibling selector `#home-link + main` still directly follows `HomeLink` in the DOM and remains valid — only the `padding-top` values themselves need to increase to account for the added `MainNav` strip height above `HomeLink`.
- **No new dependencies**: This is pure layout/markup restructuring using existing Tailwind utility classes and the existing `CopyLink` component; no new libraries or state are introduced.
- **Scope containment**: All changes are constrained to `lg:`-only desktop styles/markup. Mobile components and mobile-width CSS are not touched, so no risk of regressing the mobile experience.

## 5. Data Flow

`socialLinks` is fetched server-side in `layout.js` via `getGlobalData()` (`next/queries/layoutQuery.js`, `site.social_links.toStructure`) and passed as a prop into both `MainNav` and `MobileMenu`. This data flow is unchanged. Inside `MainNav`, the array is still iterated the same way; the only change is that when a given link's `href` contains `mailto`, the JSX passes a literal string `"Contact"` as `title` to `CopyLink` instead of forwarding `link.title` from the CMS payload. `CopyLink` still derives the copy target purely from the `url` prop (`link.link`, with `mailto:` stripped), so the copied email address is unaffected by the label change — only what the user sees as clickable text changes.

## 6. Component Responsibilities

### `MainNav` (`next/components/MainNav.js`)
- Responsible for: the fixed top desktop nav bar container, its show/hide behavior (`state.hideNav`), rendering the single right-aligned link row (delegating Gallery/Shop to `MainNavLinks`, mapping `socialLinks` to `Link`/`CopyLink` items directly), and the conditional scroll-to-top button.
- Not responsible for: fetching `socialLinks` (comes from `layout.js`), the CMS title value for the mailto link, or `HomeLink`'s positioning (only its own).
- Props: `socialLinks` (array, required, from CMS `site.social_links.toStructure`, each item `{ title: string, link: string }`).
- Internal state: `showUp` (boolean, controls up-arrow opacity based on scroll position) — unchanged.

### `MainNavLinks` (`next/components/MainNavLinks.js`)
- Responsible for: rendering the Gallery and Shop `<li>` entries with active-link styling and click analytics, as items that fit inside `MainNav`'s single shared list.
- Not responsible for: overall nav positioning, the social/contact links, or list container markup beyond its own `<li>` items.
- Props: none (reads `pathname` via `usePathname`, dispatch/state via `useAppState` if still needed for active-link logic).
- Internal state: none.

### `CopyLink` (`next/components/CopyLink.js`)
- Responsible for: rendering a button showing `title` (or "Copied!" for 1s after click), copying the `mailto:`-stripped `url` to the clipboard on click.
- Not responsible for: deciding what `title` should be — that's the caller's responsibility (this is what lets `MainNav` hardcode "Contact" while `MobileMenu` keeps using the CMS title).
- Props: `title` (string, required, label text), `url` (string, required, mailto href), `className` (string, optional, extra styling).
- Internal state: `copied` (boolean, controls the 1-second "Copied!" flash).

### `HomeLink` (`next/components/HomeLink.js`)
- Responsible for: rendering the fixed logo bar, its scroll-based resize/hide animation.
- Not responsible for: the nav links or contact link; only its own vertical offset changes (to sit below the new `MainNav` strip).
- Props: none.
- Internal state: unchanged (`maxTitleSize`, `titleSize`, `prevScroll`, `showCaptions`).

## 7. Files Affected

- `next/components/MainNav.js` — switch positioning from bottom to top, collapse two-group grid into one right-aligned list, hardcode "Contact" label for the mailto `CopyLink`.
- `next/components/MainNavLinks.js` — adjust markup so its `<li>` items compose correctly inside `MainNav`'s single shared `<ul>` instead of owning their own `<nav>`/`<ul>` wrapper and grid columns.
- `next/styles/nav.css` — update `#main-nav` positioning rule (`bottom-0` → `top-0`), add/adjust the vertical offset for `#home-link` so it sits below the new top nav strip, and update the `#home-link + main` padding-top values (both base and `lg:`) to account for the added strip height.

No changes needed to `next/components/CopyLink.js`, `next/components/MobileNav.js`, `next/components/MobileMenu.js`, `next/app/layout.js` (render order already puts `MainNav` before `HomeLink`), or `next/queries/layoutQuery.js`.

## 8. Step-by-Step Implementation

**Step 1 — Restructure `MainNavLinks.js` to emit list items only.**
Change the component so it no longer renders its own `<nav>` wrapper, `<ul>`, or `grid-cols-9` layout. Instead, have it return a `Fragment` (or bare list) containing just the Gallery and Shop `<li>` elements, unchanged in their internal content (active-link class logic, analytics `onClick` handlers, `<span>` text). This is needed because the two link groups are merging into one shared list owned by `MainNav`. Watch out for: the `active` class logic (`checkLinkActive`) and analytics calls must be preserved exactly, since removing the wrapper is purely a structural change, not a behavioral one. This step must land before Step 2, since `MainNav` will import and render this in its new single-list layout.

**Step 2 — Rework `MainNav.js`'s render output into one right-aligned list.**
Replace the two-column grid (`MainNavLinks` in cols 1–9, social `<nav>` in cols 10–12) with a single `<nav>` containing one `<ul>` using flexbox utilities for a right-aligned row (e.g. `flex justify-end items-center gap-x-6` in place of `grid grid-cols-12`). Render `<MainNavLinks />` first (still supplying Gallery/Shop `<li>`s), followed by the mapped `socialLinks` items as `<li>`s: for the mailto entry render `<CopyLink title="Contact" url={link.link} />` (replacing `title={link.title}`), for other links keep the existing `<Link>` with `target="_blank"` and the `trackSocial` analytics call, and keep the comma separators between items or replace them with the row's `gap` spacing (recommend removing the manual `,&nbsp;` separators now that spacing is handled by flex `gap`, since a right-aligned row with trailing commas reads oddly — flag this as a decision point). Keep the up-arrow `<button>` as the trailing item in the same list, preserving its existing conditional rendering and `showUp`-driven opacity classes. This step depends on Step 1 being complete so `MainNavLinks` composes correctly; it's the core layout change the rest of the plan supports.

**Step 3 — Move `#main-nav` from bottom to top in `MainNav.js`'s class list.**
In the `classNames(...)` call building `classes`, change `fixed bottom-0 left-0 w-full ...` to `fixed top-0 left-0 w-full ...`. Watch out for: the `hide` class currently translates the bar `translateY(100%)` (downward, off the bottom) when `state.hideNav` is true — with the bar now at the top, translating it downward would push it onto the page instead of off-screen, so the corresponding CSS rule in `nav.css` (`#main-nav.hide`) must also change direction (see Step 5). This step is purely the JS class change; the visual hide/show correctness depends on Step 5.

**Step 4 — Reserve vertical space for the new top nav strip.**
Decide and record a fixed height for `MainNav` (e.g. keep its current `py-10`/`py-5` padding but confirm the resulting rendered height, since `HomeLink`'s offset in Step 5 must match it exactly to avoid a gap or overlap). This isn't a code change on its own but must be measured (e.g. via browser devtools) before writing the offset in Step 5, since the two values need to agree.

**Step 5 — Update `nav.css` positioning and spacing rules.**
- Change `#main-nav.hide { transform: translateY(100%); }` to `translateY(-100%)` so the bar now slides up and off-screen at the top when hidden, mirroring how `#home-link.hide` already does `translateY(-100%)`.
- Add a `top` offset to `#home-link` (currently `top: 0` implicitly via the `top-0` Tailwind class in `HomeLink.js`) so it sits below the new `MainNav` strip — either by changing `HomeLink.js`'s Tailwind class from `top-0` to a fixed offset utility, or by adding a CSS rule in `nav.css` overriding `#home-link`'s `top` value to match `MainNav`'s measured height from Step 4. Keep this value and `MainNav`'s height in sync — if one changes later, the other must too.
- Update `#home-link + main { padding-top: 25.4vw; }` and its `lg:` counterpart (`padding-top: 20.3vw;`) to add the same additional offset used for `#home-link`'s new `top` value, so page content doesn't get cut off under both fixed bars.
This step depends on Step 4's measured height and finalizes the visual positioning started in Step 3.

**Step 6 — Manual verification pass.**
Confirm in a browser (desktop width, `lg:` breakpoint) that: `MainNav` renders at the top, right-aligned, as one row; `HomeLink`'s logo sits cleanly below it with no gap or overlap; scrolling down hides both bars in the correct direction; the "Contact" button copies the email address and shows "Copied!"; the up-arrow still appears only on `/projects`/`/gallery` and scrolls to top on click; mobile (`< lg`) is visually unaffected.

## 9. Edge Cases

- **`MainNav` height changes with future content**: if a social link is added/removed later, list wrapping is unlikely given `justify-end` on a single row, but if the row ever wraps to two lines, the fixed height reserved in `HomeLink`'s offset (Step 4/5) would become stale and cause visual overlap — worth a code comment at the offset value noting it must match `MainNav`'s rendered height.
- **`state.hideNav` and `state.hideHomeLink` desync**: both are already dispatched together from `HomeLink`'s scroll handler (`SET_HIDE_HOME_LINK` and `SET_HIDE_NAV` are set in the same effect), so hide/show stays synchronized; no new desync risk is introduced by this change, but the direction flip in Step 5 must be verified against this existing coupling.
- **Clipboard API failure**: `CopyLink`'s `navigator.clipboard.writeText` has no `.catch`/error handling today (pre-existing, out of scope) — if the browser blocks clipboard access (e.g. non-HTTPS context or permissions), the button will silently no-op and still show "Copied!" optimistically. This plan does not change that behavior since `CopyLink` itself isn't modified, but note it's an existing latent issue, not introduced here.
- **Long email address on narrow desktop widths near the `lg:` breakpoint**: with all links now in one right-aligned row instead of two groups, very narrow `lg:` widths could cause tighter wrapping/crowding; verify visually per Step 6 at widths near the `lg` breakpoint minimum.

## 10. Test Considerations

Manual verification only (no existing automated test suite covers nav components based on file inspection):
- Visual check at `lg:` breakpoint and above: nav bar at top, single right-aligned row, correct spacing between Gallery/Shop/social items/Contact.
- Click "Contact": confirm clipboard contains the studio email address (paste somewhere to verify) and the button text flashes "Copied!" for ~1 second.
- Scroll down past the hide threshold on a page where `hideNav`/`hideHomeLink` trigger: confirm both `MainNav` and `HomeLink` slide off the top of the screen (not downward).
- Visit `/gallery` and `/projects`: confirm the up-arrow still appears and scrolls smoothly to top on click.
- Resize to below `lg` breakpoint: confirm `MobileNav`/`MobileMenu` render exactly as before, with no visual regression from the `nav.css` changes (the edited rules are `#main-nav`, `#home-link`, and their `lg:` media query counterpart, so double-check no unscoped rule leaked into mobile styles).

## 11. Implementation Order

1. `next/components/MainNavLinks.js` — existing file, modified first: strip its own `<nav>`/`<ul>` wrapper down to bare `<li>` items so it can compose inside `MainNav`'s new shared list.
2. `next/components/MainNav.js` — existing file, modified second: consumes the restructured `MainNavLinks`, builds the single right-aligned `<ul>`, hardcodes the "Contact" label, and flips its position class from bottom to top.
3. `next/styles/nav.css` — existing file, modified last: updates `#main-nov.hide` direction, `#home-link`'s top offset, and `#home-link + main` padding-top values, all of which depend on the final rendered height of the restructured `MainNav` from steps 1–2.
