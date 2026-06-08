import { getAllProjectSlugs } from "../queries/projectQuery";

export default async function sitemap() {
  const staticRoutes = [
    {
      url: "https://www.flowersfullservice.art",
      lastModified: new Date(),
    },
    {
      url: "https://www.flowersfullservice.art/work",
      lastModified: new Date(),
    },
  ];

  try {
    const data = await getAllProjectSlugs();
    const projects = data.result;

    const projectRoutes = projects.map((project) => ({
      url: `https://www.flowersfullservice.art/projects/${project.slug}`,
      lastModified: new Date(),
    }));

    return [...staticRoutes, ...projectRoutes];
  } catch (error) {
    console.error("Sitemap: failed to fetch project slugs", error);
    return staticRoutes;
  }
}