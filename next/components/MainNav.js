'use client'

import Link from "next/link"
import { Fragment } from "react"
import MainNavLinks from "./MainNavLinks"
import CopyLink from "./CopyLink"
import classNames from "classnames"
import { useAppState } from "@/context"

const MainNav = ({ socialLinks }) => {
  const { state } = useAppState()

  const classes = classNames(
    'fixed bottom-0 left-0 w-full bg-cream px-14 py-10 hidden lg:grid grid-cols-12 gap-6',
    {
      'hide': state.hideNav
    }
  )

  return (
    <header
      id="main-nav"
      className={classes}
    >
      <MainNavLinks />

      {socialLinks && (
        <nav className="col-span-3 font-secondary text-lg text-left">
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
        </nav>
      )}
    </header>
  );
}

export default MainNav;