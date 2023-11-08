'use client'

import Link from "next/link"
import DefImage from "./DefImage"
import { useState, useRef } from "react"
import classNames from "classnames"

const ProjectLink = ({ project }) => {
  const [active, setActive] = useState(false)
  const [xValue, setXValue] = useState(0)
  const linkRef = useRef(null)

  const handleMouseEnter = () => {
    setActive(true)
  }

  const handleMouseLeave = () => {
    setActive(false)
  }

  const handleMouseMove = (e) => {
    let bounds = linkRef.current.getBoundingClientRect()
    let x = e.clientX - bounds.left

    setXValue(x)
  }

  const classes = classNames(
    'project-link grid grid-cols-8 gap-6 relative',
    {
      'active': active
    }
  )

  return (
    <Link
      href={`/projects/${project.slug}`}
      ref={linkRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      className={classes}
    >
      <p className="text-content col-span-2 text-lg font-primary uppercase">{project.date}</p>

      <div className="text-content col-span-6">
        <p className="text-lg font-primary uppercase inline">{project.title}</p>
        {project.location && (
          <span className="text-sm font-secondary ml-4">({project.location})</span>
        )}
      </div>

      {project.featuredImage && (
        <div
          className="project-hover-image absolute top-0 left-0 w-[220px]"
          style={{
            transform: `translateX(${xValue - 220}px) translateY(-100%)`
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
  )
}

export default ProjectLink