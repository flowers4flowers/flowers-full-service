# Dark Mode Toggle — Implementation Plan

## 1. Goal

Add a dark mode toggle, reachable from both the desktop nav (`MainNav`) and the mobile menu (`MobileMenu`), that switches the entire site between the current light theme (cream background `#EEEBE6`, black text) and a new dark theme (black background `#000000`, cream text `#EEEBE6`). All SVG icons and logos must switch fill color to match — black in light mode, cream in dark mode.

## 2. Current System Behaviour

The site is a Next.js 14 App Router project (`next/`) styled with Tailwind CSS plus several imported plain CSS files (`next/styles/*.css`). There is no dark mode support anywhere.

- `next/tailwind.config.js` defines a closed custom color palette: `black`, `white`, `transparent`, `cream` (`#EEEBE6`), `light-cream` (`#D9D9D9`). Tailwind's `darkMode` strategy is not configured (defaults to `media`, which is unused since no `dark:` classes exist in the codebase).
- Global page chrome (`html`, `body`) gets its background/text color from `next/styles/style-guide.css`, which hardcodes `background-color: theme('colors.cream')` and `color: black` on the `html` selector — this is plain CSS, not a Tailwind utility class, so it cannot be overridden with a `dark:` variant without extra work.
- `next/styles/nav.css` also hardcodes `background-color: black` in a few places (active-link dot, carousel counter dots).
- Layout composition happens in `next/app/layout.js`, an async server component that fetches global data (`getGlobalData`) and renders `<html><head>…</head><AppWrapper><body>{MainNav, MobileNav, HomeLink, main, Footer, MobileMenu, Screensaver}</body></AppWrapper></html>`.
- Global client state lives in `next/context/index.js` (`AppStateContext` / `AppWrapper` / `useAppState`), a `useReducer`-based context currently tracking `hideNav`, `currentProjectCaptions`, and `mobileMenuOpen`. It is a client component (`"use client"`) mounted inside `layout.js`.
- Desktop nav: `next/components/MainNav.js` (bar, `bg-cream`, `hidden lg:flex`) renders `next/components/MainNavLinks.js` (Gallery / Shop / About links plus social links, all `text-black`).
- Mobile top bar: `next/components/MobileNav.js` (`bg-cream`, `flex lg:hidden`) has a "Menu" button that dispatches `SET_MOBILE_MENU_OPEN`.
- Mobile slide-out panel: `next/components/MobileMenu.js` (`bg-white`, black circular bullets, black "×" close button), toggled by `state.mobileMenuOpen` from the shared context, auto-closes on route change.
- Icons are defined two ways:
  - Inline JSX components in `next/components/Icons.js`: `WordMark` (no explicit fill → inherits default black via SVG spec), `SecondaryMark` (hardcoded `fill="#FFFFFF"` on every path), `PlayButton` (hardcoded `fill="white"`/`stroke="white"`), `UpArrow` (hardcoded `fill="black"`/`stroke="black"`).
  - Static files in `next/public/`: `left-arrow.svg`, `right-arrow.svg`, `x.svg`, `FLOWERS-Full.svg`, referenced via `<img>`/`next/image` in `next/components/HomeLink.js` and `next/components/Footer.js` — these cannot be recolored via CSS since they are opaque raster-like references to external files.
- No `localStorage` usage, no `ThemeContext`, no `next-themes` dependency anywhere in the project.

## 3. Desired Behaviour

- A pill/switch-style toggle control appears in the desktop nav (`MainNav`/`MainNavLinks`) and inside the mobile slide-out menu (`MobileMenu`).
- Toggling switches the whole site (all routes: home, `/about`, `/gallery`, `/info`, `/projects/[slug]`, `/shop`) between light and dark instantly, with no full page reload.
- Dark mode: background black, all body text cream, all SVGs (inline icon components and the four converted static files) render in cream; light mode is the current appearance (cream background, black text/icons) unchanged.
- On first visit (no stored preference), the site defaults to the visitor's OS-level `prefers-color-scheme`. Once the visitor uses the toggle, their explicit choice is persisted (`localStorage`) and takes priority over OS preference on every subsequent visit.
- No flash of the wrong theme on page load/navigation.

