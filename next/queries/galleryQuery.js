// next/queries/galleryQuery.js

export async function getGalleryData() {
  const res = await fetch(process.env.API_HOST, {
    cache: "no-store",
    method: "POST",
    headers: {
      Authorization: `Basic ${process.env.AUTH}`,
    },
    body: JSON.stringify({
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
    }),
  });

  // Handle errors
  if (!res.ok) {
    throw new Error("Failed to fetch data");
  }

  return res.json();
}
