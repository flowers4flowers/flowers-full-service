import classNames from 'classnames'
import DefImage from './DefImage'
import VideoPlayer from './VideoPlayer'
import { useInView } from 'framer-motion'
import { useRef } from 'react'

const MediaSection = ({ block, title }) => {
  const el = useRef(null)
  const isInView = useInView(el, {
    margin: '-50% 0px -50% 0px',
  })

  const containerClasses = classNames('media-section flex justify-center items-center flex-wrap lg:flex-nowrap', {
    show: isInView,
  })

  return (
    <section
      id={block.slug}
      ref={el}
      className={containerClasses}
    >
      {block.media.map((media, index) => {
        const classes = classNames('media-section-item', {
          'w-full lg:w-1/3': media.media.width <= media.media.height && !media.vimeoUrl && !media.videoMp4,
          'w-full lg:w-5/12': media.vimeoUrl || media.media.width > media.media.height || media.videoMp4,
        })

        if (media.videoMp4) {
          return (
            <VideoPlayer
              key={index}
              block={media}
              className={classes}
            />
          )
        }

        if (media.vimeoUrl) {
          return (
            <VideoPlayer
              key={index}
              block={media}
              className={classes}
            />
          )
        }

        return (
          <div
            key={index}
            className={classes}
          >
            <DefImage
              src={media.media.url}
              alt={media.media.alt}
              width={media.media.width}
              height={media.media.height}
              className="w-full"
            />

            {media.caption && (
              <p className="media-caption text-md lg:text-center text-base font-secondary mt-4 lg:mt-5">
                {media.caption}
              </p>
            )}
          </div>
        )
      })}
    </section>
  )
}

export default MediaSection
