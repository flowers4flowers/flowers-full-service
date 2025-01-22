'use client'

import React, { useRef, useState } from 'react'
import Vimeo from '@u-wave/react-vimeo'
import DefImage from './DefImage'
import classNames from 'classnames'
import { PlayButton } from './Icons'

const Video = React.forwardRef(({ block }, ref) => {
  if (block.videoMp4) {
    return (
      <video
        ref={ref}
        src={block.videoMp4.url}
        controls
        preload
        className="w-full video"
      ></video>
    )
  }

  if (block.vimeoUrl) {
    return (
      <Vimeo
        ref={ref}
        video={block.vimeoUrl}
        responsive={true}
        autoplay={false}
        controls={true}
        showTitle={false}
        showPortrait={false}
        showByline={false}
        className="video"
      />
    )
  }

  return null
})

Video.displayName = 'Video'

const VideoPlayer = ({ block, className }) => {
  const video = useRef(null)
  const [videoStarted, setVideoStarted] = useState(false)

  const playVideo = () => {
    setVideoStarted(true)

    if (block.videoMp4) {
      video.current.play()
    }

    if (block.vimeoUrl) {
      video.current.player.play()
    }
  }

  const videoClasses = classNames(className, 'video-container relative', {
    'video-started': videoStarted,
  })

  return (
    <div className={videoClasses}>
      <div className="relative w-full">
        <Video
          block={block}
          ref={video}
        />

        {block.media && (
          <button
            className="fill-parent flex justify-center items-center"
            onClick={playVideo}
          >
            <div className="fill-parent">
              <DefImage
                src={block.media.url}
                alt={block.media.alt}
                width={block.media.width}
                height={block.media.height}
                className="media-cover"
              />
            </div>

            <PlayButton />
          </button>
        )}
      </div>
    </div>
  )
}

VideoPlayer.displayName = 'VideoPlayer'

export default VideoPlayer
