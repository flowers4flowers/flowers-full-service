// next/app/work/page.js

import { getAboutData } from "../../queries/aboutQuery";
import ProjectLink from "../../components/ProjectLink";

export default async function Work() {
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

  const sortByDate = (a, b) => {
    const aDate = new Date(a.endDate ? a.endDate : a.startDate);
    const bDate = new Date(b.endDate ? b.endDate : b.startDate);

    return bDate - aDate;
  };

  return (
    <div className="pb-[30rem]">
      {description && (
        <div
          className="font-primary text-base lg:text-xxl leading-[1.2] rich-text rt-lg"
          dangerouslySetInnerHTML={{ __html: description }}
        ></div>
      )}

      {orderedProjectsByClient.length > 0 && (
        <div className="projects border-t border-black mt-28 lg:mt-40 pt-10 lg:pt-14">
          {orderedProjectsByClient.map((item, index) => {
            return (
              <div
                className="client-group grid grid-cols-6 lg:grid-cols-12 gap-4 lg:gap-6"
                key={index}
              >
                <h3 className="col-span-2 text-md lg:text-lg font-primary uppercase pr-4">
                  {item.client}
                </h3>

                <div className="col-span-4 lg:col-span-8">
                  {item.projects.sort(sortByDate).map((project) => {
                    return <ProjectLink project={project} key={project.slug} />;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
