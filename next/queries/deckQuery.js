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
      layout: "page.layout.value",
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
    layout: result.layout || "editorial",
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

export async function getDeckContent(token) {
  const id = sanitizeToken(token);

  if (!id) {
    return { intro: "", blocks: [] };
  }

  const data = await kirbyFetch({
    query: `site.page("page://${id}")`,
    select: {
      intro: "page.intro.kirbytext",
      body: {
        query: "page.body.toBlocks",
        select: {
          type: true,
          html: "block.text.kirbytext",
          text: "block.text",
          level: "block.level",
          slug: true,
          media: {
            query: "block.media.toBlocks",
            select: {
              vimeoUrl: "block.vimeo_url",
              caption: "block.caption",
              videoMp4: {
                query: "block.video_mp4.toFile",
                select: {
                  url: true,
                  mime: true,
                  type: true,
                },
              },
              media: {
                query: "block.media.toFile",
                select: {
                  url: true,
                  width: true,
                  height: true,
                  alt: true,
                  mime: true,
                  type: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const result = data?.result || {};

  return {
    intro: result.intro || "",
    blocks: Array.isArray(result.body) ? result.body : [],
  };
}
