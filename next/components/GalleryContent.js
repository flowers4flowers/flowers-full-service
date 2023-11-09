'use client'

import DefImage from "@/components/DefImage"
import classNames from "classnames"
import GalleryImage from "./GalleryImage"
import { useState } from "react"

const GalleryContent = ({ mediaItems }) => {
  const [currentHovered, setCurrentHovered] = useState(null)
  let isLargeQuery = false

  if (typeof window !== 'undefined') {
    isLargeQuery = window.matchMedia('(min-width: 992px)').matches
  }

  const handleMouseEnter = (index) => {
    if (isLargeQuery) {
      setCurrentHovered(index)
    }
  }

  const handleMouseLeave = () => {
    if (isLargeQuery) {
      setCurrentHovered(null)
    }
  }

  if (mediaItems.length > 0) {
    return (
      <div className="flex justify-center items-start flex-wrap pb-60">
        {mediaItems.map((item, index) => { 
          const classes = classNames(
            'gallery-item',
            {
              'w-1/2 lg:w-1/4': item.image.width <= item.image.height,
              'w-1/2 lg:w-1/3': item.image.width > item.image.height,
              'inactive': currentHovered !== null && index !== currentHovered,
            }
          )
            
          if (item.project) {
            return (
              <GalleryImage
                key={index}
                item={item}
                classes={classes}
                index={index}
                handleMouseEnter={handleMouseEnter}
                handleMouseLeave={handleMouseLeave}
              />
            )
          }
          
          return (
            <div
              key={index}
              className={classes}
              onMouseEnter={() => handleMouseEnter(index)}
              onMouseLeave={handleMouseLeave}
            >
              <div className="bg-white">
                <DefImage
                  src={item.image.url}
                  width={item.image.width}
                  height={item.image.height}
                  alt={item.image.alt}
                  className="w-full"
                />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return null
}

export default GalleryContent