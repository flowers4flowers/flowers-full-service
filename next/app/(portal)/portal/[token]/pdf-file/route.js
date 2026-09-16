// next/app/(portal)/portal/[token]/pdf-file/route.js

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DECK_SESSION_COOKIE, verifyDeckToken } from "../../../../../utility/deckSession";
import { getDeckForRender } from "../../../../../queries/deckQuery";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 5 * 60 * 1000;
const pdfUrlCache = new Map();

const BYTES_CACHE_TTL_MS = 30 * 60 * 1000;
const BYTES_CACHE_MAX_ENTRIES = 10;
const pdfBytesCache = new Map();

const BROWSER_CACHE_MAX_AGE_SECONDS = 1800;

async function getCachedPdfUrl(token) {
  const cached = pdfUrlCache.get(token);

  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.pdfUrl;
  }

  const meta = await getDeckForRender(token);

  if (!meta?.pdfUrl) {
    return null;
  }

  pdfUrlCache.set(token, { pdfUrl: meta.pdfUrl, cachedAt: Date.now() });

  return meta.pdfUrl;
}

export async function GET(request, { params }) {
  const cookieValue = cookies().get(DECK_SESSION_COOKIE)?.value;
  const payload = cookieValue ? await verifyDeckToken(cookieValue) : null;
  const unlocked = payload?.deckId === params.token;

  if (!unlocked) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const pdfUrl = await getCachedPdfUrl(params.token);

  if (!pdfUrl) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const cachedBytes = pdfBytesCache.get(params.token);

  if (cachedBytes && Date.now() - cachedBytes.cachedAt < BYTES_CACHE_TTL_MS) {
    return new NextResponse(cachedBytes.body, {
      status: 200,
      headers: cachedBytes.headers,
    });
  }

  const upstream = await fetch(pdfUrl, {
    signal: request.signal,
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }

  const headers = {
    "Content-Type": "application/pdf",
    "Cache-Control": `private, max-age=${BROWSER_CACHE_MAX_AGE_SECONDS}`,
  };

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) {
    headers["Content-Length"] = contentLength;
  }

  const [clientStream, cacheStream] = upstream.body.tee();

  (async () => {
    const reader = cacheStream.getReader();
    const chunks = [];

    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
    }

    const body = await new Blob(chunks).arrayBuffer();

    if (pdfBytesCache.size >= BYTES_CACHE_MAX_ENTRIES && !pdfBytesCache.has(params.token)) {
      const oldestKey = pdfBytesCache.keys().next().value;
      pdfBytesCache.delete(oldestKey);
    }

    pdfBytesCache.set(params.token, { body, headers, cachedAt: Date.now() });
  })();

  return new NextResponse(clientStream, {
    status: upstream.status,
    headers,
  });
}
