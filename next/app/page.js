// next/app/page.js

import { getAboutData } from "../queries/aboutQuery";
import ProjectsList from "../components/ProjectsList";

export const metadata = {
  alternates: {
    canonical: "https://www.flowersfullservice.art",
  },
};

export default async function Home() {
  const data = await getAboutData();

  const { description } = data.aboutData.result || {};
  const { projects } = data.projectsData.result || {};
  const { clients } = data.clientsData.result || {};

  // group projects by client property
  const projectsByClient = projects.reduce((acc, project) => {
    const { client } = project;

    if (!acc.some((item) => item.client === client)) {
      acc.push({
        client,
        projects: [project],
      });
    } else {
      const index = acc.findIndex((item) => item.client === client);

      acc[index].projects.push(project);
    }

    return acc;
  }, []);

  // order projectsByClient array to be same as clients array
  const orderedProjectsByClient = clients.reduce((acc, client) => {
    const { name } = client;

    const index = projectsByClient.findIndex((item) => item.client === name);

    if (index > -1) {
      acc.push(projectsByClient[index]);
    }

    return acc;
  }, []);

  return (
    <div className="">
      {description && (
        <div
          className="font-primary text-[2.2rem] lg:text-[4.8rem] font-bold leading-[1.05] tracking-[-0.01em] rich-text rt-lg"
          dangerouslySetInnerHTML={{ __html: description }}
        ></div>
      )}

      <div className="h-[50px]"></div>

      {orderedProjectsByClient.length > 0 && (
        <ProjectsList projectsByClient={orderedProjectsByClient} />
      )}
    </div>
  );
}
