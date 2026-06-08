// next/app/projects/[slug]/page.js

import { getProjectData } from "../../../queries/projectQuery";
import ProjectContent from "../../../components/ProjectContent";

export async function generateMetadata({ params }) {
  const { slug } = params;
  const data = await getProjectData(slug);
  const { title, client, location, featuredImage } = data.result;

  return {
    title: `${title} · ${client} · FLOWERS`,
    description: `${title}${location ? ` in ${location}` : ""}. Commercial photography and creative direction by FLOWERS studio, NYC.`,
    alternates: {
      canonical: `https://www.flowersfullservice.art/projects/${slug}`,
    },
    openGraph: {
      title: `${title} · ${client} · FLOWERS`,
      ...(featuredImage && {
        images: [
          {
            url: featuredImage.url,
            width: featuredImage.width,
            height: featuredImage.height,
            alt: featuredImage.alt,
          },
        ],
      }),
    },
  };
}

export default async function Project({ params }) {
  const { slug } = params;

  const data = await getProjectData(slug);

  return <ProjectContent data={data} />;
}
