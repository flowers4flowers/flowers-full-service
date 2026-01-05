// next/components/ProjectContent.js

"use client";

import MediaSection from "../components/MediaSection";
import { useAppState } from "../context";
import { useEffect } from "react";

const ProjectContent = ({ data }) => {
  const { state, dispatch } = useAppState();
  const {
    title,
    description,
    location,
    client,
    startDate,
    endDate,
    mediaContent,
  } = data.result;

  console.log(data.result);
  console.log(mediaContent);
  console.log(title);

  useEffect(() => {
    dispatch({
      type: "SET_CURRENT_PROJECT_TITLE",
      payload: title,
    });
  }, [dispatch, title]); // Added missing dependencies

  return (
    <div className="pb-60">
      <section>
        <div className="grid grid-cols-12 lg:gap-6 text-md lg:text-lg font-primary">
          <p className="col-span-12 lg:col-span-2 uppercase">{client}</p>

          <p className="col-span-12 lg:col-span-2 uppercase">{`${startDate}${
            endDate && endDate !== startDate ? `- ${endDate}` : ""
          }`}</p>

          <div className="col-span-12 lg:col-span-6 leading-[1.2] mt-8 lg:mt-0">
            <h1 className="uppercase">{title}</h1>
            <p>{location}</p>
          </div>
        </div>

        {description && (
          <div className="grid grid-cols-12 gap-6 mt-8">
            <div
              className="col-span-12 lg:col-span-5 lg:col-start-5 font-secondary text-md lg:text-lg rich-text rt-underline leading-[1.2]"
              dangerouslySetInnerHTML={{ __html: description }}
            ></div>
          </div>
        )}
      </section>

      {mediaContent.map((block, index) => {
        return <MediaSection key={index} block={block} title={title} />;
      })}
    </div>
  );
};

export default ProjectContent;
