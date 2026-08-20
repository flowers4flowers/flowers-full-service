# Move queries folder out of styles/

## 1. Goal

The `queries` folder currently lives inside `next/styles/queries/`, which is misleading — it contains Kirby CMS data-fetching logic, not stylesheets. It needs to move to `next/queries/` and every import that references it needs to be updated to use the `@/` path alias instead of relative paths.

## 2. Current System Behaviour

`next/styles/queries/` contains six files: `kirbyFetch.js` (the shared fetch wrapper) and five query modules (`aboutQuery.js`, `galleryQuery.js`, `layoutQuery.js`, `projectQuery.js`, `shopQuery.js`) that each import `kirbyFetch` via a relative `./kirbyFetch` import.

Six files under `next/app/` import from this folder using relative paths of varying depth (`../styles/queries/...`, `../../styles/queries/...`, `../../../styles/queries/...`) depending on how deeply nested the importing route file is:

- `next/app/page.js` → `aboutQuery`
- `next/app/layout.js` → `layoutQuery`
- `next/app/sitemap.js` → `projectQuery`
- `next/app/shop/page.js` → `shopQuery`
- `next/app/gallery/page.js` → `galleryQuery`
- `next/app/projects/[slug]/page.js` → `projectQuery`

`next/jsconfig.json` already defines a path alias: `"@/*": ["./*"]`, resolved relative to the `next/` directory. This alias is defined but not currently used by any of these imports.

`kirbyFetch.js` contains a stale header comment (`// next/queries/kirbyFetch.js`) that already anticipated this location — the file was written for `next/queries/` and later relocated into `styles/` without the comment being corrected.

## 3. Desired Behaviour

The folder lives at `next/queries/`, sitting alongside `app/` and `styles/` as a top-level concern. All six consumer files in `next/app/` import from it via `@/queries/<file>` instead of relative paths. The five query modules import `kirbyFetch` from `@/queries/kirbyFetch` instead of `./kirbyFetch`. Application behavior is unchanged — this is a pure relocation and import-path update, no logic changes.

## 4. Architecture Considerations

Using the `@/` alias instead of relative paths removes the depth-dependent relative path problem (`../` vs `../../` vs `../../../`) entirely, and insulates future moves of either the queries folder or the consuming route files from breaking imports. Since the alias is already declared in `jsconfig.json` and resolves to `next/`, no config change is needed — `@/queries/kirbyFetch` will resolve to `next/queries/kirbyFetch.js`.

Only the `queries` folder is moving; `next/styles/` retains all other contents untouched. This is a mechanical move plus find-and-replace of import specifiers, not a refactor of any query logic.

## 5. Data Flow

Unaffected by this change. Route files still call the same exported functions (`getAboutData`, `getGlobalData`, `getAllProjectSlugs`, `getShopData`, `getGalleryData`, `getProjectData`), which still internally call `kirbyFetch` to hit the Kirby CMS API and return data to the calling route/page component. Only the module resolution path changes, not the runtime data path.

## 6. Component Responsibilities

Not applicable — no React components are involved. This plan only touches module files and their import specifiers:

- `next/queries/kirbyFetch.js` — shared fetch wrapper responsible for calling the Kirby API and handling retry/error behavior (per the recent `kirbyFetch.js` changes and the new `global-error.js`). Not responsible for shaping page-specific query bodies.
- `next/queries/{about,gallery,layout,project,shop}Query.js` — each responsible for building and issuing the GraphQL/REST query body for its domain and returning parsed data. Not responsible for retry/error handling, which is delegated to `kirbyFetch`.

## 7. Files Affected

- `next/styles/queries/kirbyFetch.js` — moved to `next/queries/kirbyFetch.js`; stale header comment already matches new path, no content change needed beyond the move itself.
- `next/styles/queries/aboutQuery.js` — moved to `next/queries/aboutQuery.js`; internal `kirbyFetch` import updated to `@/queries/kirbyFetch`.
- `next/styles/queries/galleryQuery.js` — moved to `next/queries/galleryQuery.js`; internal `kirbyFetch` import updated.
- `next/styles/queries/layoutQuery.js` — moved to `next/queries/layoutQuery.js`; internal `kirbyFetch` import updated.
- `next/styles/queries/projectQuery.js` — moved to `next/queries/projectQuery.js`; internal `kirbyFetch` import updated.
- `next/styles/queries/shopQuery.js` — moved to `next/queries/shopQuery.js`; internal `kirbyFetch` import updated.
- `next/app/page.js` — import of `aboutQuery` updated from relative path to `@/queries/aboutQuery`.
- `next/app/layout.js` — import of `layoutQuery` updated to `@/queries/layoutQuery`.
- `next/app/sitemap.js` — import of `projectQuery` updated to `@/queries/projectQuery`.
- `next/app/shop/page.js` — import of `shopQuery` updated to `@/queries/shopQuery`.
- `next/app/gallery/page.js` — import of `galleryQuery` updated to `@/queries/galleryQuery`.
- `next/app/projects/[slug]/page.js` — import of `projectQuery` updated to `@/queries/projectQuery`.

