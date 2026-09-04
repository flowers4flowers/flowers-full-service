// next/app/(portal)/portal/[token]/unlock/route.js

import { NextResponse } from "next/server";
import { getDeckSecret } from "../../../../../queries/deckQuery";
import {
  DECK_SESSION_COOKIE,
  comparePassword,
  signDeckToken,
  effectiveExpiry,
  buildSessionCookieOptions,
} from "../../../../../utility/deckSession";

export async function POST(request, { params }) {
  try {
    const body = await request.json().catch(() => null);
    const password = body?.password;

    if (typeof password !== "string" || password.length === 0) {
      return NextResponse.json({ error: "missing" }, { status: 400 });
    }

    const deck = await getDeckSecret(params.token);

    if (!deck) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const deckExpiry = deck.expiry ? new Date(deck.expiry) : null;

    if (deckExpiry && deckExpiry < new Date()) {
      return NextResponse.json({ error: "expired" }, { status: 410 });
    }

    if (!comparePassword(password, deck.password)) {
      return NextResponse.json({ error: "incorrect" }, { status: 401 });
    }

    const expiresAt = effectiveExpiry(deckExpiry);
    const token = await signDeckToken(params.token, expiresAt);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(
      DECK_SESSION_COOKIE,
      token,
      buildSessionCookieOptions(expiresAt)
    );

    return res;
  } catch {
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
