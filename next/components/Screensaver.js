'use client'

import DefImage from "./DefImage"
import classNames from "classnames"
import { useEffect, useState } from "react"

const Screensaver = ({ image }) => {
  let inactiveTimer = null
  const [active, setActive] = useState(false)

  // classes for screensaver
  const classes = classNames(
    'fixed top-0 left-0 w-full h-full',
    {
      'active': active
    }
  )
  
  // function to reset screensaver timer
  const reset = () => {
    // if active, set to inactive
    setActive(false)

    // clear timer
    clearTimeout(inactiveTimer)

    // set new timer
    inactiveTimer = setTimeout(() => {
      setActive(true)
    }, 300000) // 5 minutes
  }

  // on load, reset, and then add event listeners if document exists
  useEffect(() => {
    reset()
    
    // check if document exists
    if (typeof document !== 'undefined') {
      document.addEventListener('mousemove', reset)
      document.addEventListener('keydown', reset)
    }

    return () => {
      clearTimeout(inactiveTimer)
      if (typeof document !== 'undefined') {
        document.removeEventListener('mousemove', reset)
        document.removeEventListener('keydown', reset)
      }
    }
  }, [])

  return (
    <div 
      id="screensaver" 
      className={classes}
      onClick={() => setActive(false)}
    >
      <DefImage 
        src={image.url} 
        width={image.width} 
        height={image.height}
        alt={image.alt}
        className="media-cover"
      />
    </div>
  )
}

export default Screensaver