No changes needed to `next/jsconfig.json` — the `@/*` alias already covers this.

## 8. Step-by-Step Implementation

1. **Create `next/queries/` and move the six files into it.** Use a file move (not copy+delete-manually) so git tracks it as a rename where possible, preserving history. After this step `next/styles/queries/` should no longer exist and `next/styles/` should contain only its original non-queries contents.

2. **Update internal imports inside the moved files.** In each of `aboutQuery.js`, `galleryQuery.js`, `layoutQuery.js`, `projectQuery.js`, `shopQuery.js`, change `import { kirbyFetch } from "./kirbyFetch";` to `import { kirbyFetch } from "@/queries/kirbyFetch";`. This is safe because `@/` resolves from `next/`, independent of the importing file's location, so it works identically whether the file stays flat in `next/queries/` or is later nested further.

3. **Update the six route-file imports.** In `next/app/page.js`, `next/app/layout.js`, `next/app/sitemap.js`, `next/app/shop/page.js`, `next/app/gallery/page.js`, and `next/app/projects/[slug]/page.js`, replace the relative `../.../styles/queries/<file>` import with `@/queries/<file>`. Match the existing named-import syntax exactly (e.g. `import { getAboutData } from "@/queries/aboutQuery";`) — only the path specifier changes.

4. **Search the repository for any remaining references to `styles/queries`** (including in comments, docs, or config) to confirm nothing was missed. The stale comment in `kirbyFetch.js` (`// next/queries/kirbyFetch.js`) does not need changing since it now matches the real path.

5. **Verify no other alias or bundler config needs updating.** Since `jsconfig.json` already maps `@/*` to `./*` relative to `next/`, and no `next.config.js` webpack alias overrides exist for `styles` or `queries` (confirm by checking `next/next.config.js` if present), no build configuration changes are expected.

Order matters only in that the move (step 1) must happen before the internal import updates (step 2) are meaningful, and both should be done before running the app to verify (step-by-step commits can bundle 1–3 together since they are mechanically linked).

## 9. Edge Cases

- **Case sensitivity on deploy**: Windows/local dev is case-insensitive for file paths, but the deploy environment (likely Linux-based, e.g. Vercel) is case-sensitive. Ensure the new folder is exactly `queries` (lowercase) and every updated import string matches that casing exactly.
- **Stale build cache**: Next.js `.next` build cache may hold references to the old module path. If a dev server is running during the move, restart it after the change to avoid stale module resolution errors.
- **Partial import update**: If any of the six consumer imports is missed, that route will throw a module-not-found error at build time — Next.js's build step will fail loudly rather than silently, so this is low-risk but worth double-checking with a full-project search in step 4.
- **`kirbyFetch.js` recent changes**: `kirbyFetch.js` was recently modified (retry logic, per git status) and a new `global-error.js` was added — this plan does not touch that logic, only its file location and how it is imported. Confirm the move doesn't conflict with any uncommitted changes to `kirbyFetch.js` before starting (check `git status`/`git diff` first).

## 10. Test Considerations

Manual verification: run the dev server and load each route that consumes a moved query — home (`/`), shop, gallery, a project detail page, and confirm `sitemap.xml` still generates — to confirm data loads and no console/build errors reference missing modules. Run a production build (`next build`) to catch any import resolution errors the dev server might not surface. No automated tests currently exist for these query modules based on the files reviewed; none are required for a pure path relocation, but if a build/typecheck script exists in `package.json`, run it as a final check.

## 11. Implementation Order

1. `next/queries/kirbyFetch.js` — new location for the shared fetch wrapper; moved first since every query module depends on it.
2. `next/queries/aboutQuery.js` — moved and internal import updated.
3. `next/queries/galleryQuery.js` — moved and internal import updated.
4. `next/queries/layoutQuery.js` — moved and internal import updated.
5. `next/queries/projectQuery.js` — moved and internal import updated.
6. `next/queries/shopQuery.js` — moved and internal import updated.
7. `next/app/page.js` — consumer import switched to `@/queries/aboutQuery`.
8. `next/app/layout.js` — consumer import switched to `@/queries/layoutQuery`.
9. `next/app/sitemap.js` — consumer import switched to `@/queries/projectQuery`.
10. `next/app/shop/page.js` — consumer import switched to `@/queries/shopQuery`.
11. `next/app/gallery/page.js` — consumer import switched to `@/queries/galleryQuery`.
12. `next/app/projects/[slug]/page.js` — consumer import switched to `@/queries/projectQuery`.
