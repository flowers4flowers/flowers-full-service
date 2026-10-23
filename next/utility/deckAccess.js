// next/utility/deckAccess.js

import { cookies } from "next/headers";
import { getDeckForRender } from "../queries/deckQuery";
import {
  DECK_SESSION_COOKIE,
  hashPassword,
  verifyDeckToken,
} from "./deckSession";

export async function resolveDeckAccess(token) {
  const meta = await getDeckForRender(token);

  if (!meta) {
    return { status: "notfound", meta: null, role: null, company: null };
  }

  if (meta.expiry && new Date(meta.expiry) < new Date()) {
    return { status: "expired", meta, role: null, company: null };
  }

  const cookieValue = cookies().get(DECK_SESSION_COOKIE)?.value;
  const payload = cookieValue ? await verifyDeckToken(cookieValue) : null;
  const currentHash = meta.password ? hashPassword(meta.password) : null;
  const hasValidRole =
    payload?.role === "client" || payload?.role === "admin";
  const unlocked =
    payload?.deckId === token &&
    currentHash !== null &&
    payload?.passwordHash === currentHash &&
    hasValidRole;

  const company =
    typeof payload?.company === "string" && payload.company.length > 0
      ? payload.company
      : "not provided";

  return {
    status: unlocked ? "unlocked" : "locked",
    meta,
    role: unlocked ? payload.role : null,
    company: unlocked ? company : null,
  };
}
