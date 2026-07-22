// next/queries/homeQuery.js
import { kirbyFetch } from "./kirbyFetch";

export async function getHomeData() {
  return kirbyFetch({
    query: `site.find('home')`,
    select: {
      description: {
        query: "page.description.kirbyText",
      },
      carouselImages: {
        query: "page.carousel_images.toFiles",
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
