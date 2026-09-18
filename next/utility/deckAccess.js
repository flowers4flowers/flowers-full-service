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
    return { status: "notfound", meta: null };
  }

  if (meta.expiry && new Date(meta.expiry) < new Date()) {
    return { status: "expired", meta };
  }

  const cookieValue = cookies().get(DECK_SESSION_COOKIE)?.value;
  const payload = cookieValue ? await verifyDeckToken(cookieValue) : null;
  const currentHash = meta.password ? hashPassword(meta.password) : null;
  const unlocked =
    payload?.deckId === token &&
    currentHash !== null &&
    payload?.passwordHash === currentHash;

  return { status: unlocked ? "unlocked" : "locked", meta };
}
