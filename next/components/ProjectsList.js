// next/components/ProjectsList.js

"use client";

import { useState } from "react";
import ProjectLink from "./ProjectLink";

const sortByDate = (a, b) => {
  const aDate = new Date(a.endDate ? a.endDate : a.startDate);
  const bDate = new Date(b.endDate ? b.endDate : b.startDate);

  return bDate - aDate;
};

const ProjectsList = ({ projectsByClient }) => {
  const [activeSlug, setActiveSlug] = useState(null);

  const handleHover = (slug) => {
    setActiveSlug(slug);
  };

  return (
    <div
      className="projects border-t border-black dark:border-cream mt-28 lg:mt-40 pt-10 lg:pt-14 w-full mx-auto"
      onMouseLeave={() => handleHover(null)}
    >
      {projectsByClient.map((item, index) => {
        return (
          <div
            className="client-group grid grid-cols-[10rem_1fr] lg:grid-cols-[35rem_1fr] gap-4 lg:gap-6 mb-8 lg:mb-14"
            key={index}
          >
            <h3
              className="font-primary uppercase pr-4"
              style={{
                fontWeight: 400,
                fontSize: "20px",
                lineHeight: "120%",
                letterSpacing: "0%",
              }}
            >
              {item.client}
            </h3>

            <div className="space-y-4 lg:space-y-6">
              {item.projects.sort(sortByDate).map((project) => {
                return (
                  <ProjectLink
                    project={project}
                    activeSlug={activeSlug}
                    onHover={handleHover}
                    key={project.slug}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProjectsList;