## 4. Architecture Considerations

**Tailwind dark mode strategy.** Enable `darkMode: 'class'` in `tailwind.config.js` so dark styling is opt-in via a `dark` class on `<html>`, controlled by JS, rather than being purely driven by the OS media query. This is required because the toggle must let a user override their OS preference, which Tailwind's default `media` strategy cannot do.

**Two color-defining layers must be updated in tandem.** Tailwind utility classes (`bg-cream`, `text-black`, etc.) only cover the componentized parts of the UI. Base page chrome color (`html`/`body` background and text) is set in plain CSS (`style-guide.css`) using `theme('colors.cream')` and hardcoded `black`, not a Tailwind class on an element, so it will not respond to `dark:` variants automatically. The fix is to introduce CSS custom properties (`--color-bg`, `--color-text`) defined on `:root` and overridden under `html.dark`, and to switch `style-guide.css`'s `html`/`body` rules (and the hardcoded `background-color: black` dot indicators in `nav.css`) to reference those variables instead of literals. Tailwind's `colors.cream`/`colors.black` stay as-is for componentized utility classes; the CSS variables are the single source of truth for the two chrome-level colors so both layers stay in sync without duplicating hex values in two places.

**State management: separate `ThemeContext`.** Theme is a cross-cutting UI concern unrelated to the existing `AppStateContext` (which owns nav-hide/menu-open/caption state). A dedicated `next/context/ThemeContext.js` keeps the reducer in `context/index.js` focused and avoids coupling theme logic to unrelated nav-visibility logic. Both contexts mount independently in `layout.js`.

**Avoiding flash of incorrect theme.** Because `layout.js` is an async server component with no access to `localStorage` or `matchMedia`, the initial server-rendered HTML cannot know the user's preference. The standard fix is a small inline `<script>` placed in `<head>` (before hydration) that reads `localStorage`, falls back to `matchMedia('(prefers-color-scheme: dark)')`, and synchronously sets `document.documentElement.classList.add('dark')` before first paint. `ThemeContext` then reads the same resolved value on mount to stay in sync with React state, and is the only thing that subsequently toggles the class.

**SVG recoloring: explicit color prop, not `currentColor`.** Per confirmed direction, icon components take an explicit `color` prop (e.g. `"black"` or `"cream"`) rather than relying on `fill="currentColor"` + CSS text-color inheritance. This keeps icon coloring decoupled from surrounding text-color utility classes and works identically whether the consuming element has Tailwind text-color classes or not — useful since some icons (e.g. `UpArrow` inside `.up` buttons) sit in DOM positions where text-color inheritance would be indirect. Each consumer reads `theme` from `ThemeContext` and passes `color={theme === 'dark' ? 'cream' : 'black'}` (or the reverse for the always-white `SecondaryMark`/`PlayButton`, which need explicit design confirmation — see Edge Cases).

**Static SVG files become inline components.** The four `public/*.svg` files (`left-arrow`, `right-arrow`, `x`, `FLOWERS-Full`) are converted into new inline JSX components in `Icons.js` (same `color`-prop pattern) so `HomeLink.js` and `Footer.js` render them as components instead of `<Image>`/`<img>` tags. The original files in `next/public/` remain unused afterward and can be left in place (no other consumers reference them per the codebase scan) — removal is out of scope for this change unless requested.

**No new dependency.** Given no `next-themes` package is installed and the toggle behavior is simple (class + localStorage + media query fallback), a hand-rolled context avoids adding a dependency for a small amount of logic.

## 5. Data Flow

