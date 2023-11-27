'use client'

import DefImage from "./DefImage"
import classNames from "classnames"
import { useEffect, useState } from "react"

const Screensaver = ({ images }) => {
  let inactiveTimer = null
  let stampInterval = null
  const [active, setActive] = useState(false)

  console.log(images)

  const [imageItems, setImageItems] = useState([])

  // classes for screensaver
  const classes = classNames(
    'fixed top-0 left-0 w-full h-full',
    {
      'active': active
    }
  )

  const getRandomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  const addImage = () => {
    const randomImage = images[Math.floor(Math.random() * images.length)]

    const randomImageObj = {
      image: randomImage,
      top: getRandomInt(-3, 103),
      left: getRandomInt(-3, 103),
      rotation: getRandomInt(0, 360)
    }

    setImageItems(prevState => [...prevState, randomImageObj])
  }
  
  // function to reset screensaver timer
  const reset = () => {
    // if active, set to inactive
    setActive(false)

    // clear timer
    clearTimeout(inactiveTimer)
    clearInterval(stampInterval)

    // set new timer
    inactiveTimer = setTimeout(() => {
      setImageItems([])
      setActive(true)
      addImage()

      stampInterval = setInterval(() => {
        addImage()
      }, 3000) // 20 seconds
    }, 300000) // 300000 = 5 minutes
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
      {imageItems.map((item, index) => {
        return (
          <div
            key={index}
            style={{
              top: `${item.top}%`,
              left: `${item.left}%`,
              transform: `rotate(${item.rotation}deg)`
            }}
            className="absolute w-[100px] lg:w-[200px]"
          >
            <DefImage 
              key={index}
              src={item.image.url} 
              width={item.image.width} 
              height={item.image.height}
              alt={item.image.alt}
              className="media-cover"
            />
          </div>
        )
      })}
    </div>
  )
}

export default Screensaver