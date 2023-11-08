'use client'

import { useRef, useState } from 'react'
import Vimeo from '@u-wave/react-vimeo'
import DefImage from './DefImage'
import classNames from 'classnames'
import { PlayButton } from './Icons'

const VideoPlayer = ({ block, className }) => {
  const video = useRef(null)
  const [videoStarted, setVideoStarted] = useState(false)
  const playVideo = () => {
    setVideoStarted(true)
    video.current.player.play()
  }

  const videoClasses = classNames(
    className,
    'video-container relative',
    {
      'video-started': videoStarted
    }
  )
    
  return (
    <div className={videoClasses}>
      <Vimeo
        ref={video}
        video={block.vimeoUrl}
        responsive={true}
        autoplay={false}
        controls={true}
        showTitle={false}
        showPortrait={false}
        showByline={false}
        className="video"
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
  )
}

export default VideoPlayer