1. On initial server render, `layout.js` renders `<html>` with no theme class (server has no way to know the client's preference).
2. Before hydration, an inline script in `<head>` runs synchronously: it checks `localStorage.getItem('theme')`; if present, uses that value; otherwise checks `window.matchMedia('(prefers-color-scheme: dark)').matches` and derives `'dark'` or `'light'`. It applies the resulting class (`dark` or nothing) to `document.documentElement` immediately, preventing a flash.
3. `ThemeProvider` (client component, mounted in `layout.js`) initializes its React state on mount by reading the same resolved source (`localStorage`, falling back to the media query) so React state and the DOM class agree.
4. Any component that needs to know or change the theme calls `useTheme()` (exposed from `ThemeContext.js`), which returns `{ theme, toggleTheme }`.
5. When a user clicks the toggle (rendered in `MainNavLinks.js` for desktop, `MobileMenu.js` for mobile), `toggleTheme()` flips `theme` in React state, writes the new value to `localStorage.setItem('theme', …)`, and adds/removes the `dark` class on `document.documentElement`.
6. Because the `dark` class lives on `<html>`, every descendant Tailwind `dark:` utility (e.g. `dark:bg-black dark:text-cream`) and every CSS rule scoped under `html.dark` (in `style-guide.css`/`nav.css`) responds immediately — no prop drilling needed for pure CSS-driven styling.
7. Components that render icons (`MainNav`, `MobileNav`, `MobileMenu`, `HomeLink`, `Footer`) read `theme` from `useTheme()` directly and pass the resolved color string as a prop into the relevant `Icons.js` component, which uses it as the SVG `fill`/`stroke` value.
8. On subsequent visits, step 2's inline script reads the persisted `localStorage` value first, so the explicit user choice always wins over the OS preference after the first toggle.

## 6. Component Responsibilities

### `ThemeContext` (new — `next/context/ThemeContext.js`)
- Responsible for: owning `theme` state (`'light' | 'dark'`), resolving the initial value (localStorage → OS preference → `'light'` fallback), toggling the `dark` class on `document.documentElement`, persisting changes to `localStorage`, and exposing `{ theme, toggleTheme }` via `useTheme()`.
- Not responsible for: rendering any UI, knowing about nav/menu open state (stays separate from `AppStateContext`), server-side rendering of the correct initial class (that's the inline script's job).
- Props: `{ children: ReactNode }` on the `ThemeProvider` wrapper component.
- Internal state: `theme: 'light' | 'dark'`.

### Theme init script (new — inline script in `next/app/layout.js`, or a small new file e.g. `next/utility/themeInitScript.js` exporting the script string)
- Responsible for: synchronously setting the correct class on `<html>` before paint, based on `localStorage` or media query.
- Not responsible for: anything beyond that one read-and-set operation; contains no other logic and must stay dependency-free (runs before React/hydration).
- No props/state — plain injected `<script dangerouslySetInnerHTML>`.

### `ThemeToggle` (new — `next/components/ThemeToggle.js`)
- Responsible for: rendering the pill/switch control, reading `theme`/`toggleTheme` from `useTheme()`, calling `toggleTheme()` on interaction, exposing accessible state (`aria-checked`, `role="switch"`, visible label/icon for current mode).
- Not responsible for: deciding where it's positioned or how it's spaced within the desktop nav vs. mobile menu — layout/spacing classes are passed in or handled by the parent, so the same component can be reused in both places.
- Props: `{ className?: string }` (optional, for parent-controlled layout/spacing only — no color/appearance overrides, since the switch's own look is themed internally via `theme`).
- Internal state: none (fully derived from context).

### `MainNav.js` (existing — modified)
- Additional responsibility: apply `dark:bg-black` (alongside existing `bg-cream`) to the header, pass theme-resolved color into `<UpArrow />`.
- Not responsible for: owning theme state (only consumes it via `useTheme()`).
- Props/state: unchanged aside from internal reads from `useTheme()`.

### `MainNavLinks.js` (existing — modified)
- Additional responsibility: render `<ThemeToggle />` as an additional list item alongside Gallery/Shop/About/social links; apply `dark:text-cream` to link text/container as needed (or rely on the `html.dark` CSS-variable cascade if link color is inherited rather than set via a literal Tailwind class — confirm per-element during implementation).
- Not responsible for: toggle behavior itself (delegated to `ThemeToggle`).

### `MobileNav.js` (existing — modified)
- Additional responsibility: apply `dark:bg-black` to the bar, pass theme-resolved color into `<UpArrow />`.
- Not responsible for: rendering the toggle (toggle lives in `MobileMenu`, not the top bar, per mobile-menu UI convention already established for "Menu" access).

### `MobileMenu.js` (existing — modified)
- Additional responsibility: apply `dark:bg-black` (replacing/extending `bg-white`) to the panel, `dark:text-cream` to text, `dark:bg-cream` to the circular active-link dots (currently `bg-black`, needs to remain visible against a black panel), render `<ThemeToggle />` in the panel (e.g. near the top or bottom, alongside social links), and pass theme-resolved color into the close-button icon if it's converted to use `x.svg`'s new inline component (currently a literal `×` character glyph, which already inherits `currentColor`/text-color rules automatically since it's text — confirm during implementation whether to leave as-is or replace with an icon; no forced change).
- Not responsible for: toggle behavior itself (delegated to `ThemeToggle`).

### `Icons.js` (existing — modified, and extended with 4 new components)
- Responsible for: exporting all icon components (`WordMark`, `SecondaryMark`, `PlayButton`, `UpArrow`, plus new `LeftArrow`, `RightArrow`, `CloseX`, `FlowersFullLogo`), each accepting a `color` prop and using it for `fill`/`stroke` on every path that currently has a hardcoded color.
- Not responsible for: knowing about theme state — callers resolve `theme` via `useTheme()` and pass the concrete color string down; keeps `Icons.js` a pure presentational module with no context dependency.
- Props per component: `{ color?: string }`, defaulting to the component's current hardcoded color (`black` for `WordMark`/`UpArrow`, `white`/`#FFFFFF` for `SecondaryMark`/`PlayButton`) so existing call sites that don't pass `color` keep rendering exactly as before.

### `HomeLink.js` / `Footer.js` (existing — modified)
- Additional responsibility: replace `<Image src="/left-arrow.svg" .../>`-style references with the new inline icon components from `Icons.js`, passing theme-resolved `color`.
- Not responsible for: any other layout/behavior changes.

### `layout.js` (existing — modified)
- Additional responsibility: wrap `<AppWrapper>` (or be wrapped by) a new `<ThemeProvider>`, and inject the pre-hydration inline theme script into `<head>`.
- Not responsible for: any theme logic beyond mounting the provider and injecting the script — all logic lives in `ThemeContext.js`.

### `tailwind.config.js` (existing — modified)
- Additional responsibility: `darkMode: 'class'` enabled; palette unchanged (no new Tailwind color tokens are strictly required if CSS variables handle chrome-level color and `dark:` variants reference the existing `black`/`cream` tokens directly, e.g. `dark:bg-black dark:text-cream`).

### `style-guide.css` / `nav.css` (existing — modified)
- Additional responsibility: `html`/`body` background/text and the hardcoded `background-color: black` dot indicators switch to CSS custom properties (`var(--color-bg)`, `var(--color-text)`) defined on `:root` and overridden under `html.dark`.

## 7. Files Affected

- `next/context/ThemeContext.js` — new file; owns theme state, persistence, and the toggle function.
- `next/components/ThemeToggle.js` — new file; the reusable pill/switch UI control.
- `next/tailwind.config.js` — add `darkMode: 'class'`.
- `next/styles/style-guide.css` — replace hardcoded `html`/`body` background/text colors with CSS custom properties, add `html.dark` override block.
- `next/styles/nav.css` — replace hardcoded `background-color: black` on the active-link dot and carousel-counter dot indicators with a variable/dark-aware value.
- `next/app/layout.js` — mount `ThemeProvider`, inject the pre-hydration inline theme script into `<head>`.
- `next/components/Icons.js` — add `color` prop to `WordMark`, `SecondaryMark`, `PlayButton`, `UpArrow`; add four new inline components (`LeftArrow`, `RightArrow`, `CloseX`, `FlowersFullLogo`) replacing the static files.
- `next/components/MainNav.js` — add `dark:bg-black`, pass theme color to `UpArrow`.
- `next/components/MainNavLinks.js` — render `ThemeToggle`, add `dark:text-cream` where link text color is set literally.
- `next/components/MobileNav.js` — add `dark:bg-black`, pass theme color to `UpArrow`.
- `next/components/MobileMenu.js` — add `dark:bg-black`/`dark:text-cream`, adjust dot-indicator color for dark contrast, render `ThemeToggle`.
- `next/components/HomeLink.js` — swap static SVG `<Image>` reference(s) for the new inline icon component(s), pass theme color.
- `next/components/Footer.js` — swap static SVG `<Image>`/`<img>` reference(s) for the new inline icon component(s), pass theme color.

## 8. Step-by-Step Implementation

1. **Enable class-based dark mode in Tailwind** (`tailwind.config.js`): add `darkMode: 'class'` at the top level of the config object. This must land first since every subsequent `dark:` utility class used in later steps depends on it being active; without it, Tailwind falls back to `media` strategy and ignores the explicit toggle.

2. **Introduce CSS custom properties for chrome-level color** (`style-guide.css`): define `--color-bg: #EEEBE6;` and `--color-text: #000000;` on `:root`, then add a new rule block `html.dark { --color-bg: #000000; --color-text: #EEEBE6; }`. Update the existing `html { ... background-color: theme('colors.cream'); color: black; }` rule to reference `var(--color-bg)` / `var(--color-text)` instead of the literals. Add `transition: background-color .3s, color .3s;` to the `html` rule so the switch feels smooth rather than an abrupt cut — confirm this doesn't conflict with existing nav slide transitions (it shouldn't, since those animate `transform`, not color). Gotcha: this file is plain CSS processed through PostCSS/Tailwind's `theme()` function, not a Tailwind utility — `dark:` variants do not apply here, hence the custom-property approach instead.

3. **Update `nav.css` dot indicators for dark-mode contrast** (`nav.css`): the `#main-nav .main-nav-links a.active::after`, `#home-carousel-counter span::before`, and `#home-carousel-counter span::after` rules currently hardcode `background-color: black`. Change these to `background-color: var(--color-text)` so they automatically invert to cream in dark mode (a black dot on a black background would be invisible). Gotcha: verify these dots are decorative UI purely against the page background, not against a `bg-cream`/`bg-white` component background, otherwise `var(--color-text)` may not give sufficient contrast in one of the two modes — spot check visually after implementation.

4. **Build `ThemeContext.js`** (new file, `next/context/ThemeContext.js`): create a client component module (`"use client"`) exporting `ThemeProvider` and `useTheme`. Internally: `useState` initialized lazily by reading `localStorage.getItem('theme')`, falling back to `window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'` (guard for SSR — this code only runs client-side inside `useState`'s lazy initializer or a `useEffect`, since `window`/`localStorage` are unavailable during server render). `toggleTheme` flips the state, calls `localStorage.setItem('theme', next)`, and toggles `document.documentElement.classList`. Also add a `useEffect` on mount that ensures the DOM class matches state (defensive sync in case the inline script and lazy-initializer ever disagree). Gotcha: since this is a Next.js client component but `layout.js` is an async server component, `ThemeProvider` must be imported into `layout.js` the same way `AppWrapper` already is — no server/client boundary issues expected since `AppWrapper` already proves this pattern works.

5. **Add the pre-hydration inline script** (`layout.js`): in the `<head>`, before any other script tags (or alongside them — ordering relative to analytics scripts doesn't matter, but it must be in `<head>`, not `<body>`, to run before the themed content paints), add a `<script dangerouslySetInnerHTML={{ __html: ... }} />` containing a small IIFE: read `localStorage.getItem('theme')`, else check `matchMedia`, then `document.documentElement.classList.toggle('dark', isDark)`. Wrap the whole body in `try { ... } catch (e) {}` since inline scripts that throw can block rendering in some edge cases (e.g. localStorage disabled in private browsing). Gotcha: this logic is intentionally duplicated (conceptually) between this inline script and `ThemeContext.js`'s initializer — they must resolve to the same value or a one-frame class mismatch (not a visible flash, but a React hydration warning) can occur. Keep the resolution logic (localStorage → matchMedia → default) identical in both places.

6. **Wrap the app in `ThemeProvider`** (`layout.js`): import `ThemeProvider` from the new context file and nest it with `AppWrapper` — order between the two providers doesn't matter since they're independent, but `ThemeProvider` should wrap (or be wrapped by) `AppWrapper` consistently, e.g. `<ThemeProvider><AppWrapper><body>...</body></AppWrapper></ThemeProvider>`. Gotcha: `<html>` itself is outside both providers per the existing structure (providers currently wrap only from `AppWrapper` down to `<body>`), which is fine since the theme class is applied directly to `document.documentElement` via imperative DOM manipulation, not via a React-rendered className — no provider needs to render inside `<html>`'s JSX attributes.

7. **Add `color` props to existing `Icons.js` components**: for `WordMark`, replace the absence of an explicit fill with `fill={color}` on the `<svg>` element (SVG fill is inheritable to children `<path>` elements that don't set their own fill, so setting it once on `<svg>` suffices) — default `color = 'black'`. For `SecondaryMark`, replace every hardcoded `fill="#FFFFFF"` on each `<path>` with `fill={color}` — default `color = 'white'` (preserves current behavior for existing callers). For `PlayButton`, replace `fill="white"` and `stroke="white"` with `fill={color}`/`stroke={color}` — default `color = 'white'`. For `UpArrow`, replace `fill="black"`/`stroke="black"` with `fill={color}`/`stroke={color}` — default `color = 'black'`. Gotcha: defaults must exactly match current hardcoded values so that any call site not yet updated in later steps continues to render identically — this makes the prop-adding step safe to land independently of the call-site updates in steps 10–11.

8. **Convert the four static SVG files into new `Icons.js` components**: read the raw markup of `next/public/left-arrow.svg`, `right-arrow.svg`, `x.svg`, and `FLOWERS-Full.svg`, and translate each into a new exported component (`LeftArrow`, `RightArrow`, `CloseX`, `FlowersFullLogo` respectively) following the same pattern as step 7 — accept a `color` prop, apply it to whatever fill/stroke attributes the original file used, with a default matching the file's current (presumably black, based on the rest of the site's icon defaults — verify each file's actual fill value while transcribing it, since it wasn't inspected in the codebase scan). Gotcha: copy `viewBox`, `width`/`height` (or lack thereof) exactly from the source files so visual size doesn't shift when swapping from `<Image>`/`<img>` to inline `<svg>` — inline SVGs don't get Next.js's automatic image optimization/sizing, so explicit dimensions or wrapping CSS classes may be needed at each call site to match current rendered size.

9. **Build `ThemeToggle.js`** (new file, `next/components/ThemeToggle.js`): a client component (`"use client"`) that calls `useTheme()`, renders a `<button role="switch" aria-checked={theme === 'dark'}>` styled as a pill/track with a sliding circular thumb (achievable with Tailwind: a fixed-width rounded track `div`/`button` with a smaller rounded `span` positioned via `translate-x` based on `theme`), calls `toggleTheme()` on click. Include a visually-hidden or `aria-label` text ("Toggle dark mode") for accessibility since the control is icon/shape-only. Accepts optional `className` for parent-controlled spacing. Gotcha: keep this component free of hardcoded light-mode-only colors (e.g. don't hardcode `bg-cream` for the track) — use `dark:` variants so the toggle itself visually reflects the current theme correctly in both modes.

10. **Wire the toggle and dark variants into desktop nav** (`MainNav.js`, `MainNavLinks.js`): in `MainNav.js`, add `dark:bg-black` to the `classNames(...)` call for the header, import `useTheme` and pass `color={theme === 'dark' ? 'cream' : 'black'}` into `<UpArrow />`. In `MainNavLinks.js`, import and render `<ThemeToggle />` as a new `<li>` in the link list (position: likely last, after social links, matching the "Up" arrow's position pattern in `MainNav.js` — final placement is a visual judgment call to make during implementation, not a hard requirement), and update the `text-black` class in the parent `<ul>` (in `MainNav.js`) to include `dark:text-cream` so link text inverts. Gotcha: the active-link indicator dot (`::after` pseudo-element in `nav.css`) was already made theme-aware in step 3, so no additional change needed here for that specific element.

11. **Wire the toggle and dark variants into mobile nav/menu** (`MobileNav.js`, `MobileMenu.js`): in `MobileNav.js`, add `dark:bg-black` to the header's `classNames(...)` call, pass theme color into `<UpArrow />`. In `MobileMenu.js`, change `bg-white` to include `dark:bg-black` (keep `bg-white` for light mode, or switch light mode to also reference `bg-cream`/`bg-white` as currently — no change to light-mode value), add `dark:text-cream` to text-bearing elements, change the four `bg-black` circle-indicator `div`s to `bg-black dark:bg-cream` so they remain visible against the panel background in both modes, and render `<ThemeToggle />` somewhere in the panel (recommended: as a new top-level item near the social links section, after the main `<ul>` of nav links, so it doesn't crowd the primary navigation items). Gotcha: the close button currently renders a literal `×` character (not an SVG) inside a `<button className="... font-secondary ...">` — its color is unset, meaning it inherits from the nearest ancestor with a set `color`; once `dark:text-cream` is applied somewhere up the tree (or via the `var(--color-text)`-driven `html.dark` rule if inheritance reaches that far), this should invert automatically without an explicit change, but verify visually since `MobileMenu`'s panel currently has no explicit text-color class of its own to inherit from.

12. **Swap static SVG references in `HomeLink.js`/`Footer.js`**: replace `<Image src="/left-arrow.svg" ... />`-style usages with `<LeftArrow color={...} />` (and equivalents for whichever of `right-arrow.svg`, `x.svg`, `FLOWERS-Full.svg` these two files actually reference), importing from `Icons.js`, resolving `color` via `useTheme()`. Gotcha: `HomeLink.js` and `Footer.js` were identified as the only two files referencing these static assets — re-verify via search immediately before editing, in case other files reference them too (e.g. gallery captions, project pages) that weren't surfaced in the initial scan.

13. **Manual verification pass**: load every route (`/`, `/about`, `/gallery`, `/info`, `/projects/[slug]`, `/shop`) in both themes, toggle from both desktop and mobile viewport widths, confirm no flash on load/navigation, confirm `localStorage` persists across reloads, confirm OS-preference fallback works when `localStorage` is cleared (test via devtools "Emulate CSS prefers-color-scheme").

## 9. Edge Cases

- **`SecondaryMark`/`PlayButton` are currently always white**, not black — they likely sit on dark/photo backgrounds (video overlays, project media) rather than the cream page chrome, so they may need to stay white in both themes rather than switching to black/cream like the nav icons. This needs a quick visual check of where `SecondaryMark` and `PlayButton` are actually used before deciding whether to pass a theme-driven `color` at all for these two, or leave their call sites without a `color` prop (falling back to the default `white`) so they're unaffected by the theme change. Treat this as an open question to resolve by inspecting call sites during implementation, not by guessing.
- **Static SVG files' actual current fill values are unknown** — the codebase scan found their file paths and two consumers but did not open the SVG markup itself. Some may already use `currentColor`, hardcoded black, or no fill at all (default black per SVG spec). Step 8 must inspect each file's actual content before deciding the default `color` value and which attributes to parameterize.
- **`localStorage` unavailable** (private browsing edge cases in some browsers, or disabled storage): both the inline script and `ThemeContext`'s initializer must not throw — wrap `localStorage` reads/writes in `try/catch` and fall back to in-memory-only state (theme choice won't persist across reloads, but the site still functions and defaults to OS preference each load).
- **`prefers-color-scheme` unsupported** (very old browsers): `matchMedia` calls should be guarded (`window.matchMedia?.(...)`. ), defaulting to `'light'` if unavailable, matching current site behavior.
- **Screensaver component** (`Screensaver.js`) and any full-bleed image/video overlays were not inspected for hardcoded background colors — if it renders its own background (not just images), it should be checked for dark-mode awareness during implementation, since it's a global overlay mounted in `layout.js` alongside the nav/menu.
- **Hydration mismatch risk**: if the inline script (step 5) and `ThemeContext`'s client-side initializer (step 4) ever compute a different value from each other (e.g. due to a logic typo), React may log a hydration warning or briefly show the wrong theme for one frame on the very first load. Keep the resolution algorithm byte-for-byte consistent between both locations, ideally by extracting the shared logic into one small utility function that's referenced by both (acceptable even though the inline script must remain plain JS text — copy the equivalent logic manually and comment that it must stay in sync, since the script can't literally `import` the utility).

## 10. Test Considerations

**Manual (required, no automated test infra currently evident in the project):**
- Toggle from desktop nav on every route; confirm background, text, and all visible icons invert correctly with no missed hardcoded-black/cream elements.
- Toggle from mobile menu on every route at a mobile viewport width; confirm the same.
- Reload the page after toggling to dark — confirm it opens directly in dark mode (no flash of light mode).
- Clear `localStorage`, set OS to dark via devtools emulation, reload — confirm site opens in dark mode by default. Repeat for OS light.
- Check the active-nav-link dot indicator, mobile-menu circle indicators, and carousel counter dots for adequate contrast against the new dark background.
- Check `SecondaryMark`/`PlayButton` usages specifically (video/project overlays) to confirm they still look correct after any changes made per the Edge Cases note above.
- Verify the `ThemeToggle` control is reachable via keyboard (Tab + Enter/Space) and its `aria-checked` state updates, given no existing accessibility testing pattern was found in the codebase to mirror.

**Automated:** no test framework (Jest/Playwright/etc.) was found in the project during this scan; if one exists elsewhere in the repo it should be reused, otherwise automated coverage is out of scope for this change and manual verification per the above is the validation method.

## 11. Implementation Order

1. `next/tailwind.config.js` — existing file; enable `darkMode: 'class'` first since all later `dark:` utility usage depends on it.
2. `next/styles/style-guide.css` — existing file; introduce the `--color-bg`/`--color-text` custom properties and `html.dark` override, establishing the base chrome theming other steps build on top of.
3. `next/styles/nav.css` — existing file; make the hardcoded dot-indicator colors theme-aware, since they depend on the variables just introduced.
4. `next/context/ThemeContext.js` — new file; core theme state/logic, needed before anything can consume `useTheme()`.
5. `next/app/layout.js` — existing file; mount `ThemeProvider` and add the pre-hydration inline script, making theme state available app-wide before any consuming component is touched.
6. `next/components/Icons.js` — existing file; add `color` props to current components and the four new inline icon components, providing the building blocks the nav/menu components will consume next.
7. `next/components/ThemeToggle.js` — new file; the toggle UI control, buildable once `useTheme()` exists.
8. `next/components/MainNav.js` — existing file; add dark background and themed `UpArrow`.
9. `next/components/MainNavLinks.js` — existing file; render `ThemeToggle` and apply dark text styling.
10. `next/components/MobileNav.js` — existing file; add dark background and themed `UpArrow`.
11. `next/components/MobileMenu.js` — existing file; add dark styling, themed indicator dots, and render `ThemeToggle`.
12. `next/components/HomeLink.js` — existing file; swap static SVG reference(s) for new inline icon component(s).
13. `next/components/Footer.js` — existing file; swap static SVG reference(s) for new inline icon component(s).
14. Manual verification pass across all routes/viewports/themes (no file changes — validation step only).
