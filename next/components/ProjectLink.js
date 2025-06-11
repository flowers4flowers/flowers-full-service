'use client'

import Link from "next/link"
import DefImage from "./DefImage"
import { useState, useRef } from "react"
import classNames from "classnames"

const ProjectLink = ({ project }) => {
  const [active, setActive] = useState(false)
  const [xValue, setXValue] = useState(0)
  const linkRef = useRef(null)
  let isLargeQuery = false

  if (typeof window !== 'undefined') {
    isLargeQuery = window.matchMedia('(min-width: 992px)').matches
  }

  const handleMouseEnter = () => {
    if (isLargeQuery) {
      setActive(true)
    }
  }

  const handleMouseLeave = () => {
    if (isLargeQuery) {
      setActive(false)
    }
  }

  const handleMouseMove = (e) => {
    if (isLargeQuery) {
      let bounds = linkRef.current.getBoundingClientRect()
      let x = e.clientX - bounds.left

      setXValue(x)
    }
  }

  // Function to track project clicks
  const handleProjectClick = () => {
    // Check if we're in browser and Amplitude is fully loaded
    if (typeof window !== 'undefined' && window.amplitude && window.amplitude.track) {
      try {
        window.amplitude.track('Project Clicked From /work', {
          project_title: project.title,
          project_slug: project.slug,
          project_client: project.client,
          project_start_date: project.startDate,
          project_end_date: project.endDate,
          project_location: project.location,
          timestamp: new Date().toISOString()
        })
        
        console.log('✅ Tracked project click:', project.title)
      } catch (error) {
        console.log('⚠️ Amplitude tracking failed:', error)
      }
    } else {
      console.log('⏳ Amplitude not ready yet, skipping tracking')
    }
  }

  const classes = classNames(
    'project-link grid grid-cols-4 lg:grid-cols-8 gap-4 lg:gap-6 relative',
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
      onClick={handleProjectClick} // NEW: Add the click tracking
      className={classes}
    >
      <p className="text-content col-span-1 lg:col-span-2 text-md lg:text-lg font-primary uppercase">{`${project.startDate}${project.endDate && project.endDate !== project.startDate ? `- ${project.endDate}` : ''}`}</p>

      <div className="text-content col-span-3 lg:col-span-6 mb-2 lg:mb-0">
        <p className="text-md lg:text-lg font-primary uppercase block lg:inline leading-[1.5]">{project.title}</p>
        {project.location && (
          <span className="hidden lg:inline text-md font-secondary ml-4">({project.location})</span>
        )}
      </div>

      {project.featuredImage && (
        <div
          className="project-hover-image absolute top-0 left-0 w-[220px] hidden lg:block"
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