'use client'

import Link from "next/link"
import { useAppState } from "../context"
import DefImage from "../components/DefImage"
import { useRef, useState } from "react"
import classNames from "classnames"

const GalleryImage = ({ item, classes, index }) => {
  const { state, dispatch } = useAppState()
  const [showVideo, setShowVideo] = useState(false)
  const [hideImage, setHideImage] = useState(false)
  const hoverVideo = useRef(null)
  const [hoverTimeout, setHoverTimeout] = useState(null)

  let isLargeQuery = false

  if (typeof window !== 'undefined') {
    isLargeQuery = window.matchMedia('(min-width: 992px)').matches
  }

  // NEW: Function to track gallery image clicks
  const handleGalleryClick = () => {
    // Check if we're in browser and Amplitude is fully loaded
    if (typeof window !== 'undefined' && window.amplitude && window.amplitude.track) {
      try {
        window.amplitude.track('Project Clicked from /gallery', {
          source: 'gallery',
          image_index: index,
          image_url: item.image.url,
          image_alt: item.image.alt,
          image_width: item.image.width,
          image_height: item.image.height,
          has_video_preview: !!item.videoPreview,
          project_slug: item.project?.slug || null,
          item_slug: item.slug || null,
          destination_url: `/projects/${item.project.slug}${item.slug ? `#${item.slug}` : ''}`,
          timestamp: new Date().toISOString()
        })
        
        console.log('✅ Tracked gallery → project click:', item.project?.slug || 'unknown project')
      } catch (error) {
        console.log('⚠️ Amplitude tracking failed:', error)
      }
    } else {
      console.log('⏳ Amplitude not ready yet, skipping tracking')
    }

    // Keep the existing navigation behavior
    dispatch({
      type: 'SET_HIDE_NAV',
      payload: true
    })
  }

  const handleVideoEnter = () => {
    if (item.videoPreview && isLargeQuery) {
      if (!showVideo) {
        setShowVideo(true)
        setHideImage(true)
      } else {
        hoverTimeout && clearTimeout(hoverTimeout)
        setShowVideo(true)
        setHideImage(true)
      }
    }
  }

  const handleVideoLeave = () => {
    if (item.videoPreview && isLargeQuery) {
      setHideImage(false)
      setHoverTimeout(setTimeout(() => {
        setShowVideo(false)
      }, 400))
    }
  }

  if (!item.videoPreview) {
    return (
      <Link
        key={index}
        className={classes}
        href={`/projects/${item.project.slug}${item.slug ? `#${item.slug}` : ''}`}
        onClick={handleGalleryClick} // NEW: Add click tracking
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
      </Link>
    )
  }

  if (item.videoPreview) {
    const videoClasses = classNames(
      'video-gallery-image bg-white relative',
      {
        'show-video': hideImage,
      }
    )

    return (
      <Link
        key={index}
        className={classes}
        onMouseEnter={() => {
          handleVideoEnter()
        }}
        onMouseLeave={() => {
          handleVideoLeave()
        }}
        href={`/projects/${item.project.slug}${item.slug ? `#${item.slug}` : ''}`}
        onClick={handleGalleryClick} // NEW: Add click tracking
      >
        <div className={videoClasses}>
          {item.videoPreview && showVideo && (
            <div className="fill-parent">
              <video
                ref={hoverVideo}
                src={item.videoPreview.url}
                className="media-cover"
                autoPlay
                playsInline
                muted
                loop
                preload="auto"
              ></video>
            </div>
          )}
          
          <DefImage
            src={item.image.url}
            width={item.image.width}
            height={item.image.height}
            alt={item.image.alt}
            className="video-image w-full"
          />
        </div>
      </Link>
    )
  }
}

export default GalleryImage