import classNames from "classnames"
import DefImage from "./DefImage"
import VideoPlayer from "./VideoPlayer"
import { useInView } from "framer-motion"
import { useRef, useEffect } from "react"
import { useAppState } from "@/context"

const MediaSection = ({ block, title }) => {
  // const { state, dispatch } = useAppState()

  const el = useRef(null)
  const isInView = useInView(el, {
    margin: "-25% 0px -25% 0px"
  })

  // useEffect(() => {
  //   if (isInView) {
  //     const captions = block.media.map((media) => {
  //       return media.caption
  //     })

  //     dispatch({
  //       type: 'SET_CURRENT_PROJECT_CAPTIONS',
  //       payload: captions
  //     })
  //   } else {
  //     dispatch({
  //       type: 'SET_CURRENT_PROJECT_CAPTIONS',
  //       payload: []
  //     })
  //   }
  // }, [isInView])

  const containerClasses = classNames(
    'media-section flex justify-center items-center flex-wrap lg:flex-nowrap',
    {
      'show': isInView
    }
  )

  return (
    <section
      id={block.slug}
      ref={el}
      className={containerClasses}
    >
      {block.media.map((media, index) => {
        const classes = classNames(
          'media-section-item',
          {
            'w-full lg:w-1/3': media.media.width <= media.media.height && !media.vimeoUrl,
            'w-full lg:w-5/12': media.vimeoUrl || media.media.width > media.media.height,
          }
        )

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
          </div>
        )
      })}
    </section>
  )
}

export default MediaSection