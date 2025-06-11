'use client'

import DefImage from "../components/DefImage"
import classNames from "classnames"
import GalleryImage from "./GalleryImage"

const GalleryContent = ({ mediaItems }) => {
  let isLargeQuery = false

  if (typeof window !== 'undefined') { 
    isLargeQuery = window.matchMedia('(min-width: 992px)').matches
  }

  if (mediaItems.length > 0) {
    return (
      <div className="flex justify-center items-start flex-wrap pb-60">
        {mediaItems.map((item, index) => { 
          const classes = classNames(
            'gallery-item',
            {
              'w-1/2 lg:w-1/4': item.image.width <= item.image.height,
              'w-1/2 lg:w-1/3': item.image.width > item.image.height
            }
          )
            
          if (item.project) {
            return (
              <GalleryImage
                key={index}
                item={item}
                classes={classes}
                index={index}
              />
            )
          }
          
          return (
            <div
              key={index}
              className={classes}
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