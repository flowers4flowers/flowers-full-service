// next/components/ProjectLink.js

"use client";

import Link from "next/link";
import DefImage from "./DefImage";
import { useState, useRef } from "react";
import classNames from "classnames";
import { useAnalytics } from "../utility/useAnalytics";
import { useAppState } from "../context";

const ProjectLink = ({ project, activeSlug, onHover }) => {
  const active = activeSlug === project.slug;
  const [xValue, setXValue] = useState(0);
  const linkRef = useRef(null);
  const { trackLink } = useAnalytics();
  const { dispatch } = useAppState();
  let isLargeQuery = false;

  if (typeof window !== "undefined") {
    isLargeQuery = window.matchMedia("(min-width: 992px)").matches;
  }

  const handleMouseEnter = () => {
    if (isLargeQuery) {
      onHover(project.slug);
    }
  };

  const handleMouseMove = (e) => {
    if (isLargeQuery) {
      let bounds = linkRef.current.getBoundingClientRect();
      let x = e.clientX - bounds.left;

      setXValue(x);
    }
  };

  // Function to track project clicks
  const handleProjectClick = () => {
    trackLink(`Work List: ${project.title}`, `/projects/${project.slug}`, {
      project_slug: project.slug,
      project_title: project.title,
    });

    dispatch({
      type: "SET_BACK_NAVIGATION",
      payload: { origin: "home", scrollY: document.body.scrollTop },
    });
  };

  const classes = classNames(
    "project-link grid grid-cols-[6rem_1fr] lg:grid-cols-[9rem_1fr] gap-4 lg:gap-6 relative",
    {
      active: active,
    }
  );

  return (
    <Link
      href={`/projects/${project.slug}`}
      ref={linkRef}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onClick={handleProjectClick} // NEW: Add the click tracking
      className={classes}
    >
      <p className="listing-date">{`${
        project.startDate
      }${
        project.endDate && project.endDate !== project.startDate
          ? `- ${project.endDate}`
          : ""
      }`}</p>

      <div className="text-content mb-2 lg:mb-0">
        <p className="listing-heading block lg:inline">
          {project.title}
        </p>
        {project.location && (
          <span className="listing-location hidden lg:inline ml-4">
            ({project.location})
          </span>
        )}
      </div>

      {project.featuredImage && (
        <div
          className="project-hover-image absolute top-0 left-0 w-[220px] hidden lg:block"
          style={{
            transform: `translateX(${xValue - 220}px) translateY(-100%)`,
          }}
        >
          <DefImage
            src={project.featuredImage.url}
            alt={project.featuredImage.alt}
            width={project.featuredImage.width}
            height={project.featuredImage.height}
            className="w-full"
          />
        </div>
      )}
    </Link>
  );
};

export default ProjectLink;
