// next/app/(portal)/portal/[token]/session-status/route.js

import { NextResponse } from "next/server";
import { resolveDeckAccess } from "../../../../../utility/deckAccess";

export async function GET(request, { params }) {
  try {
    const { status } = await resolveDeckAccess(params.token);

    return NextResponse.json({ valid: status === "unlocked" });
  } catch (error) {
    console.error("Deck session status check failed:", error);
    return NextResponse.json({ valid: false });
  }
}
