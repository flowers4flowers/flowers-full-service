// next/queries/layoutQuery.js
import { kirbyFetch } from "./kirbyFetch";

export async function getGlobalData() {
  return kirbyFetch({
    query: "site",
    select: {
      socialLinks: {
        query: "site.social_links.toStructure",
        select: {
          title: true,
          link: true,
        },
      },
      screensaverImages: {
        query: "site.screensaver_images.toFiles",
        select: {
          url: true,
          width: true,
          height: true,
          alt: true,
        },
      },
    },
  });
}
