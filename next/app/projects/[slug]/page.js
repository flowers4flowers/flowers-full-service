// next/app/projects/[slug]/page.js

import { notFound } from "next/navigation";
import { getProjectData } from "@/queries/projectQuery";
import ProjectContent from "../../../components/ProjectContent";

export async function generateMetadata({ params }) {
  const { slug } = params;
  const data = await getProjectData(slug).catch(() => null);
  if (!data?.result) {
    return {};
  }
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

  const data = await getProjectData(slug).catch(() => null);

  if (!data?.result) {
    notFound();
  }

  return <ProjectContent data={data} />;
}
