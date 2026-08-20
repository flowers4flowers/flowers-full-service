# kirbyFetch Retry Logic + Global Error Fallback

## 1. Goal

The site intermittently returns a 500 error and crashes for visitors when the Kirby API host (`admin.flowersfullservice.art`, hosted on SiteGround) is fronted by SiteGround's Antibot AI system. That system occasionally classifies the server-to-server API request from Vercel as bot traffic and, instead of passing the request through to Kirby, responds with HTTP 202 and an HTML CAPTCHA challenge page instead of the expected JSON. Since the request originates from a Next.js server function (not a browser), it cannot solve the CAPTCHA, so `kirbyFetch` correctly detects the mismatched content-type and throws — but that throw currently propagates all the way up through the root layout and crashes the entire site with Next.js's default, unstyled error screen.

This change does two things:
1. Gives transient CAPTCHA challenges a chance to resolve on their own by retrying the request a few times before giving up.
2. Replaces the default crash screen with a friendly, self-contained fallback page when the retries are exhausted (or any other root-layout error occurs), so visitors see a clear message instead of a broken page.

This is a mitigation, not a fix — the underlying cause is a SiteGround-side Antibot AI configuration issue that is being pursued separately with SiteGround support.

## 2. Current System Behaviour

`kirbyFetch` (`next/styles/queries/kirbyFetch.js`) makes a single POST request to `process.env.API_HOST` with Basic Auth credentials. It inspects the response's `content-type` header:

- If the content-type does not include `application/json`, it reads the response body as text and throws an `Error` describing the unexpected content-type, status, and the first 200 characters of the body.
- If the content-type is JSON but `res.ok` is false, it attempts to parse a JSON error body and throws a different `Error` describing the failed request.
- Otherwise it returns the parsed JSON.

This function is called from five query files (`layoutQuery.js`, `projectQuery.js`, `shopQuery.js`, `aboutQuery.js`, `galleryQuery.js`). Critically, `layoutQuery.js`'s `getGlobalData()` is called directly inside `RootLayout` in `next/app/layout.js`, before any HTML is rendered.

There is currently no `error.js` or `global-error.js` file anywhere under `next/app/`. Because the failing call happens inside the root layout itself (which is responsible for rendering the outermost `<html>` and `<body>` tags), a conventional route-level `error.js` boundary cannot catch it — Next.js does not allow an error boundary to wrap the root layout it is nested inside. When `getGlobalData()` throws, Next.js falls back to its built-in, unstyled default error page, and the request that triggered it (as seen in the reported incident) surfaces as a 500 response.

## 3. Desired Behaviour

When `kirbyFetch` receives a non-JSON response (the CAPTCHA HTML page), it should not fail immediately. Instead it should wait 2 seconds and retry the same request, up to a maximum of 3 total attempts. If any attempt returns a JSON content-type, that attempt's result is used (subject to the existing `res.ok` check) and no further retries occur. If all 3 attempts return non-JSON content, the function throws the existing descriptive error, unchanged in wording.

Errors that are not content-type mismatches (i.e. `!res.ok` on a JSON response, or a thrown network error from `fetch` itself) are not retried — they fail on the first occurrence, exactly as today.

If an error still propagates out of `getGlobalData()` inside `RootLayout` (either because retries were exhausted, or because of an unrelated error), a new `app/global-error.js` boundary catches it and renders a minimal, self-contained fallback page: a friendly message explaining the site is temporarily having trouble loading, and a "Retry" button that calls Next's provided `reset()` function to attempt re-rendering. This fallback page does not depend on `global.css`, custom fonts, or any other app-level styling or components — it defines its own inline-styled `<html>` and `<body>`, so it can render correctly even if the failure is related to broader app/resource issues.

## 4. Architecture Considerations

**Retry logic lives inside `kirbyFetch.js`, not in individual query files.** All five query files funnel through this single function, so centralizing the retry there means every caller — most importantly `getGlobalData()` in the root layout — benefits automatically without duplicating logic five times. This matches the existing pattern where `kirbyFetch.js` is already the single place that owns request/response handling and error formatting.

