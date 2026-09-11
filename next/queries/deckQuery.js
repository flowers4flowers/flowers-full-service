// next/queries/deckQuery.js
import { kirbyFetch } from "./kirbyFetch";

const DECK_PARENT_SLUG = "decks";

function sanitizeToken(token) {
  if (typeof token !== "string") {
    return null;
  }

  const cleaned = token.replace(/[^A-Za-z0-9]/g, "");

  return cleaned.length > 0 ? cleaned : null;
}

export async function getDeckForRender(token) {
  const id = sanitizeToken(token);

  if (!id) {
    return null;
  }

  const data = await kirbyFetch({
    query: `site.page("page://${id}")`,
    select: {
      title: true,
      client: "page.client.value",
      parentSlug: "page.parent.slug",
      intro: "page.intro.kirbytext",
      expiry: "page.expiry.toDate('Y-m-d')",
      figmaUrl: "page.figma_url.value",
      pdf: {
        query: "page.pdf.toFile",
        select: {
          url: true,
        },
      },
    },
  });

  const result = data?.result;

  if (!result || result.parentSlug !== DECK_PARENT_SLUG) {
    return null;
  }

  return {
    title: result.title || "",
    client: result.client || "",
    intro: result.intro || "",
    expiry: result.expiry || null,
    figmaUrl: result.figmaUrl || "",
    pdfUrl: result.pdf?.url || "",
  };
}

export async function getDeckSecret(token) {
  const id = sanitizeToken(token);

  if (!id) {
    return null;
  }

  const data = await kirbyFetch({
    query: `site.page("page://${id}")`,
    select: {
      password: "page.password.value",
      parentSlug: "page.parent.slug",
      expiry: "page.expiry.toDate('Y-m-d')",
    },
  });

  const result = data?.result;

  if (!result || result.parentSlug !== DECK_PARENT_SLUG) {
    return null;
  }

  return {
    password: result.password || "",
    expiry: result.expiry || null,
  };
}
