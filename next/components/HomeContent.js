'use client'

import { useAppState } from "@/context"
import classNames from "classnames"
import { useEffect, useRef } from "react"
import { Swiper, SwiperSlide } from 'swiper/react'
import 'swiper/css'
import DefImage from "./DefImage"
import Cookies from 'js-cookie'

const HomeContent = ({ description, carouselImages }) => {
  const { state, dispatch } = useAppState()
  const swiperRef = useRef(null)

  // classnames for the carousel container
  const classes = classNames(
    'fixed top-0 left-0 w-full h-full flex justify-center items-center',
    {
      'active': state.homeCarouselOpen
    }
  )

  const handleDescriptionClick = () => {
    if (carouselImages.length > 0) {
      dispatch({
        type: 'SET_HOME_CAROUSEL_OPEN',
        payload: true
      })
    }
  }

  const closeCarousel = () => {
    dispatch({
      type: 'SET_HOME_CAROUSEL_OPEN',
      payload: false
    })

    Cookies.set('flowers-home-carousel', 'true', { expires: 1 })
  }

  const handleCarouselMouseEnter = (className) => {
    dispatch({
      type: 'SET_HOME_CAROUSEL_SIDE',
      payload: className
    })
  }

  const handleCarouselMouseLeave = () => {
    dispatch({
      type: 'SET_HOME_CAROUSEL_SIDE',
      payload: null
    })
  }

  // after six seconds, open carousel
  useEffect(() => {
    // if carousel images exist, set carousel data
    if (carouselImages.length > 0) {
      dispatch({
        type: 'SET_HOME_CAROUSEL_DATA',
        payload: {
          total: carouselImages.length,
          currentIndex: 1
        }
      })
    }

    // set timer if cookie doesnt exist
    if (!Cookies.get('flowers-home-carousel') && carouselImages.length > 0) {
      setTimeout(() => {
        dispatch({
          type: 'SET_HOME_CAROUSEL_OPEN',
          payload: true
        })
      }, 1000)
    }
  }, [])

  return (
    <div>
      {description && (
        <div
          onClick={handleDescriptionClick}
          className="font-primary text-xxl leading-[1.2]"
          dangerouslySetInnerHTML={{ __html: description }}
        ></div>
      )}
      
      {carouselImages.length > 0 && (
        <div
          id="home-carousel"
          className={classes}
        >
          <button
            onClick={closeCarousel}
            onMouseEnter={() => {
              dispatch({
                type: 'SET_HOME_CAROUSEL_CLOSE',
                payload: true
              })
            }}
            className="closer fill-parent"
          ></button>

          <div
            className="carousel-container z-10 relative"
            onMouseLeave={handleCarouselMouseLeave}
            onMouseEnter={() => {
              dispatch({
                type: 'SET_HOME_CAROUSEL_CLOSE',
                payload: false
              })
            }}
          >
            <Swiper
              ref={swiperRef}
              spaceBetween={0}
              slidesPerView={1}
              loop={true}
              allowTouchMove={false}
              className="w-full h-full"
              onSlideChange={(swiper) => {
                dispatch({
                  type: 'SET_HOME_CAROUSEL_DATA',
                  payload: {
                    total: carouselImages.length,
                    currentIndex: swiper.realIndex + 1
                  }
                })
              }}
            >
              {carouselImages.map((image, index) => (
                <SwiperSlide key={index}>
                  <DefImage
                    src={image.url}
                    width={image.width}
                    height={image.height}
                    alt={image.alt}
                    className="media-contain"
                  />
                </SwiperSlide>
              ))}
            </Swiper>

            <div className="fill-parent flex z-10">
              <button
                onClick={() => swiperRef.current.swiper.slidePrev()}
                onMouseEnter={() => handleCarouselMouseEnter('left')}
                className="prev w-1/2 h-full"
              ></button>
              <button
                onClick={() => swiperRef.current.swiper.slideNext()}
                onMouseEnter={() => handleCarouselMouseEnter('right')}
                className="next w-1/2 h-full"
              ></button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HomeContent