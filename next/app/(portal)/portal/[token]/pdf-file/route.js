// next/app/(portal)/portal/[token]/pdf-file/route.js

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DECK_SESSION_COOKIE, verifyDeckToken } from "../../../../../utility/deckSession";
import { getDeckForRender } from "../../../../../queries/deckQuery";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 5 * 60 * 1000;
const pdfUrlCache = new Map();

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

  const range = request.headers.get("range");

  console.log("Upstream PDF URL:", pdfUrl);
  console.log("Range header:", range);
  console.log("Request signal:", request.signal);
  console.log("Request method:", request.method);

  const upstream = await fetch(pdfUrl, {
    headers: range ? { Range: range } : {},
    signal: request.signal,
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }

  const headers = {
    "Content-Type": "application/pdf",
    "Accept-Ranges": "bytes",
  };

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) {
    headers["Content-Length"] = contentLength;
  }

  const contentRange = upstream.headers.get("content-range");
  if (contentRange) {
    headers["Content-Range"] = contentRange;
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}
