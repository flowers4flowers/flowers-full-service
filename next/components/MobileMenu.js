'use client'

import CopyLink from "./CopyLink"
import classNames from "classnames"
import { useAppState } from "@/context"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect } from "react"

const MobileMenu = ({ socialLinks }) => {
  const { state, dispatch } = useAppState()
  const pathname = usePathname()

  const checkLinkActive = (link) => {
    return pathname === link
  }

  const classes = classNames(
    'fixed top-0 left-0 w-full h-full bg-white px-5 pt-12 flex flex-col',
    {
      'active': state.mobileMenuOpen
    }
  )

  // on pathname change, close mobile menu
  useEffect(() => {
    dispatch({
      type: 'SET_MOBILE_MENU_OPEN',
      payload: false
    })
  }, [pathname])

  return (
    <div id="mobile-menu" className={classes}>
      <nav className="main-links flex-1">
        <ul className="w-full font-secondary text-xl leading-[1.4]">
          <li className={`${checkLinkActive('/') ? 'active': ''} grid grid-cols-6 gap-4`}>
            <div className="col-span-1 flex items-center justify-start">
              <div className="circle w-6 h-6 bg-black rounded-full"></div>
            </div>
            <Link
              href="/"
              className="col-span-5"
            >Home</Link>
          </li>

          <li className={`${checkLinkActive('/gallery') ? 'active': ''} grid grid-cols-6 gap-4`}>
            <div className="col-span-1 flex items-center justify-start">
              <div className="circle w-6 h-6 bg-black rounded-full"></div>
            </div>
            <Link
              href="/gallery"
              className="col-span-5"
            >Gallery</Link>
          </li>

          <li className={`${checkLinkActive('/about') ? 'active': ''} grid grid-cols-6 gap-4`}>
            <div className="col-span-1 flex items-center justify-start">
              <div className="circle w-6 h-6 bg-black rounded-full"></div>
            </div>
            <Link
              href="/about"
              className="col-span-5"
            >About</Link>
          </li>

          <li className={`${checkLinkActive('/shop') ? 'active': ''} grid grid-cols-6 gap-4`}>
            <div className="col-span-1 flex items-center justify-start">
              <div className="circle w-6 h-6 bg-black rounded-full"></div>
            </div>
            <Link
              href="/shop"
              className="col-span-5"
            >Shop</Link>
          </li>
        </ul>

        <ul className="w-full mt-12 font-secondary text-xl leading-[1.4]">
          {socialLinks.map((link, index) => {
            if (link.link.includes('mailto')) {
              return (
                <li key={index} className="grid grid-cols-6 gap-4">
                  <CopyLink
                    title={link.title}
                    url={link.link}
                    className="col-span-5 col-start-2 text-left"
                  />
                </li>
              )
            } else {
              return (
                <li key={index} className="grid grid-cols-6 gap-4">
                  <Link
                    href={link.link}
                    target="_blank"
                    className="col-span-5 col-start-2"
                  >{link.title}</Link>
                </li>
              )
            }
          })}
        </ul>
      </nav>

      <div className="flex-none w-full flex justify-center items-center py-6 px-5">
        <button
          onClick={() => {
            dispatch({
              type: 'SET_MOBILE_MENU_OPEN',
              payload: false
            })
          }}
          className="text-md font-secondary text-center"
        >Close Menu</button>
      </div>
    </div>
  )
}

export default MobileMenu