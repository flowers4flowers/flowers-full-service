// next/queries/aboutQuery.js
import { kirbyFetch } from "./kirbyFetch";

export async function getAboutData() {
  const aboutData = await kirbyFetch({
    query: `site.find('about')`,
    select: {
      description: {
        query: "page.description.kirbyText",
      },
    },
  });

  const clientsData = await kirbyFetch({
    query: `site`,
    select: {
      clients: {
        query: "site.clients.toStructure",
        select: {
          name: true,
        },
      },
    },
  });

  const projectsData = await kirbyFetch({
    query: `page('Projects')`,
    select: {
      projects: {
        query: "page.children.listed",
        select: {
          title: true,
          slug: true,
          client: true,
          startDate: `page.start_date.toDate('Y')`,
          endDate: `page.end_date.toDate('Y')`,
          location: true,
          description: {
            query: "page.description.kirbyText",
          },
          featuredImage: {
            query: "page.featured_image.toFile",
            select: {
              url: true,
              width: true,
              height: true,
              alt: true,
            },
          },
        },
      },
    },
  });

  return {
    aboutData,
    projectsData,
    clientsData,
  };
}
