# Replace HomeLink WordMark SVG with FLOWERS-Full.png

## 1. Goal

The site header ("home link") currently renders the FLOWERS wordmark as an inline SVG (`WordMark` component). This must be replaced with the raster image `next/public/FLOWERS-Full.png`, while preserving the existing scroll-driven resize behaviour of the header logo.

## 2. Current System Behaviour

`HomeLink.js` renders a `<nav id="home-link">` fixed to the top of the viewport, containing a `<Link href="/">` that wraps the `WordMark` component (an inline SVG with viewBox `0 0 800 145.9`, defined in `Icons.js`).

Sizing is fully JS-driven:

- `targetSize` is set to 170 on viewport widths ≥992px, otherwise 130 (computed once per render from `window.matchMedia`, not reactive to resize itself).
- `container` (a ref on the wrapping `div`) is measured via `offsetWidth` in `handleResize`, which runs on mount, on window resize, and on pathname change.
- `maxTitleSize` is set to the container's natural width; `titleSize` is initialised to that same natural width on load.
- A `useMotionValueEvent` scroll listener recalculates `titleSize` on every scroll tick: once `scrollY` passes 400px (`scrollTriggerVal`), `titleSize` snaps to `targetSize` (170 or 130) and `showCaptions` becomes true; below that threshold, `titleSize` is interpolated between `maxTitleSize` and `targetSize` based on scroll progress, and `showCaptions` is false. This produces a shrinking logo as the user scrolls down.
- The scroll handler also toggles Redux-style `state.hideHomeLink` / `state.hideNav` based on scroll direction, unrelated to sizing.
- The `<Link>`'s inline `style` sets `width: ${titleSize}px`. The SVG itself has no explicit width/height attributes, so it fills that container width and scales height automatically via its viewBox aspect ratio (800:145.9 ≈ 5.48:1).
- The whole `<Link>` only renders once `titleSize` is a non-falsy truthy value (`{titleSize && (...)}`), avoiding a flash of 0-width content before the first measurement.

`Icons.js` also exports `SecondaryMark`, a separate SVG used elsewhere (not part of this change, not to be touched).

## 3. Desired Behaviour

The same header nav, same scroll-driven shrink/grow animation, same show/hide behaviour — but the visual mark is `FLOWERS-Full.png` (a raster PNG, natural size 1312×217px, aspect ratio ≈ 6.05:1) rendered via `next/image`, instead of the inline `WordMark` SVG. The image's width must continue to track `titleSize` exactly as the SVG's container width did today; its height must be derived from the image's own aspect ratio rather than hardcoded, so the logo does not distort as it resizes.

`WordMark` in `Icons.js` remains in the codebase, unused, per explicit instruction not to remove it.

## 4. Architecture Considerations

