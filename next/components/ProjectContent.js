// next/components/ProjectContent.js

"use client";

import Link from "next/link";
import MediaItem from "../components/MediaItem";
import { useState, useEffect, useRef } from "react";
import { useAnalytics } from "../utility/useAnalytics";

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

  const { trackButton } = useAnalytics();

  const [isFullDescriptionOpen, setIsFullDescriptionOpen] = useState(false);
  const [isScrolledFromTop, setIsScrolledFromTop] = useState(false);
  const [isScrolledFromBottom, setIsScrolledFromBottom] = useState(false);

  const textColumnRef = useRef(null);

  const mediaItems = (mediaContent || []).flatMap((block, blockIndex) =>
    block.media.map((item, itemIndex) => ({
      ...item,
      key: `${blockIndex}-${itemIndex}`,
    }))
  );

  useEffect(() => {
    const textColumnEl = textColumnRef.current;

    if (!textColumnEl) return;

    const updateScrollFade = () => {
      const { scrollTop, scrollHeight, clientHeight } = textColumnEl;

      setIsScrolledFromTop(scrollTop > 1);
      setIsScrolledFromBottom(scrollTop + clientHeight < scrollHeight - 1);
    };

    updateScrollFade();

    textColumnEl.addEventListener("scroll", updateScrollFade);

    return () => textColumnEl.removeEventListener("scroll", updateScrollFade);
  }, []);

  return (
    <div className="pb-60 grid grid-cols-12 lg:gap-6">
      <div className="col-span-12 lg:col-span-8 lg:sticky lg:top-32 lg:self-start lg:flex lg:flex-col lg:h-[calc(100vh-10rem)]">
        <h1 className="text-xl font-primary project-title lg:flex-shrink-0">
          {title}
        </h1>

        <div
          ref={textColumnRef}
          className={`text-column-scroll overflow-y-auto pb-20 lg:flex-1 lg:min-h-0 ${
            isScrolledFromTop ? "fade-top" : ""
          } ${isScrolledFromBottom ? "fade-bottom" : ""}`}
        >
          <Link href="/" className="uppercase font-primary text-md lg:text-lg block mt-8">
            &larr; Back
          </Link>

          {shortDescription && (
            <div
              className="font-secondary text-md lg:text-lg rich-text rt-underline leading-[1.2] mt-8"
              dangerouslySetInnerHTML={{ __html: shortDescription }}
            ></div>
          )}

          {description && (
            <button
              className="uppercase font-primary font-bold text-md lg:text-lg mt-8"
              onClick={() => {
                const nextState = !isFullDescriptionOpen;
                setIsFullDescriptionOpen(nextState);
                trackButton(nextState ? "Read More" : "Read Less", {
                  project: title,
                });
              }}
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
      </div>

      <div className="col-span-12 lg:col-span-4 mt-16 lg:mt-0 mr-10">
        {mediaItems.map((item) => (
          <MediaItem key={item.key} media={item} />
        ))}
      </div>
    </div>
  );
};

export default ProjectContent;
