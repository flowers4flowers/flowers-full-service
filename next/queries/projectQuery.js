// next/queries/projectQuery.js

export async function getProjectData(slug) {
  const res = await fetch(process.env.API_HOST, {
    cache: "no-store",
    method: "POST",
    headers: {
      Authorization: `Basic ${process.env.AUTH}`,
    },
    body: JSON.stringify({
      query: `page('Projects').children.find('${slug}')`,
      select: {
        title: true,
        slug: true,
        description: "page.description.kirbyText",
        location: true,
        client: true,
        startDate: `page.start_date.toDate('Y')`,
        endDate: `page.end_date.toDate('Y')`,
        featuredImage: {
          query: "page.featured_image.toFile",
          select: {
            url: true,
            width: true,
            height: true,
            alt: true,
          },
        },
        mediaContent: {
          query: "page.media_content.toBlocks",
          select: {
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
    }),
  });

  // Handle errors
  if (!res.ok) {
    throw new Error("Failed to fetch data");
  }

  return res.json();
}

export async function getAllProjectSlugs() {
  const res = await fetch(process.env.API_HOST, {
    cache: "no-store",
    method: "POST",
    headers: {
      Authorization: `Basic ${process.env.AUTH}`,
    },
    body: JSON.stringify({
      query: `page('Projects').children.listed`,
      select: {
        slug: true,
      },
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch project slugs");
  }

  return res.json();
}