**Retry only on content-type mismatch, not on `!res.ok`.** A non-JSON response is specifically the signature of the Antibot AI intercepting the request before it reaches Kirby — a transient, infrastructure-level condition that may clear up within seconds. A `!res.ok` JSON error response, by contrast, means the request did reach Kirby and Kirby itself rejected it (e.g. bad query, auth failure) — retrying that would not change the outcome and would only slow down a genuine error's surfacing.

**`global-error.js` instead of a scoped `error.js`.** Next.js's App Router documentation is explicit that `global-error.js` is the only boundary that can catch errors thrown by the root layout, precisely because the root layout owns the `<html>`/`<body>` tags that a normal nested `error.js` would otherwise need to render inside of. `global-error.js` must therefore define its own complete `<html>` and `<body>`, replacing the entire page — this is a Next.js constraint, not a design choice.

**Minimal inline styles, no shared CSS/component dependency.** Since `global-error.js` exists specifically to handle the case where the root layout (and everything it depends on) failed, it deliberately avoids importing `global.css`, fonts, or any component from the app tree. This keeps the fallback page's own rendering independent of whatever caused the original failure.

**Retry delay is a blocking, in-request wait.** Because this is server-side rendering (the root layout runs on the server), the 2-second delays extend the server response time for that request rather than blocking a browser UI thread. Worst case (all 3 attempts fail) adds approximately 4 seconds (2 delays) to the time before the error boundary is shown. This is an accepted trade-off per your confirmation — the alternative (no delay, or shorter delay) risks retrying before the transient block has cleared.

## 5. Data Flow

A page request arrives at the Next.js server. `RootLayout` executes and calls `getGlobalData()`, which calls `kirbyFetch()` with a query body. `kirbyFetch` sends a POST request to `API_HOST`. The response's `content-type` header is inspected:

- JSON content-type, `res.ok` true → parsed JSON is returned up through `getGlobalData()` to `RootLayout`, which destructures `socialLinks` and `screensaverImages` and renders normally.
- JSON content-type, `res.ok` false → an `Error` is thrown immediately, propagating up through `getGlobalData()` and `RootLayout`.
- Non-JSON content-type (CAPTCHA HTML) → `kirbyFetch` waits 2 seconds and repeats the request, up to 3 total attempts. If a later attempt succeeds (JSON content-type), that result flows onward as in the success case above. If all 3 attempts remain non-JSON, an `Error` is thrown.

