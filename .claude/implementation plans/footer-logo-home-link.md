# Footer Logo Links to Home

## 1. Goal

The FLOWERS wordmark logo displayed in the site footer is currently static, non-interactive markup. Users should be able to click it to navigate to the homepage, matching the behaviour of the same logo when it appears in `HomeLink`.

## 2. Current System Behaviour

`Footer.js` renders the wordmark inside a plain wrapper:

```
<div className="wordmark">
  <FlowersFullLogo color={theme === "dark" ? "#EEEBE6" : "black"} className="w-full h-auto" />
</div>
```

`FlowersFullLogo` (defined in `Icons.js`) is a presentational inline SVG component taking `color` and `className` props — it has no navigation behaviour of its own and is not wrapped in an anchor or `Link` anywhere it is currently used in `Footer.js`.

Elsewhere in the codebase, `HomeLink.js` renders the same `FlowersFullLogo` component wrapped in a Next.js `Link`:

```
<Link href="/" className="relative flex justify-center w-full mt-24 lg:mt-0">
  <FlowersFullLogo color={iconColor} className="w-full h-auto" />
</Link>
```

`Footer.js` already imports `Link` from `next/link` (used for the IG/YouTube/Substack list items and is available for reuse without a new import).

## 3. Desired Behaviour

Clicking or tapping the footer wordmark navigates the user to `/`, using client-side routing via Next.js `Link`. No other visual, layout, or styling change is introduced — the `.wordmark` div and its CSS remain exactly as they are today, the logo's `color`/`className` props are unchanged, and no hover effect or conditional pathname logic is added. Clicking the logo while already on `/` behaves as an ordinary same-page `Link` navigation (a no-op), which is acceptable and requires no special handling.

## 4. Architecture Considerations

- **No new component**: this is a one-line structural wrap, not a reusable pattern extraction. `FlowersFullLogo` remains a plain presentational SVG component; navigation behaviour is added at the call site in `Footer.js`, exactly as it already is at the call site in `HomeLink.js`. Introducing a shared "LinkedLogo" component would be over-engineering for a single usage.
- **`Link` vs `div` wrapping**: the existing `.wordmark` div is kept as the outer element (preserving whatever CSS targets `.wordmark` for layout/sizing); the `Link` is inserted as a new child wrapping only the `FlowersFullLogo`, mirroring the fact that in `HomeLink.js` the `Link` itself carries the layout classes. Because `Footer.js`'s layout classes live on the outer `div` (via the `.wordmark` CSS class) rather than needing to move to the `Link`, no classes are transferred — the `Link` needs no `className` at all unless visual QA reveals the SVG's block-level rendering inside the anchor causes unwanted default inline spacing (see Edge Cases).
- **No change to theming logic**: `color={theme === "dark" ? "#EEEBE6" : "black"}` stays exactly as-is; only the presence of an anchor wrapper changes.
- **Blast radius**: limited to `Footer.js`. No other file reads or depends on the structure of the `.wordmark` div's children.

## 5. Data Flow

No data flow changes. `theme` continues to come from `useTheme()` and is passed to `FlowersFullLogo` as before. The only addition is a static `href="/"` on the new `Link`, which does not depend on any state, prop, or context — identical in nature to the static hrefs already used for the IG/YouTube/Substack links in the same file.

## 6. Component Responsibilities

### `Footer.js` (existing, modified)

**Responsible for:**
- Rendering the footer, including the wordmark, now wrapped in a `Link` to `/`.

**Not responsible for:**
- Any change to `FlowersFullLogo`'s internal rendering, sizing, or color logic.
- Any pathname-aware conditional rendering (unlike `HomeLink.js`, which conditionally hides its own logo link on `/projects` and `/about` routes — that conditional is specific to `HomeLink`'s different layout context and is not being replicated here).

**Props:** none change; `Footer` remains a no-props component.

**Internal state:** unchanged (`year`, `theme` from `useTheme()`).

### `Icons.js` / `FlowersFullLogo` (unchanged)

**Responsible for:** rendering the SVG wordmark given `color` and `className`.

**Not responsible for:** navigation — this remains true after the change; navigation is entirely owned by the new `Link` wrapper in `Footer.js`.

## 7. Files Affected

- `next/components/Footer.js` — add a `Link href="/"` wrapping the existing `FlowersFullLogo` inside the `.wordmark` div.

No other files require changes. `Icons.js` and `HomeLink.js` are reference-only for this change and are not modified.

## 8. Step-by-Step Implementation

**Step 1 — Wrap `FlowersFullLogo` in a `Link` in `Footer.js`.**
Inside the `<div className="wordmark">` block (currently lines 55–57), insert `<Link href="/">` as the direct parent of `<FlowersFullLogo .../>`, closing it immediately after. `Link` is already imported at the top of the file (`import Link from "next/link";`), so no new import is needed.
*Gotcha:* do not add any `className` to the new `Link` unless visual QA (Step 2) shows it's needed — the goal is a pure behavioural addition, not a styling change.
*Connects to:* this is the only functional step; everything else is verification.

**Step 2 — Visual verification.**
Load the site in a browser and inspect the footer. Confirm the `.wordmark` div's sizing and position are pixel-identical to before the change (the anchor tag defaults to `display: inline` for most browsers when wrapping an `<svg>`, which can occasionally introduce a few pixels of baseline whitespace below the element depending on existing CSS). If any shift is visible, the fix is to add `className="block w-full"` (or equivalent, matching whatever inline/block context `.wordmark` expects) to the `Link` — but only if the visual check shows a regression.

## 9. Edge Cases

- **Anchor-wrapped SVG default spacing**: as noted in Step 2, wrapping an inline SVG in an anchor can introduce a small amount of default inline-level whitespace in some browsers. This is a CSS-only concern, checked visually, not a functional risk.
- **Already on the homepage**: clicking the logo while on `/` triggers a normal `Link` navigation to the same route — no crash, no unwanted state reset, matches confirmed acceptable behaviour (no conditional needed).
- **Dark/light theme**: unaffected — `color` prop logic is untouched, so the logo's fill color continues to update with `theme` exactly as before.

## 10. Test Considerations

**Manual checks (no automated test suite covers this component):**
- Click the footer logo from the homepage: confirms it navigates to `/` (or stays, if already there) without error.
- Click the footer logo from a non-home route (e.g. `/about`, `/projects/[slug]`): confirms client-side navigation to `/` occurs.
- Visually compare the footer wordmark's size/position before and after the change in both light and dark theme, at both mobile and desktop breakpoints, to confirm no layout shift was introduced.
- Confirm keyboard accessibility: tabbing to the footer logo now stops on it as a focusable link (previously it was not focusable), and pressing Enter navigates to `/`.

## 11. Implementation Order

1. `next/components/Footer.js` (existing file, modified) — the only file that changes: wrap the `FlowersFullLogo` in a `Link href="/"` per Step 1. Manual visual and keyboard verification (Section 10) follows immediately in the browser; no build step is required.
