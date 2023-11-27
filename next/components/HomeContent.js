'use client'

import { useAppState } from "@/context"
import classNames from "classnames"
import { useEffect, useRef, useState } from "react"
import { Swiper, SwiperSlide } from 'swiper/react'
import 'swiper/css'
import DefImage from "./DefImage"

const HomeContent = ({ description, carouselImages }) => {
  const { state, dispatch } = useAppState()
  const swiperRef = useRef(null)
  const [transitioning, setTransitioning] = useState(false)

  // classnames for the carousel container
  const classes = classNames(
    'relative lg:fixed lg:top-0 lg:left-0 w-full lg:h-full lg:py-[120px] flex flex-col mt-6 lg:mt-0',
    {
      'active': state.homeCarouselOpen
    }
  )

  const imageLinkClasses = classNames(
    'flex-1 flex justify-center items-center pointer-events-none font-secondary text-base',
    {
      'opacity-0': !state.showViewImages,
      'opacity-100': state.showViewImages
    }
  )

  const closeCarousel = () => {
    dispatch({
      type: 'SET_HOME_CAROUSEL_OPEN',
      payload: false
    })
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
    setTimeout(() => {
      dispatch({
        type: 'SET_HOME_CAROUSEL_OPEN',
        payload: true
      })
    }, 6000)
  }, [])

  const counterClasses = classNames(
    'counter flex-none flex justify-center items-center pt-6 lg:pt-12',
    {
      'left': state.homeCarouselSide === 'left',
      'right': state.homeCarouselSide === 'right'
    }
  )

  return (
    <div className="h-full flex flex-col">
      <div className="flex-none">
        {description && (
          <div
            className="font-primary text-base lg:text-xxl leading-[1.2]"
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
              className="hidden lg:block fill-parent"
            ></button>

            <div className="flex-1">
              <Swiper
                ref={swiperRef}
                spaceBetween={0}
                slidesPerView={1}
                loop={true}
                allowTouchMove={true}
                className="w-full h-full aspect-[4/3] lg:aspect-[unset]"
                onSlideChange={(swiper) => {
                  dispatch({
                    type: 'SET_HOME_CAROUSEL_DATA',
                    payload: {
                      total: carouselImages.length,
                      currentIndex: swiper.realIndex + 1
                    }
                  })
                }}
                onSlideChangeTransitionEnd={() => {
                  setTransitioning(false)
                }}
              >
                {carouselImages.map((image, index) => (
                  <SwiperSlide
                    key={index}
                    className="relative flex justify-center items-center"
                  >
                    <button
                      onClick={closeCarousel}
                      onMouseEnter={() => {
                        dispatch({
                          type: 'SET_HOME_CAROUSEL_CLOSE',
                          payload: true
                        })
                      }}
                      className="fill-parent"
                    ></button>

                    <div
                      onMouseEnter={() => {
                        dispatch({
                          type: 'SET_HOME_CAROUSEL_CLOSE',
                          payload: false
                        })
                      }}
                      className="relative h-full w-auto"
                    >
                      <DefImage
                        src={image.url}
                        width={image.width}
                        height={image.height}
                        alt={image.alt}
                        className="object-contain w-full lg:w-auto h-full"
                      />

                      <div className="fill-parent hidden lg:flex">
                        <button
                          onClick={() => {
                            setTransitioning(true)
                            swiperRef.current.swiper.slidePrev()
                          }}
                          onMouseEnter={() => handleCarouselMouseEnter('left')}
                          onMouseLeave={() => handleCarouselMouseLeave()}
                          className="prev w-1/2 h-full"
                        ></button>
                        <button
                          onClick={() => {
                            setTransitioning(true)
                            swiperRef.current.swiper.slideNext()
                          }}
                          onMouseEnter={() => handleCarouselMouseEnter('right')}
                          onMouseLeave={() => handleCarouselMouseLeave()}
                          className="next w-1/2 h-full"
                        ></button>
                      </div>
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>

            <div
              className={counterClasses}
              onMouseEnter={() => {
                dispatch({
                  type: 'SET_HOME_CAROUSEL_CLOSE',
                  payload: true
                })
              }}
            >
              {state.homeCarouselData && (
                <p className="text-md font-secondary relative">{ transitioning ? `${state.homeCarouselData?.currentIndex}/${state.homeCarouselData?.total}` : state.homeCarouselClose ? '[close images]' : `${state.homeCarouselData?.currentIndex}/${state.homeCarouselData?.total}` }</p>
              )}
            </div>
          </div>
        )}
        
        {/* {carouselImages.length > 0 && (
          <>
            <div
              id="home-carousel"
              className={classes}
            >
              <div
                className="carousel-container z-10 absolute top-0 left-0 w-full h-full"
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
                  allowTouchMove={true}
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
                    <SwiperSlide
                      key={index}
                    >
                      <button
                        onClick={closeCarousel}
                        onMouseEnter={() => {
                          dispatch({
                            type: 'SET_HOME_CAROUSEL_CLOSE',
                            payload: true
                          })
                        }}
                        className="closer fill-parent hidden lg:block"
                      ></button>

                      <div className="relative w-full h-full">
                        <div className="fill-parent flex justify-center">
                          <div className="relative">
                            <DefImage
                              src={image.url}
                              width={image.width}
                              height={image.height}
                              alt={image.alt}
                            />

                            <div className="fill-parent hidden lg:flex z-10">
                              <button
                                onClick={() => swiperRef.current.swiper.slidePrev()}
                                onMouseEnter={() => handleCarouselMouseEnter('left')}
                                onMouseLeave={() => {
                                  dispatch({
                                    type: 'SET_HOME_CAROUSEL_CLOSE',
                                    payload: true
                                  })
                                }}
                                className="prev w-1/2 h-full"
                              ></button>
                              <button
                                onClick={() => swiperRef.current.swiper.slideNext()}
                                onMouseEnter={() => handleCarouselMouseEnter('right')}
                                onMouseLeave={() => {
                                  dispatch({
                                    type: 'SET_HOME_CAROUSEL_CLOSE',
                                    payload: true
                                  })
                                }}
                                className="next w-1/2 h-full"
                              ></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </SwiperSlide>
                  ))}
                </Swiper>
              </div>
            </div>

            {state.homeCarouselData && (
              <div className="flex lg:hidden justify-center mt-4">
                <p className="text-md font-secondary">{state.homeCarouselData.currentIndex}/{carouselImages.length}</p>
              </div>
            )}
          </>
        )} */}
      </div>

      <div className={imageLinkClasses}>
        <p>[view images]</p>
      </div>
    </div>
  )
}

export default HomeContent