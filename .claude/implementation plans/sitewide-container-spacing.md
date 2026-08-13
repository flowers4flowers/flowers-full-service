# Sitewide Container/Divider Spacing Fix (1312/1444 Ratio)

## 1. Goal

The graphic designer's mockups were built on a 1444px-wide artboard where all content and dividers sit inside a 1312px-wide column (a ~90% fluid ratio). The live site currently has no such rule: horizontal spacing is produced by independently duplicated padding classes across five different files, with no shared max-width or ratio-based container. This causes content and dividers on the live site to sit at different horizontal positions than the design. This plan introduces one shared container definition, sets it to a 90%-of-viewport fluid width, and applies it everywhere page content, nav, footer, and dividers currently rely on ad hoc padding.

## 2. Current System Behaviour

There is no container or max-width mechanism anywhere in the codebase. Horizontal spacing is entirely padding-based, and the same visual intent (page-edge padding) is implemented independently in six places, with inconsistent values:

- `next/app/layout.js` — `<main className="px-5 lg:px-14">` wraps all routed page content.
- `next/components/HomeLink.js` — `<nav id="home-link" className="w-full px-5 lg:px-14 ...">`.
- `next/components/Footer.js` — `<footer id="site-footer" className="px-5 lg:px-14 py-5 lg:py-10">`, sibling of `<main>` in the layout tree (does not inherit `<main>`'s padding).
- `next/components/MainNav.js` — `position: fixed`, full-width, own `px-14` only (no mobile variant since it's `hidden lg:flex`).
- `next/components/MobileNav.js` — `position: fixed`, full-width, own `px-5`.
- `next/components/InfoContent.js` — a divergent scale, `px-8 lg:px-16 xl:px-24`, out of scope for this change (confirmed to remain as-is).

Because none of these use a max-width, content stretches edge-to-edge (minus padding) at any viewport size, including ultra-wide screens, which is the root cause of the mismatch with the designer's fixed-ratio mockup.

Section dividers (`hr` elements and `border-t`/`border-b` utility classes) have no independent width logic — they simply inherit whatever width their parent container currently produces:

- `next/app/about/page.js:48` — `<hr className="border-t border-black dark:border-cream my-32" />`
- `next/app/about/page.js:98` — `<div className="border-t border-black dark:border-cream">`
- `next/app/about/page.js:133` — `border-b border-black dark:border-cream` per list row
- `next/components/Footer.js:16` — `<hr className="border-t border-black dark:border-cream" />`
- `next/components/ProjectsList.js:24` — `border-t border-black dark:border-cream ... w-full mx-auto` (has `mx-auto` but no `max-w-*`, so it currently has no centering effect)
- `next/components/InfoContent.js:221,235` — `border-b` on accordion list items (out of scope — inside `InfoContent.js`)

## 3. Desired Behaviour

A single shared `Container` component defines the site's horizontal spacing rule: content is 90% of the viewport width, horizontally centered, at every breakpoint (no separate mobile/desktop padding logic). Every place that currently produces page-edge spacing — the root `<main>`, `HomeLink`, `Footer`, `MainNav`, `MobileNav` — renders its content through this one component instead of its own padding classes. Dividers that sit inside these wrapped regions automatically become 90%-width and centered with no per-divider changes. `InfoContent.js` is intentionally excluded and keeps its current padding scale.

## 4. Architecture Considerations

- **Single source of truth, two layers**: the 90% value is defined once in `tailwind.config.js` as a custom width token (`theme.extend.width.container: '90%'`), and consumed by one `Container` React component (`next/components/Container.js`) that applies `w-container mx-auto` (or equivalent). Every usage site imports the component rather than repeating a class string. This satisfies "define once, use everywhere" — if the ratio ever changes, it changes in one Tailwind token and nothing else.
- **Why a component and not just a Tailwind class**: a bare utility class (`w-[90%] mx-auto`) could be pasted into six files, but that reintroduces the exact duplication problem this plan is meant to fix — a typo or partial rewrite in one of the six places would silently drift out of sync. A component makes the wrapper structurally impossible to apply inconsistently.
- **`MainNav`/`MobileNav` are `position: fixed`, outside `<main>`'s normal flow**: `Container` must work correctly as a child of a fixed-position full-width parent, not just inside document flow. Since `Container` only sets width and centers via `margin-inline:auto`, this holds regardless of the parent's positioning — no special-casing needed, but it must be verified visually since fixed elements are the one place a silent bug (e.g. width computed against the wrong containing block) would be easy to miss.
- **`Footer` is a sibling of `<main>`, not a descendant**: it cannot inherit anything from wrapping `<main>` in `Container`; it needs its own explicit `Container` usage. This is already accounted for in scope.
- **Rounding decision (90% vs 90.86%)**: the exact designer ratio (1312/1444) is 90.86%; the round number 90% is used instead per explicit decision, accepting a ~12px difference from the mockup at the reference 1444px width in exchange for a simpler, more memorable token. This trade-off was chosen deliberately and should not be "corrected" back to 90.86% without checking with the user first.
- **No breakpoint-specific behavior**: `Container` applies the same `90%` rule from the smallest to the largest viewport, fully replacing the old `px-5`/`lg:px-14` two-tier system. This is simpler than the old system but changes mobile spacing behavior (see Edge Cases).
- **`InfoContent.js` explicitly out of scope**: it keeps `px-8 lg:px-16 xl:px-24` unchanged. This creates an intentional, acknowledged inconsistency between `InfoContent` and the rest of the site; not a defect to fix silently in a later pass without discussion.

## 5. Data Flow

This is a purely presentational/layout change — no application data, props, or state flow through the new component beyond `children` (the content being wrapped) and an optional `className`/`as` prop for element-type flexibility (e.g. `<nav>` vs `<footer>` vs `<div>`). Each consuming file passes its existing JSX children into `Container` in place of the div/section that previously carried the padding classes; no data source, API, or query file is touched.

## 6. Component Responsibilities

### `Container` (new — `next/components/Container.js`)
- **Responsible for**: rendering a wrapper element at 90% viewport width, horizontally centered, regardless of where it's placed in the tree (in-flow or inside a `position: fixed` ancestor).
- **Not responsible for**: vertical spacing/padding (`py-*`), background colors, or any styling unrelated to horizontal width — those remain on the consuming component's own wrapper/className so `Container` stays a single-purpose primitive.
- **Not responsible for**: breakpoint-specific width overrides — by decision, the width rule is flat across all screen sizes.
- **Props**:
  - `children: React.ReactNode` (required) — content to be width-constrained and centered.
  - `as?: React.ElementType` (optional, default `'div'`) — lets callers render `<nav>`, `<footer>`, etc. as the container element itself when that avoids adding an extra wrapping `<div>` inside an existing semantic element. Needed because `HomeLink`, `Footer`, and `MainNav`/`MobileNav` are currently semantic elements (`nav`, `footer`) that directly carry the padding classes being replaced.
  - `className?: string` (optional) — allows a consumer to append additional classes (e.g. vertical padding, background) without fighting the component's own width classes.
- **Internal state**: none.

## 7. Files Affected

| File | Change |
|---|---|
| `next/tailwind.config.js` | Add `theme.extend.width.container: '90%'` (or equivalent token) as the single definition of the ratio. |
| `next/components/Container.js` | New file — the shared wrapper component. |
| `next/app/layout.js` | Replace `<main className="px-5 lg:px-14">` with `<main>` rendering a `Container` (or `Container as="main"`) around `{children}`. |
| `next/components/HomeLink.js` | Replace `px-5 lg:px-14` on the `<nav id="home-link">` with `Container as="nav"` (retaining `id`, `w-full` removed since width is now controlled by `Container`, and any other existing classes like `lg:mt-[120px]` moved to `className`). |
| `next/components/Footer.js` | Replace `px-5 lg:px-14` on `<footer id="site-footer">` with `Container as="footer"`, retaining `id` and vertical padding (`py-5 lg:py-10`) via `className`. |
| `next/components/MainNav.js` | Replace the `px-14` on the fixed nav bar's inner content with `Container` wrapping the nav's content, keeping the fixed/full-width outer element as-is and constraining only the inner content row. |
| `next/components/MobileNav.js` | Replace the `px-5` on the fixed mobile nav bar's inner content with `Container` in the same manner as `MainNav.js`. |

No changes to: `InfoContent.js`, `ProjectsList.js`, `about/page.js`, `page.js` (home), any query/data files, or any CSS files. Dividers in these files need no direct edits because they inherit width from the newly wrapped parents (`Footer`, `layout.js` main via `page.js`, `about/page.js` which is itself rendered inside `<main>`).

## 8. Step-by-Step Implementation

**Step 1 — Add the width token to `tailwind.config.js`.**
Add a `width` (or `maxWidth`, decide based on whether percentage or capped-pixel semantics are wanted — per the confirmed decision this is a percentage, so `width` is correct, not `maxWidth`) entry under `theme.extend` with key `container` and value `'90%'`. This is the single place the ratio is defined; every other file references it only via the generated utility class (`w-container`) or via the `Container` component, never as a hardcoded literal. Watch out for: Tailwind's built-in `.container` class/plugin is unused in this project (confirmed in the audit), so naming the custom token `container` will not collide with any existing behavior, but do not enable Tailwind's default `container` core plugin behavior alongside this, since that plugin defines its own conflicting semantics (breakpoint-stepped max-widths) — keep it disabled/unused as it currently is.

**Step 2 — Create `next/components/Container.js`.**
Build the component per the responsibilities in Section 6: accepts `children`, `as` (default `'div'`), `className`; renders the chosen element with `w-container mx-auto` plus any passed-through `className` appended. This must come after Step 1 since it references the `w-container` utility class generated by the new token. Watch out for: `mx-auto` requires the element to be `display: block` (default for `div`, `nav`, `footer`, `main`) — confirm none of the target elements have a conflicting `display` set elsewhere in CSS (checked in the audit: none do).

**Step 3 — Update `next/app/layout.js`.**
Replace the `<main className="px-5 lg:px-14">{children}</main>` with `<main><Container>{children}</Container></main>` (or collapse to `<Container as="main">{children}</Container>` if `<main>` carries no other classes/behavior worth preserving separately — check the surrounding lines in `layout.js` for other classes on `<main>` before collapsing). This is the highest-impact single change since it constrains the home page, about page, gallery, info, shop, and project-detail pages simultaneously (everything rendered as `{children}` of the root layout). Watch out for: `style-guide.css` sets `main { flex: 1; padding-bottom: var(--nav-height); }` — if `Container` is rendered as a nested `div` inside `<main>` rather than replacing `<main>` itself, this existing rule is unaffected; if `Container` replaces `<main>` via `as="main"`, confirm the `flex: 1`/`padding-bottom` rule still applies (it will, since it targets the element type/tag, not a class).

**Step 4 — Update `next/components/HomeLink.js`.**
Replace `<nav id="home-link" className="w-full px-5 lg:px-14 lg:mt-[120px]">` with `<Container as="nav" className="lg:mt-[120px]">`, preserving the `id="home-link"` attribute (pass it through as a normal prop to `Container`, which forwards unknown props to the rendered element, or add an explicit `id` prop to `Container` if prop-forwarding isn't already part of its design from Step 2 — decide during Step 2 whether `Container` spreads `...rest` props for exactly this reason). Watch out for: dropping `w-full` is intentional — width is now controlled entirely by the `w-container` token, and leaving `w-full` in alongside it would be dead/confusing code.

**Step 5 — Update `next/components/Footer.js`.**
Replace `<footer id="site-footer" className="px-5 lg:px-14 py-5 lg:py-10">` with `<Container as="footer" id="site-footer" className="py-5 lg:py-10">`. The `<hr>` divider at `Footer.js:16` needs no direct edit — it will inherit the new 90% width automatically since it's a child of the now-wrapped footer. Watch out for: confirm `Footer` is rendered as a direct sibling of `<main>` (not inside it) in `layout.js`, per the audit — this step is what gives it the container treatment independently, since it cannot inherit from Step 3's change to `<main>`.

**Step 6 — Update `next/components/MainNav.js`.**
The outer nav element stays `fixed top-0 left-0 w-full` (it must remain full-width so its background spans the viewport), but its inner content (the row of nav links/logo currently carrying `px-14`) should be wrapped in `Container` instead. This means `Container` wraps an inner `div`, not the outermost fixed element — do not apply `Container` directly to the `fixed w-full` element itself, since that would shrink its background along with its content, breaking the full-bleed nav bar look. Watch out for: this is the step most likely to require a visual double-check, since fixed positioning with a nested centered container is a different structure than the current single-element-with-padding approach.

**Step 7 — Update `next/components/MobileNav.js`.**
Same pattern as Step 6: outer `fixed w-full` element unchanged, inner content wrapped in `Container` in place of its current `px-5`. Do this after Step 6 so both nav variants are handled consistently and can be visually compared side by side (mobile vs desktop breakpoints) in the same testing pass.

**Step 8 — Visual verification pass (see Section 10).**
Not a code change, but the final step before considering the work done: load every route at multiple viewport widths and confirm nav, footer, page content, and every divider listed in Section 2 line up at the same left/right edges.

## 9. Edge Cases

- **Mobile spacing regression**: replacing `px-5` (a fixed 20px) with `90%`-fluid width means on very narrow phone screens (e.g. 320–375px), side margins become ~16–19px per side, close to but not identical to today's fixed 20px — visually similar but worth a direct comparison at the smallest supported viewport to confirm nothing feels cramped, since this was an explicit trade-off accepted when choosing "apply everywhere" over "only above a breakpoint."
- **Ultra-wide screens**: on very large monitors (e.g. 2560px+), content will now scale up to ~2304px wide, which the previous fixed-padding system did not do (it stayed edge-to-edge). This is the intended fix per the goal, but if any component (e.g. large images, the gallery) was implicitly relying on being effectively unbounded-width before, verify it still reads correctly at very wide viewports.
- **`MainNav`/`MobileNav` fixed-position width computation**: if `Container`'s `w-container` percentage is ever computed relative to an unexpected containing block (rather than the viewport) due to the fixed-position ancestor chain, the nav's inner content could end up a different width than the page content below it. Verify explicitly rather than assuming CSS percentage-width-of-fixed-descendant behaves identically to percentage-width-of-in-flow-descendant (it does, since `fixed` elements are positioned relative to the viewport, but this is exactly the kind of assumption worth confirming visually per Step 6/7's watch-out).
- **`id` attributes on `HomeLink`/`Footer`**: if `Container` does not forward arbitrary props/`id` to its rendered element, any CSS or JS elsewhere in the codebase that selects `#home-link` or `#site-footer` will silently break. Confirm nothing else in the codebase queries these IDs before finalizing Step 2's prop-forwarding design (a quick search for `home-link` and `site-footer` beyond the files already touched is worth doing during implementation, not assumed from this plan alone).
- **`ProjectsList.js`'s existing dead `mx-auto`**: its `border-t ... w-full mx-auto` divider already has a no-op `mx-auto` (no-op because `w-full` leaves nothing to center). Once `ProjectsList` is rendered inside the newly wrapped `<main>`/`Container` tree (via Step 3), its `w-full` will correctly mean "100% of the now-90%-wide container," so no edit to `ProjectsList.js` is needed — but confirm this visually since "no code change needed" is exactly the kind of claim that should be checked, not assumed.

## 10. Test Considerations

**Manual (required, no automated visual test infrastructure exists in this project):**
- Load each route — `/`, `/about`, `/gallery`, `/info`, `/shop`, `/projects/[slug]` — at three viewport widths: a small mobile width (375px), the designer's reference width (1444px), and a large desktop width (1920px+).
- At each width, confirm the left/right edges of: page content, `MainNav`/`MobileNav` inner content, `Footer` content, and every divider listed in Section 2 all align to the same vertical lines.
- Confirm dark mode is unaffected (dividers use `dark:border-cream` — purely a color change, unrelated to this width-only edit, but worth a quick toggle-check since several affected files touch shared elements).
- Confirm `InfoContent.js`'s page (`/info`) intentionally still looks different in horizontal spacing from the rest of the site, per the explicit decision to leave it out of scope.
- Confirm no horizontal scrollbar appears at any tested width (a `90%` width with `mx-auto` should never overflow, but verify given the nested-container structure in `MainNav`/`MobileNav`).

**Automated**: no existing test suite covers layout/visual regression in this repo (not found during the audit); introducing one is out of scope for this plan unless raised separately.

## 11. Implementation Order

1. `next/tailwind.config.js` — existing file, modified. Add the `container: '90%'` width token first since every later step depends on the generated utility class existing.
2. `next/components/Container.js` — new file. Build the shared component next, since every consuming file change in later steps imports it.
3. `next/app/layout.js` — existing file, modified. Apply `Container` to the root `<main>` first; this is the highest-impact change (covers every page's content) and is a good early checkpoint to visually confirm the token/component work correctly before touching more files.
4. `next/components/Footer.js` — existing file, modified. Apply next since it's structurally simple (sibling of `<main>`, one element to change) and lets the `<hr>` divider be checked early.
5. `next/components/HomeLink.js` — existing file, modified. Similar complexity to `Footer.js`, done next.
6. `next/components/MainNav.js` — existing file, modified. Save the two fixed-position nav files for after the simpler in-flow elements are confirmed working, since they require the extra "wrap inner content only, not the outer fixed element" nuance from Step 6.
7. `next/components/MobileNav.js` — existing file, modified. Done last, immediately after `MainNav.js`, so both nav variants can be compared together in the same testing pass.
