// next/app/(portal)/portal/[token]/pdf-file/route.js

import { NextResponse } from "next/server";
import { resolveDeckAccess } from "../../../../../utility/deckAccess";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { status, meta } = await resolveDeckAccess(params.token);

  if (status !== "unlocked" || !meta?.pdfUrl) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const upstream = await fetch(meta.pdfUrl);

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
    },
  });
}
