// next/app/(portal)/portal/[token]/unlock/route.js

import { NextResponse } from "next/server";
import { getDeckSecret } from "../../../../../queries/deckQuery";
import {
  DECK_SESSION_COOKIE,
  comparePassword,
  hashPassword,
  normalizeCompany,
  resolveViewerRole,
  signDeckToken,
  effectiveExpiry,
  buildSessionCookieOptions,
} from "../../../../../utility/deckSession";

export async function POST(request, { params }) {
  try {
    const body = await request.json().catch(() => null);
    const password = body?.password;
    const company = body?.company;

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

    const role = resolveViewerRole(company);
    const passwordOk = comparePassword(password, deck.password);

    if (!role && !passwordOk) {
      return NextResponse.json(
        { error: "missing_company_and_password", role },
        { status: 401 }
      );
    }

    if (!role) {
      return NextResponse.json(
        { error: "missing_company", role },
        { status: 401 }
      );
    }

    if (!passwordOk) {
      return NextResponse.json(
        { error: "incorrect_password", role },
        { status: 401 }
      );
    }

    const viewerCompany = normalizeCompany(company, role);
    const passwordHash = hashPassword(deck.password);
    const expiresAt = effectiveExpiry(deckExpiry);
    const token = await signDeckToken(
      params.token,
      passwordHash,
      role,
      viewerCompany,
      expiresAt
    );

    const res = NextResponse.json({ ok: true, role, company: viewerCompany });
    res.cookies.set(
      DECK_SESSION_COOKIE,
      token,
      buildSessionCookieOptions(expiresAt, role)
    );

    return res;
  } catch (error) {
    console.error("Deck unlock failed:", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
