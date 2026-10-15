// next/queries/kirbyFetch.js

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;
const REVALIDATE_SECONDS = 60;

// Last successful response per request body. Survives as long as the
// serverless instance is warm, and is used if the host blocks us.
const lastGood = new Map();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function kirbyFetch(body) {
  if (!process.env.API_HOST) {
    throw new Error("API_HOST environment variable is not set");
  }

  const key = JSON.stringify(body);
  let failure = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(process.env.API_HOST, {
        // Cached in Vercel's data cache so a blocked request is served
        // the last good response instead of breaking the page.
        next: { revalidate: REVALIDATE_SECONDS },
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${process.env.AUTH}`,
        },
        body: key,
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        failure = new Error(
          `Expected JSON from Kirby API but got "${contentType}" (status ${res.status}). ` +
            `Response started with: ${text.slice(0, 200)}`
        );
      } else if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        // Real API errors (4xx/5xx JSON) are not retried or masked.
        throw new Error(
          `Kirby API request failed (status ${res.status}): ${
            errorBody?.message || JSON.stringify(errorBody)
          }`
        );
      } else {
        const data = await res.json();
        lastGood.set(key, data);
        return data;
      }
    } catch (error) {
      if (!failure) throw error;
      failure = error;
    }

    if (attempt < MAX_ATTEMPTS) {
      await delay(RETRY_DELAY_MS);
    }
  }

  if (lastGood.has(key)) {
    console.warn(`Kirby API blocked, serving last good response. ${failure.message}`);
    return lastGood.get(key);
  }

  throw failure;
}
