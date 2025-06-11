'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { WordMark, SecondaryMark } from "./Icons"
import { useMotionValueEvent, useScroll } from "framer-motion"
import { useState, useEffect, useRef } from "react"
import { useAppState } from "../context"
import classNames from "classnames"
import { UpArrow } from "./Icons"

const HomeLink = () => {
  let targetSize = 170
  let isLargeQuery = false

  if (typeof window !== 'undefined') {
    isLargeQuery = window.matchMedia('(min-width: 992px)').matches

    if (!isLargeQuery) {
      targetSize = 130
    }
  }

  const pathname = usePathname()
  const container = useRef(null)
  const { state, dispatch } = useAppState()
  const { scrollY } = useScroll()
  const scrollTriggerVal = 400

  // const [titleAnimated, setTitleAnimated] = useState(false)
  const [maxTitleSize, setMaxTitleSize] = useState(false)
  const [titleSize, setTitleSize] = useState(false)
  const [prevScroll, setPrevScroll] = useState(0)
  const [showCaptions, setShowCaptions] = useState(false)

  const handleResize = ({ initialLoad }) => {
    if (container.current) {
      setMaxTitleSize(container.current.offsetWidth)

      if (initialLoad) {
        setTitleSize(container.current.offsetWidth)
      } else {
        setTitleSize(targetSize)
      }
    }
  }

  useEffect(() => {
    handleResize({
      initialLoad: true
    })

    // check if window exists
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [])

  // on pathname change, reset title size
  useEffect(() => {
    handleResize({
      initialLoad: true
    })
  }, [pathname])

  const handleHomeLinkClick = () => {
    // if on home page, set homeCarouselOpen to true
    if (pathname === '/') {
      dispatch({
        type: 'SET_HOME_CAROUSEL_OPEN',
        payload: true
      })
    }
  }

  const handleHomeLinkMouseEnter = () => {
    // if on home page, set showViewImages to true
    if (pathname === '/') {
      dispatch({
        type: 'SET_SHOW_VIEW_IMAGES',
        payload: true
      })
    }
  }

  const handleHomeLinkMouseLeave = () => {
    // if on home page, set showViewImages to true
    if (pathname === '/') {
      dispatch({
        type: 'SET_SHOW_VIEW_IMAGES',
        payload: false
      })
    }
  }

  useMotionValueEvent(scrollY, 'change', (latestScrollY) => {
    // only do animation if not on gallery page
    if (!pathname.includes('/gallery')) {
      if (latestScrollY >= scrollTriggerVal) {
        setTitleSize(targetSize)
        setShowCaptions(true)
      } else if (latestScrollY < scrollTriggerVal) {
        setShowCaptions(false)

        // get the progress between 100 and 300 and convert it to pixel value between titleSize and targetSize
        const progress = latestScrollY / scrollTriggerVal
        const maxTitleSizeInt = parseInt(maxTitleSize)
        const targetSizeInt = parseInt(targetSize)
        const diff = maxTitleSizeInt - targetSizeInt
        const newTitleSize = maxTitleSizeInt - (diff * progress)

        setTitleSize(newTitleSize)
      }
    }

    // check if scrolling up or down
    if (latestScrollY >= prevScroll && latestScrollY > (scrollTriggerVal + 200)) {
      dispatch({
        type: 'SET_HIDE_HOME_LINK',
        payload: true
      })

      dispatch({
        type: 'SET_HIDE_NAV',
        payload: true
      })
    } else {
      dispatch({
        type: 'SET_HIDE_HOME_LINK',
        payload: false
      })

      dispatch({
        type: 'SET_HIDE_NAV',
        payload: false
      })
    }

    setPrevScroll(latestScrollY)
  })

  const classes = classNames(
    'fixed top-0 left-0 w-full px-5 lg:px-14 py-5 lg:py-10',
    {
      'hide': state.hideHomeLink,
      'show-captions': showCaptions
    }
  )

  return (
    <nav 
      id="home-link" 
      className={classes}
    >
      <div
        ref={container}
        className="flex justify-center"
      >
        {pathname.includes('/projects') && (
          <div
            className="caption hidden lg:block absolute left-14 text-lg font-secondary"
          >
            {state.currentProjectTitle && (
              <p>{state.currentProjectTitle}</p>
            )}
          </div>
        )}

        {titleSize && (
          <Link
            href="/"
            className="flex justify-center"
            onMouseEnter={handleHomeLinkMouseEnter}
            onMouseLeave={handleHomeLinkMouseLeave}
            onClick={handleHomeLinkClick}
            style={{
              width: `${titleSize}px`
            }}
          >
            <WordMark />
          </Link>
        )}

        {pathname.includes('/projects') && (
          <button
            className="caption lg:hidden absolute top-[16px] right-5 lg:right-14 text-lg font-secondary lg:hover:opacity-50 transition-opacity duration-300"
            onClick={() => {
              window.scrollTo({
                top: 0,
                behavior: 'smooth'
              })
            }}
          >
            <UpArrow />
          </button>
        )}
      </div>
    </nav>
  )
}

export default HomeLink