- **Why `next/image` over a plain `<img>`:** the codebase already uses `next/image` in `MainNav.js` for the same kind of static public-folder logo asset, so this matches existing convention. `next/image` also handles responsive `srcSet`/optimization automatically.
- **Sizing mechanism:** `next/image` requires either a `width`/`height` pair or `fill` (with a positioned parent). Because `titleSize` is a fluid, animated pixel value (not a fixed design-time constant), passing `width={titleSize}` and a derived `height` on every render is the most direct way to preserve current behaviour without restructuring the animation logic. `fill` mode would require converting the `<Link>` into a `position: relative` box with an explicit height, which is a bigger structural change than necessary for this swap.
- **Deriving height from width:** the image's intrinsic aspect ratio (1312/217 ≈ 6.0461) is a constant. Height is computed each render as `titleSize / ASPECT_RATIO`, keeping the image undistorted at every size. This constant should live as a small named value near the top of `HomeLink.js` (or inline in the render), not in `Icons.js`, since it's specific to this one usage of the asset.
- **No change to the `<Link>` wrapper's inline `style` width**, since that still governs the layout box; the `Image` itself takes matching `width`/`height` props so the rendered `<img>` matches the box exactly.
- **`alt` text:** the SVG had no accessible text equivalent (it's decorative wordmark inside a link to "/"). The `Image` must carry `alt="FLOWERS"` so the logo remains accessible — this is a minimum accessibility bar for swapping vector text art for a raster image inside a link.
- **No new dependencies.** `next/image` is already imported and used elsewhere in the codebase (`MainNav.js`).
- **Blast radius:** only `HomeLink.js` changes. `Icons.js`, `MainNav.js`, `MobileNav.js`, and any footer/OG/favicon usage are unaffected and out of scope.

## 5. Data Flow

No data-layer changes. The flow is purely presentational/state-driven within `HomeLink.js`:

1. On mount and on window resize, `handleResize` measures the container `div`'s `offsetWidth` and sets `maxTitleSize` / `titleSize` (React state, local to `HomeLink`).
2. On pathname change, sizing is reset the same way.
3. On every scroll tick, `titleSize` is recalculated (either snapped to `targetSize` past the threshold, or interpolated below it) and pushed into the same local state.
4. `titleSize` (a number, pixels) flows into two places on render: the `<Link>`'s inline `style.width`, and — after this change — the `Image`'s `width` prop and the derived `height` prop.
5. No props change on `HomeLink` itself; it remains a no-props component. No global state (`useAppState`) participates in sizing, only in the unrelated hide/show nav behaviour.

## 6. Component Responsibilities

### `HomeLink.js` (existing, modified)

**Responsible for:**
- Measuring available width and animating `titleSize` on scroll/resize/pathname change (unchanged).
- Rendering the home logo/link at the current `titleSize`, now via `next/image` instead of inline SVG.
- Deriving the image's `height` from `titleSize` using the asset's fixed aspect ratio.
- Toggling caption visibility and nav hide/show state on scroll (unchanged).

**Not responsible for:**
- Defining the visual artwork itself (that's the PNG asset in `public/`, not JS).
- Any layout/behaviour of `MainNav.js` or `MobileNav.js`.

**Props:** none (unchanged — `HomeLink` takes no props).

**Internal state (unchanged):** `maxTitleSize`, `titleSize`, `prevScroll`, `showCaptions`, plus the `container` ref.

### `Icons.js` (unchanged)

**Responsible for:** exporting `WordMark` (now unused, left in place) and `SecondaryMark` (still used elsewhere).

**Not responsible for:** anything related to the new PNG asset.

## 7. Files Affected

- `next/components/HomeLink.js` — remove the `WordMark` import and usage; import `next/image`; render `<Image src="/FLOWERS-Full.png">` sized from `titleSize` and the asset's aspect ratio.

No other files change. `next/public/FLOWERS-Full.png` already exists and requires no modification.

## 8. Step-by-Step Implementation

**Step 1 — Update imports in `HomeLink.js`.**
Remove `WordMark` from the `import { WordMark, SecondaryMark } from "./Icons";` line (keep `SecondaryMark` — it's out of scope and must not be removed even if unused within this file). Add `import Image from "next/image";` near the other imports (`Link`, `usePathname`, etc.).
*Gotcha:* only drop the `WordMark` named import, not the whole import statement.

**Step 2 — Define the aspect ratio constant.**
Near the top of the component (alongside `targetSize`/`scrollTriggerVal`-style constants), add a constant for the wordmark's intrinsic aspect ratio, computed from the asset's real pixel dimensions (1312×217 ⇒ ratio ≈ 6.0461). This is a plain numeric constant, not a prop or piece of state, since it's fixed for as long as this specific PNG is used.

**Step 3 — Replace the `<WordMark />` render with `<Image>`.**
Inside the existing `{titleSize && (<Link href="/" ...>...)}` block, replace the `<WordMark />` child with an `<Image>`:
- `src="/FLOWERS-Full.png"`
- `alt="FLOWERS"`
- `width={titleSize}` (same numeric value already driving the `Link`'s inline style width)
- `height={Math.round(titleSize / ASPECT_RATIO)}`
*Gotcha:* `next/image` requires valid positive numeric `width`/`height` — since `titleSize` is only rendered when truthy (existing `{titleSize && (...)}` guard), this is already safe, but confirm the derived height also can't be `0` or `NaN` under that same guard.
*Gotcha:* the `<Link>`'s own inline `style={{ width: titleSize + "px" }}` box and the `Image`'s `width` prop must stay numerically identical (same `titleSize` variable) so the image isn't cropped or stretched by its parent.

**Step 4 — Verify the `Link`'s `className="flex justify-center"` still centers the image correctly.**
Since `Image` renders a real `<img>` inside that flex container, confirm no extra wrapping element breaks the centering — this is a visual check, not a code change, unless the rendered markup needs an extra wrapper class.

**Step 5 — Confirm no `next.config.js` image-domain change is needed.**
Since the asset is served from `public/` (a local static path), no `images.domains`/`remotePatterns` config should be needed (same as `MainNav.js`'s existing local `/FLOWERS.png` usage) — verify the asset loads without a Next.js image-optimization error in dev.

## 9. Edge Cases

- **`titleSize` is `0` or falsy during initial render:** already guarded by `{titleSize && (...)}` — the whole `Link`/`Image` doesn't render until a real width is measured, so no invalid `width`/`height` is ever passed to `Image`.
- **Non-integer `height`:** `titleSize / ASPECT_RATIO` will usually be a float; round it before passing to `Image`'s `height` prop to avoid subpixel/console-warning issues.
- **Very small `titleSize` (e.g. the 130px `targetSize` on narrow viewports):** the wordmark's wide aspect ratio (~6:1) means the image gets quite short at small widths (~21px tall at 130px wide) — visually check legibility isn't degraded compared to the old SVG at the same width.
- **Rapid resize/scroll changing `titleSize` every frame:** `next/image` recalculating `width`/`height` on every render should be inexpensive since it's just an `<img>` with attributes, not re-fetching the asset — but confirm no layout thrash/flicker appears during the scroll animation in manual testing.

## 10. Test Considerations

**Manual checks (no existing automated test suite covers this component, based on repository structure):**
- Load the home page at ≥992px width: logo should render at its natural/full container width initially, matching the old SVG's footprint.
- Load at <992px width: confirm `targetSize` of 130 still applies correctly once scrolled.
- Scroll past 400px: confirm the logo shrinks smoothly to the `targetSize` value and captions/up-arrow behaviour (on `/projects` and `/gallery` routes) is unaffected.
- Scroll back up: confirm the logo grows back and `showCaptions` toggles off correctly.
- Resize the window while on the page: confirm `handleResize` still re-measures correctly with the new `Image` in place.
- Navigate between routes (e.g. home → `/projects/[slug]` → home): confirm the pathname-triggered resize still works.
- Visually confirm the image isn't stretched, cropped, or blurry at both the largest and smallest rendered sizes.

## 11. Implementation Order

1. `next/components/HomeLink.js` (existing file, modified) — the only file that needs to change: swap the `WordMark` import/usage for a `next/image` `Image` pointing at `/FLOWERS-Full.png`, sized from `titleSize` and the asset's aspect ratio, per Steps 1–3 above. Manual verification (Steps 4–5 and Section 10) follows immediately after in the browser, since no build step is required for a `public/` asset that already exists.