Any error thrown out of `RootLayout` (from either path above, or any other synchronous/async failure in that component) is caught by `global-error.js`, which receives the error object and a `reset` callback as props (per Next.js's error boundary convention) and renders the fallback UI in place of the entire page. Clicking "Retry" invokes `reset()`, which causes Next.js to attempt to re-render the root layout (and therefore re-run `getGlobalData()` and the retry sequence) from scratch.

## 6. Component Responsibilities

### `kirbyFetch` (function, `next/styles/queries/kirbyFetch.js`)

**Responsible for:**
- Sending the POST request to `API_HOST` with the required headers and body.
- Detecting a non-JSON response and retrying it up to the configured attempt limit, with a fixed delay between attempts.
- Detecting a JSON error response (`!res.ok`) and throwing without retrying.
- Returning the parsed JSON on success.

**Not responsible for:**
- Deciding what happens after the error is thrown (that is the caller's / error boundary's concern).
- Any UI rendering or fallback content.
- Distinguishing *why* a response is non-JSON (e.g. it does not attempt to detect specifically that the body is a CAPTCHA page — any non-JSON content-type is treated the same way).

**Props:** Not a component; takes one parameter, `body` (object) — the query payload forwarded to Kirby.

**Internal state:** None persisted across calls; a local attempt counter exists only for the duration of a single `kirbyFetch` invocation.

### `GlobalError` (default export, new file `next/app/global-error.js`)

**Responsible for:**
- Rendering a complete, self-contained `<html>`/`<body>` fallback page when an error escapes the root layout.
- Displaying a friendly, non-technical message to the visitor.
- Providing a "Retry" button that calls the `reset` function passed in by Next.js.

**Not responsible for:**
- Logging or reporting the error (out of scope per this plan).
- Matching the site's visual branding, fonts, or theme — it is intentionally minimal and self-contained.
- Distinguishing between different error types (Kirby fetch failure vs. any other root layout error) — it renders the same fallback regardless of cause.

**Props (per Next.js convention for this special file):**
- `error` (Error object, required) — the error that was thrown; not displayed to the visitor but available if future logging is added.
- `reset` (function, required) — provided by Next.js; re-attempts rendering of the segment that errored when called.

**Internal state:** None.

## 7. Files Affected

- `next/styles/queries/kirbyFetch.js` — add retry loop around the existing fetch/content-type-check logic.
- `next/app/global-error.js` — new file; root-level error boundary with fallback UI.

No other files require changes. The four other query files (`projectQuery.js`, `shopQuery.js`, `aboutQuery.js`, `galleryQuery.js`) automatically inherit the retry behavior because they call the same `kirbyFetch` function, and require no direct edits.

## 8. Step-by-Step Implementation

**Step 1 — Add retry constants and a delay helper to `kirbyFetch.js`.**
At the top of the file (after the existing comment header, before the function), define two named constants: a maximum attempt count of 3, and a retry delay of 2000 milliseconds. Add a small local helper function that returns a Promise resolving after a given number of milliseconds, used to implement the delay without blocking the event loop. This keeps the magic numbers named and in one place, matching the existing plain, dependency-free style of the file.

**Step 2 — Wrap the fetch/content-type-check block in a retry loop.**
Change the body of `kirbyFetch` so the existing `fetch` call and content-type check run inside a loop that iterates from 1 up to the maximum attempt count. On each iteration:
- Perform the `fetch` exactly as today.
- Inspect `content-type` exactly as today.
- If content-type is not JSON: if this was not the final attempt, wait for the retry delay (using the helper from Step 1) and continue to the next loop iteration; if it was the final attempt, throw the existing descriptive error (unchanged message format).
- If content-type is JSON: break out of the retry loop and proceed to the existing `res.ok` check and return, exactly as today, without further retries. A `!res.ok` result throws immediately as it does now.

Gotcha: the `res.text()` call used to build the error message must only be invoked on the response that is ultimately going to be reported (or on each failed attempt, if you want the error message to reflect the last attempt) — do not call `.text()` and then also attempt to reuse that response elsewhere, since a response body can only be read once. Since each loop iteration creates a fresh `fetch` response, this is naturally satisfied as long as `.text()` is only read within that same iteration's branch.

Gotcha: ensure the loop does not silently fall through without returning or throwing on every path — every iteration must either `continue` (with a delay), `throw`, or proceed to `return res.json()`.

**Step 3 — Verify no other behavior in `kirbyFetch.js` changes.**
The `API_HOST` environment variable check at the top of the function, the request headers, the request body serialization, and the `!res.ok` handling all remain exactly as they are today, just now living inside (or immediately after) the retry loop rather than in a single linear sequence.

**Step 4 — Create `next/app/global-error.js`.**
This file must be a Client Component (Next.js requires `global-error.js` to include the `"use client"` directive, since it needs to handle the interactive Retry button and receive `reset` as a prop). It must default-export a function component accepting `{ error, reset }` as props, and it must render a complete `<html>` and `<body>` — Next.js does not automatically supply these for this special file the way it does for a normal `error.js`.

Inside `<body>`, render a centered message container using inline `style` objects only (no imported CSS, no className referencing `global.css`), containing: a heading stating something went wrong loading the page, a short supporting sentence telling the visitor this is usually temporary, and a button labeled "Retry" whose `onClick` calls `reset()`.

Gotcha: because this file replaces the entire document (including everything normally provided by `app/layout.js`, such as fonts, analytics scripts, and metadata), none of that is available here — this is expected and intentional per the architecture decision in Section 4.

Gotcha: `global-error.js` only activates in production builds by default for uncaught errors at the root; during local development Next.js may show its dev-mode error overlay instead. This should be verified using a production build (see Section 10) rather than `next dev`, to confirm the fallback renders as expected.

**Step 5 — Confirm ordering has no interdependency.**
Steps 1–3 (kirbyFetch changes) and Step 4 (global-error.js) are independent of each other and could be implemented in either order; they are sequenced here for narrative clarity, not because one depends on the other. Both should be completed before testing, since testing the retry-exhaustion path also exercises the new fallback page.

## 9. Edge Cases

- **All 3 attempts return non-JSON (Antibot AI persists across the full retry window):** `kirbyFetch` throws its existing descriptive error after ~4 seconds of added delay; `global-error.js` catches this at the root layout and shows the fallback page with a Retry button.
- **First attempt fails (non-JSON), second attempt succeeds:** the function returns the successful JSON result with no error surfaced anywhere; total added latency is 2 seconds for that request.
- **Response is JSON but represents a genuine Kirby-side error (`!res.ok`):** no retry occurs; the existing error is thrown on the first attempt, exactly as today, and `global-error.js` catches it the same way as any other root layout error (same fallback UI, since the boundary does not distinguish error causes).
- **Visitor clicks Retry on the fallback page while the Antibot AI is still active:** `reset()` re-runs the root layout, which re-runs the full retry sequence again; if still blocked, the fallback page reappears. This is expected behavior — no infinite loop protection is needed since `reset()` only fires on explicit user action, not automatically.
- **A non-root page (not the layout) calls one of the other four query functions and exhausts its retries:** that error propagates according to whatever error handling exists on that specific route today (unchanged by this plan) — this plan does not add scoped `error.js` boundaries for other routes, only the global one required for the root layout.
- **`fetch` itself throws (e.g. network failure, DNS failure) rather than returning a response:** this is not a content-type mismatch and is not caught by the retry condition as scoped in this plan; it propagates immediately on the first attempt, consistent with how `!res.ok` errors are treated (only content-type-mismatch responses are retried).

## 10. Test Considerations

**Manual verification:**
- Temporarily point `API_HOST` (in a local `.env`) at an endpoint known to return HTML with a non-JSON content-type, and confirm `kirbyFetch` waits and retries the expected number of times (observable via added console logging during testing only, not left in the final code, or by timing the request) before throwing.
- Run a production build (`next build` + `next start`) rather than `next dev`, then force the root layout's `getGlobalData()` call to fail (e.g. by pointing `API_HOST` at an invalid or CAPTCHA-returning endpoint) and confirm `global-error.js` renders instead of Next's default crash page.
- Click the Retry button on the rendered fallback page and confirm it attempts to reload the layout (visible via a fresh network request in dev tools).
- Confirm that a normal, healthy `API_HOST` response still renders the site exactly as before, with no visible delay or behavior change on the success path.
- Confirm a genuine `!res.ok` JSON error (e.g. temporarily misconfigure the `AUTH` credential to trigger an authentication failure) still fails immediately without a 2-second delay, and still routes to `global-error.js` if thrown from the root layout.

**Automated tests:** this codebase does not appear to have an existing test suite for the query layer (no test files found alongside `kirbyFetch.js` during file analysis); adding one is out of scope for this plan unless you want it added as a follow-up.

## 11. Implementation Order

1. `next/styles/queries/kirbyFetch.js` — existing file, modified to add the retry loop, constants, and delay helper around the current fetch/content-type logic; done first since it is self-contained and independently testable.
2. `next/app/global-error.js` — new file, added second; depends conceptually on Step 1 being in place so that the retry-exhaustion path can be exercised end-to-end during testing, though the two files do not share code.
