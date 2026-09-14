// next/app/(portal)/portal/[token]/pdf-file/route.js

import { NextResponse } from "next/server";
import { resolveDeckAccess } from "../../../../../utility/deckAccess";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { status, meta } = await resolveDeckAccess(params.token);

  if (status !== "unlocked" || !meta?.pdfUrl) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const range = request.headers.get("range");

  const upstream = await fetch(meta.pdfUrl, {
    headers: range ? { Range: range } : {},
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
