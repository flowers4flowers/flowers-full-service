// next/queries/galleryQuery.js
import { kirbyFetch } from "./kirbyFetch";

export async function getGalleryData() {
  return kirbyFetch({
    query: `site.find('gallery')`,
    select: {
      mediaItems: {
        query: "page.media_items.toBlocks",
        select: {
          image: {
            query: "block.image.toFile",
            select: {
              url: true,
              width: true,
              height: true,
              alt: true,
            },
          },
          videoPreview: {
            query: "block.video_preview.toFile",
            select: {
              url: true,
              width: true,
              height: true,
              alt: true,
              mime: true,
              type: true,
            },
          },
          project: {
            query: "block.project.toPage",
            select: {
              slug: true,
            },
          },
          slug: "block.slug",
        },
      },
    },
  });
}
