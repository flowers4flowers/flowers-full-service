// next/utility/deckSession.js

import { createHash, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";

export const DECK_SESSION_COOKIE = "deck_session";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function getSecretKey() {
  const secret = process.env.PORTAL_SESSION_SECRET;

  if (!secret) {
    throw new Error("PORTAL_SESSION_SECRET is not set");
  }

  return new TextEncoder().encode(secret);
}

export function effectiveExpiry(deckExpiry) {
  const ninetyDaysOut = new Date(Date.now() + NINETY_DAYS_MS);

  if (deckExpiry && deckExpiry < ninetyDaysOut) {
    return deckExpiry;
  }

  return ninetyDaysOut;
}

export function resolveViewerRole(username) {
  if (typeof username !== "string") {
    return null;
  }

  const normalized = username.trim().toLowerCase();

  if (normalized === "client" || normalized === "admin") {
    return normalized;
  }

  return null;
}

export async function signDeckToken(deckId, passwordHash, role, expiresAt) {
  const exp = Math.floor(expiresAt.getTime() / 1000);

  return new SignJWT({ deckId, passwordHash, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(getSecretKey());
}

export function hashPassword(password) {
  if (typeof password !== "string") {
    return "";
  }

  return createHash("sha256").update(password.trim(), "utf8").digest("hex");
}

export async function verifyDeckToken(value) {
  if (!value) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(value, getSecretKey());
    return payload;
  } catch {
    return null;
  }
}

export function comparePassword(submitted, stored) {
  if (typeof submitted !== "string" || typeof stored !== "string") {
    return false;
  }

  const a = Buffer.from(submitted.trim(), "utf8");
  const b = Buffer.from(stored.trim(), "utf8");

  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

export function buildSessionCookieOptions(expiresAt, role) {
  const options = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/portal",
  };

  if (role !== "admin") {
    options.expires = expiresAt;
  }

  return options;
}
