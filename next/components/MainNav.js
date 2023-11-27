'use client'

import Link from "next/link"
import { Fragment, useState } from "react"
import MainNavLinks from "./MainNavLinks"
import CopyLink from "./CopyLink"
import classNames from "classnames"
import { useAppState } from "@/context"
import { UpArrow } from "./Icons"
import { useMotionValueEvent, useScroll } from "framer-motion"
import { usePathname } from "next/navigation"

const MainNav = ({ socialLinks }) => {
  const { state } = useAppState()
  const { scrollY } = useScroll()
  const [showUp, setShowUp] = useState(false)
  const pathname = usePathname()

  const classes = classNames(
    'fixed bottom-0 left-0 w-full bg-cream px-14 py-10 hidden lg:grid grid-cols-12 gap-6',
    {
      'hide': state.hideNav
    }
  )

  useMotionValueEvent(scrollY, 'change', (latestScrollY) => {
    if (latestScrollY > 300) {
      setShowUp(true)
    } else {
      setShowUp(false)
    }
  })

  return (
    <header
      id="main-nav"
      className={classes}
    >
      <MainNavLinks />

      {socialLinks && (
        <nav className="col-span-3 font-secondary text-base text-left flex justify-between items-center">
          <div>
            {socialLinks.map((link, index) => (
              <Fragment key={index}>
                {link.link.includes('mailto')
                  ? <CopyLink
                      title={link.title}
                      url={link.link}
                    />
                  : <Link
                      href={link.link}
                      target="_blank"
                      className="lg:hover:opacity-50 transition-opacity duration-300"
                    >{link.title}</Link>
                }
                {index < socialLinks.length - 1 && (
                  <span>,&nbsp;</span>
                )}
              </Fragment>
            ))}
          </div>

          {(pathname.includes('/projects') || pathname.includes('/gallery')) && (
            <button
              onClick={() => {
                window.scrollTo({
                  top: 0,
                  behavior: 'smooth'
                })
              }}
              className={`up lg:hover:opacity-50 transition-opacity duration-300 ${showUp ? 'opacity-100' : 'opacity-0'}`}
            >
              <UpArrow />
            </button> 
          )}
        </nav>
      )}
    </header>
  );
}

export default MainNav;