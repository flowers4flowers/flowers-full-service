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

export async function getDeckPages(token) {
  const id = sanitizeToken(token);

  if (!id) {
    return [];
  }

  const data = await kirbyFetch({
    query: `site.page("page://${id}")`,
    select: {
      pages: {
        query: "page.children.listed",
        select: {
          layout: "page.layout.value",
          visual: {
            query: "page.visual.toFile",
            select: {
              url: true,
              width: true,
              height: true,
              alt: true,
            },
          },
          videoMp4: {
            query: "page.video_mp4.toFile",
            select: {
              url: true,
              mime: true,
              type: true,
            },
          },
          vimeoUrl: "page.vimeo_url",
          body: {
            query: "page.body.toBlocks",
            select: {
              type: true,
              html: "block.text.kirbytext",
              text: "block.text",
              level: "block.level",
            },
          },
        },
      },
    },
  });

  const rawPages = data?.result?.pages;

  if (!Array.isArray(rawPages)) {
    return [];
  }

  return rawPages.map((entry) => ({
    layout: entry.layout || "full-text",
    media: {
      media: entry.visual || null,
      videoMp4: entry.videoMp4 || null,
      vimeoUrl: entry.vimeoUrl || "",
      caption: "",
    },
    blocks: Array.isArray(entry.body) ? entry.body : [],
  }));
}
