// next/components/ProjectContent.js

"use client";

import Link from "next/link";
import MediaItem from "../components/MediaItem";
import { useState } from "react";

const ProjectContent = ({ data }) => {
  const {
    title,
    shortDescription,
    description,
    location,
    client,
    startDate,
    endDate,
    mediaContent,
  } = data.result;

  const [isFullDescriptionOpen, setIsFullDescriptionOpen] = useState(false);

  const mediaItems = (mediaContent || []).flatMap((block, blockIndex) =>
    block.media.map((item, itemIndex) => ({
      ...item,
      key: `${blockIndex}-${itemIndex}`,
    }))
  );

  return (
    <div className="pb-60 grid grid-cols-12 lg:gap-6">
      <div className="col-span-12 lg:col-span-8">
        <Link href="/" className="uppercase font-primary text-md lg:text-lg block mb-8">
          &larr; Back
        </Link>

        <div className="text-md lg:text-lg font-primary">
          <p className="uppercase">{client}</p>

          <p className="uppercase">{`${startDate}${
            endDate && endDate !== startDate ? `- ${endDate}` : ""
          }`}</p>

          <div className="leading-[1.2] mt-8">
            <h1 className="uppercase font-bold">{title}</h1>
            <p>{location}</p>
          </div>
        </div>

        {shortDescription && (
          <div
            className="font-secondary text-md lg:text-lg rich-text rt-underline leading-[1.2] mt-8"
            dangerouslySetInnerHTML={{ __html: shortDescription }}
          ></div>
        )}

        {description && (
          <button
            className="uppercase font-primary text-md lg:text-lg mt-8"
            onClick={() => setIsFullDescriptionOpen(!isFullDescriptionOpen)}
          >
            {isFullDescriptionOpen ? "Read Less" : "Read More"}
          </button>
        )}

        {isFullDescriptionOpen && description && (
          <div
            className="font-secondary text-md lg:text-lg rich-text rt-underline leading-[1.2] mt-8"
            dangerouslySetInnerHTML={{ __html: description }}
          ></div>
        )}
      </div>

      <div className="col-span-12 lg:col-span-4 mt-16 lg:mt-0">
        {mediaItems.map((item) => (
          <MediaItem key={item.key} media={item} />
        ))}
      </div>
    </div>
  );
};

export default ProjectContent;
