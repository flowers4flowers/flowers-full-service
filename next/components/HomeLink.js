'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { WordMark, SecondaryMark } from "./Icons"
import { useMotionValueEvent, useScroll } from "framer-motion"
import { useState } from "react"
import { useAppState } from "@/context"
import classNames from "classnames"

const HomeLink = () => {
  const pathname = usePathname()
  const { state, dispatch } = useAppState()
  const { scrollY } = useScroll()
  const [titleAnimated, setTitleAnimated] = useState(false)
  const [prevScroll, setPrevScroll] = useState(0)
  const [showCaptions, setShowCaptions] = useState(false)
  let isLargeQuery = false
  let svgWidth = '170px'

  if (typeof window !== 'undefined') {
    isLargeQuery = window.matchMedia('(min-width: 992px)').matches

    if (!isLargeQuery) {
      svgWidth = '130px'
    }
  }

  useMotionValueEvent(scrollY, 'change', (latestScrollY) => {
    if (latestScrollY > 300) {
      setShowCaptions(true)
    } else if (latestScrollY > 100 && latestScrollY < 300) {
      setTitleAnimated(true)
      setShowCaptions(false)
    } else {
      dispatch({
        type: 'SET_HIDE_HOME_LINK',
        payload: false
      })

      dispatch({
        type: 'SET_HIDE_NAV',
        payload: false
      })
      
      setTitleAnimated(false)
      setShowCaptions(false)
    }

    // check if scrolling up or down
    if (latestScrollY >= prevScroll && latestScrollY > 600) {
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
    'fixed top-0 left-0 w-full flex justify-center px-5 lg:px-14 py-5 lg:py-10',
    {
      'hide': state.hideHomeLink,
      'show-captions': showCaptions
    }
  )

  if (pathname !== '/about') {
    return (
      <nav 
        id="home-link" 
        className={classes}
      >
        {pathname.includes('/projects') && (
          <div
            className="caption hidden lg:block absolute left-14 text-lg font-secondary"
          >
            {state.currentProjectTitle && (
              <p>{state.currentProjectTitle}</p>
            )}

            {/* {state.currentProjectCaptions.map((caption, index) => { 
              return (
                <p key={index}>{caption}</p>
              )
            })} */}
          </div>
        )}

        <Link
          href="/"
          className="flex justify-center"
          style={{
            width: !titleAnimated ? '100%' : svgWidth
          }}
        >
          <WordMark />
        </Link>

        {pathname.includes('/projects') && (
          <button
            className="caption hidden lg:block absolute right-14 text-lg font-secondary lg:hover:opacity-50 transition-opacity duration-300"
            onClick={() => {
              window.scrollTo({
                top: 0,
                behavior: 'smooth'
              })
            }}
          >Scroll to top</button>
        )}
      </nav>
    )
  } else {
    return (
      <nav
        id="secondary-home-link"
        className="fixed top-0 left-0 w-full flex justify-center px-5 lg:px-14 py-5 lg:py-10"
      >
        <Link
          href="/"
          className="flex justify-center lg:hover:opacity-70 w-full"
        >
          <SecondaryMark />
        </Link>
      </nav>
    )
  }
}

export default HomeLink