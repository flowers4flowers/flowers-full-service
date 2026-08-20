// next/queries/kirbyFetch.js

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function kirbyFetch(body) {
  if (!process.env.API_HOST) {
    throw new Error("API_HOST environment variable is not set");
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(process.env.API_HOST, {
      cache: "no-store",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${process.env.AUTH}`,
      },
      body: JSON.stringify(body),
    });

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      if (attempt < MAX_ATTEMPTS) {
        await delay(RETRY_DELAY_MS);
        continue;
      }
      const text = await res.text();
      throw new Error(
        `Expected JSON from Kirby API but got "${contentType}" (status ${res.status}). ` +
          `Response started with: ${text.slice(0, 200)}`
      );
    }

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null);
      throw new Error(
        `Kirby API request failed (status ${res.status}): ${
          errorBody?.message || JSON.stringify(errorBody)
        }`
      );
    }

    return res.json();
  }
}
