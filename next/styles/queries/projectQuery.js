// next/queries/projectQuery.js
import { kirbyFetch } from "./kirbyFetch";

export async function getProjectData(slug) {
  return kirbyFetch({
    query: `page('Projects').children.find('${slug}')`,
    select: {
      title: true,
      slug: true,
      shortDescription: "page.short_description.kirbyText",
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
  });
}

export async function getAllProjectSlugs() {
  return kirbyFetch({
    query: `page('Projects').children.listed`,
    select: {
      slug: true,
    },
  });
}
