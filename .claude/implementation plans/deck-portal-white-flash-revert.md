# Revert unnecessary portal root-layout split (white-flash follow-up)

## 1. Goal

Undo the structural changes made while investigating the deck-portal white-flash bug. The changes were based on an incorrect theory (that the flash came from the shared root layout's light-theme `html`/`body` background showing through during navigation). The actual cause, confirmed afterward, was `react-pdf`'s own default white `.react-pdf__Page` background painting before each PDF page's canvas finished rendering for the first time. That fix (already applied, in `next/styles/deck.css`) is correct and stays. Everything else changed on this branch in pursuit of the wrong theory should be reverted to restore the codebase to its original, simpler structure.

## 2. Current System Behaviour (as currently modified, to be undone)

- `next/app/(portal)/layout.js` was converted from a plain nested layout (a `<div>` wrapper rendered inside the shared root layout's `<body>`) into an independent Next.js root layout with its own `<html>` and `<body>` tags, its own `import "../../styles/global.css"`, its own duplicated Google Analytics / GTM / Microsoft Clarity script tags (copied out of `next/app/layout.js`), and an added `title` in its `metadata` export.
- `next/app/(portal)/portal/[token]/page.js` had a `loading: () => <div className="deck-pdf-viewer" />` option added to the `nextDynamic(() => import(DeckPdfViewer), { ssr: false })` call.
- `next/styles/style-guide.css` had `background-color: var(--color-bg);` added to the existing `body { ... }` rule.
- `next/styles/deck.css` had two separate changes: (a) `.deck-pdf-nav`'s `background-color` and `color` were changed from `var(--color-bg)` / `var(--color-text)` to hardcoded `#000000` / `#ffffff`, to compensate for the root-layout split's loss of the `.dark` class; and (b) a new rule `.deck-pdf-viewer__page .react-pdf__Page { background-color: #000000 !important; }` was added — this is the genuine fix for the real bug and is not part of this revert.
- `next/app/layout.js` (the shared root layout) was never modified in this session.

None of these four modified files have been committed to git; `git status` shows them as working-tree modifications against the last commit, so each can be compared directly against its committed version.

## 3. Desired Behaviour

After the revert:
- `next/app/(portal)/layout.js` returns to being a plain nested layout: no `<html>`/`<body>`, no CSS import, no analytics scripts, `metadata` containing only `robots: { index: false, follow: false }`.
- `next/app/(portal)/portal/[token]/page.js`'s dynamic import returns to `{ ssr: false }` with no `loading` option.
- `next/styles/style-guide.css`'s `body` rule has no `background-color` line.
- `next/styles/deck.css`'s `.deck-pdf-nav` rule uses `var(--color-bg)` / `var(--color-text)` again, while its `.deck-pdf-viewer__page .react-pdf__Page` rule (the real fix) is left untouched.
- The portal continues to render inside the single shared root layout (`next/app/layout.js`), as it did before this branch's white-flash investigation began.
- The white-flash-on-first-visit-per-PDF-page bug remains fixed, since that fix is preserved.

## 4. Architecture Considerations

This is a pure revert to a previously-working structure; no new architectural decisions are introduced. The only judgment call is isolating the one rule to keep inside `next/styles/deck.css`, since that file received two independent, unrelated edits in the same session. The safest way to do this correctly is to diff the file against its committed version and restore everything except the `.react-pdf__Page` rule, rather than trying to hand-reconstruct the file from memory — this avoids accidentally reintroducing or dropping unrelated formatting.

## 5. Data Flow

No data flow is affected. This is a rendering-structure and CSS revert only; no props, state, requests, or API behaviour change. The portal's request handling (`resolveDeckAccess`, `PasswordGate`, `DeckEmbed`, `DeckPdfViewer`) is untouched throughout.

## 6. Component Responsibilities

**`next/app/(portal)/layout.js` (reverted)**
- Responsible for: wrapping `children` in the `portal-shell portal-shell--dark` div with an inline black background, and setting `robots: noindex` metadata for the route group.
- Not responsible for: rendering `<html>`/`<body>`, loading global CSS, or injecting analytics scripts — all of that reverts to being handled solely by `next/app/layout.js`.
- Props: `children` (React node, required).
- Internal state: none (server component).

**`next/app/(portal)/portal/[token]/page.js` (reverted)**
- Responsible for: resolving deck access and rendering the correct state, exactly as before this branch's changes.
- Not responsible for: supplying a custom loading placeholder for the `DeckPdfViewer` dynamic import — reverts to relying on Next's default behavior for `ssr: false` dynamic imports (no visible placeholder swap-in beyond what the component itself renders once mounted).
- Props: `params` (object with `token`, required).
- Internal state: none (server component).

## 7. Files Affected

- `next/app/(portal)/layout.js` — revert to the plain nested `<div>` layout, dropping the root-layout split, CSS import, and duplicated analytics scripts.
- `next/app/(portal)/portal/[token]/page.js` — remove the added `loading` option from the `DeckPdfViewer` dynamic import.
- `next/styles/style-guide.css` — remove the added `background-color: var(--color-bg);` line from the `body` rule.
- `next/styles/deck.css` — revert only the `.deck-pdf-nav` rule's colors back to `var(--color-bg)` / `var(--color-text)`; leave the `.deck-pdf-viewer__page .react-pdf__Page` rule exactly as is.
- `next/app/layout.js` — no change; confirmed unmodified in this session, listed here only to record that it was checked and needs no action.

## 8. Step-by-Step Implementation

**Step 1 — Revert `next/app/(portal)/layout.js`.**
Restore this file to its last-committed version using `git checkout -- next/app/\(portal\)/layout.js` (or an editor revert/undo to the same effect). This is a full-file revert since every part of the current version's additions (the `<html>`/`<body>` wrapper, the `global.css` import, and all analytics script blocks) needs to disappear, and nothing in the committed version needs to be preserved selectively. Confirm afterward that the file contains only the `metadata` export and the `PortalLayout` function returning the two nested `<div>`s, with no `<html>`/`<body>`/`<head>` tags.

**Step 2 — Revert `next/app/(portal)/portal/[token]/page.js`.**
Restore this file to its last-committed version the same way (`git checkout`), since the only change in this session was the single `loading` option addition and there is nothing else in the current version worth preserving selectively. Confirm the `DeckPdfViewer` dynamic import reads exactly `nextDynamic(() => import("../../../../components/DeckPdfViewer"), { ssr: false })` afterward.

**Step 3 — Revert `next/styles/style-guide.css`.**
Restore this file to its last-committed version (`git checkout`), since the only change in this session was the single added `background-color: var(--color-bg);` line inside the `body` rule, and nothing else in the file was touched. Confirm the `body` rule reads `font-size: theme('fontSize.base'); height: 100%; display: flex; flex-direction: column;` with no background-color line afterward.

**Step 4 — Selectively revert `next/styles/deck.css`.**
This file cannot be reverted wholesale, since it contains both the change to undo (`.deck-pdf-nav`'s hardcoded colors) and the change to keep (`.deck-pdf-viewer__page .react-pdf__Page`'s black background rule). Diff the working file against its last-committed version (`git diff -- next/styles/deck.css`) to see both changes side by side, then manually edit only the `.deck-pdf-nav` rule block, changing `background-color: #000000;` back to `background-color: var(--color-bg);` and `color: #ffffff;` back to `color: var(--color-text);`. Leave the `.deck-pdf-viewer__page .react-pdf__Page { background-color: #000000 !important; }` rule completely untouched. This is the step with the highest risk of a mistake, since it requires a partial, hand-applied revert rather than a full-file restore — re-check the diff after editing to confirm only the `.deck-pdf-nav` block changed back and the `.react-pdf__Page` block is still present and unchanged.

**Step 5 — Confirm `next/app/layout.js` needs no action.**
No edit is required. This step exists only to record that the shared root layout was checked and confirmed unmodified, so nothing is left unaccounted for.

**Step 6 — Manual verification pass.**
Start the dev server, load a `/portal/[token]` deck link, and confirm: the portal still renders fully black (via the shared root layout's `.dark` class plus the portal-shell div, as it did originally, meaning this now depends on the visitor's site theme state — see Edge Cases), the PDF viewer's bottom nav bar renders correctly, and clicking through unvisited PDF pages for the first time shows no white flash (confirming the real fix in `deck.css` is intact and unaffected by the rest of the revert).

## 9. Edge Cases

- **The original white-flash risk returns, in its original (mild) form.** Reverting `next/app/(portal)/layout.js` means the portal's `<html>`/`<body>` background again depends on the shared root layout's `--color-bg` variable and the site-wide `.dark` class toggle, exactly as before this branch started. If the earlier flash was ever partially caused by that (rather than being entirely the `react-pdf` issue now fixed), it could theoretically resurface. This plan proceeds on the basis that the `react-pdf` fix was the actual and complete cause, per the investigation; if a flash is still observed after this revert on first load (not on a per-PDF-page basis), that would indicate the shared-layout theory had partial merit after all and would need separate, narrower follow-up — not a reason to keep the reverted root-layout split, which was disproportionate to the actual bug.
- **`deck.css` partial revert mistake.** Since Step 4 is a hand-edit rather than a full-file restore, double-check via `git diff` after editing that no unrelated whitespace or ordering changed and that exactly one rule block was reverted.
- **Uncommitted new files.** `.claude/implementation plans/deck-portal-password-revalidation.md` and the two `.claude/Implementation Plans/*.md` plan documents are untracked and unaffected by this revert; nothing in this plan touches them.

## 10. Test Considerations

Manual checks only, no automated tests affected:
- After Steps 1–3, confirm via `git status` / `git diff` that those three files show no diff against the last commit (fully reverted).
- After Step 4, confirm via `git diff -- next/styles/deck.css` that the only remaining diff against the last commit is the addition of the `.deck-pdf-viewer__page .react-pdf__Page` rule.
- Load a portal deck link (PDF content type) and click through several previously-unvisited pages to confirm no white flash appears (validates the kept fix still works post-revert).
- Confirm the PDF viewer's bottom nav bar renders with the portal's intended dark styling under normal conditions (validates the `.deck-pdf-nav` revert didn't reintroduce a visible regression under the site's default light theme state — if it does render lighter than expected, that is the original, pre-branch behavior being restored, not a new bug).

## 11. Implementation Order

1. `next/app/(portal)/layout.js` — full-file git revert; largest structural change, done first.
2. `next/app/(portal)/portal/[token]/page.js` — full-file git revert; independent of Step 1, no ordering dependency, but grouped early with the other full reverts.
3. `next/styles/style-guide.css` — full-file git revert; independent, grouped with the other full reverts.
4. `next/styles/deck.css` — partial, hand-applied revert; done last and separately since it requires care to avoid touching the kept `.react-pdf__Page` fix.
5. Manual verification pass across the checks in section 10, confirming both the revert is complete and the real fix is intact.
