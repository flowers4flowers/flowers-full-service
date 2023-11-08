'use client'

import { usePathname } from "next/navigation"
import { useAppState } from "@/context"
import Link from "next/link"
import classNames from "classnames"

const MainNavLinks = () => {
  const { state } = useAppState()
  const pathname = usePathname()

  const checkLinkActive = (link) => {
    return pathname === link
  }

  const counterClasses = classNames(
    'col-span-3',
    {
      'left': state.homeCarouselSide === 'left',
      'right': state.homeCarouselSide === 'right'
    }
  )

  return (
    <nav className="main-nav-links col-span-9">
      <ul className="w-full font-secondary text-lg grid grid-cols-9 gap-6">
        <li className="col-span-2">
          <Link
            href="/gallery"
            className={checkLinkActive('/gallery') ? 'active': ''}
          >Gallery</Link>
        </li>

        <li className="col-span-2">
          <Link
            href="/about"
            className={checkLinkActive('/about') ? 'active': ''}
          >About</Link>
        </li>

        <li className="col-span-2">
          <Link
            href="/shop"
            className={checkLinkActive('/shop') ? 'active': ''}
          >Shop</Link>
        </li>

        {state.homeCarouselOpen && (
          <li
            id="home-carousel-counter"
            className={counterClasses}
          >
            <span className="relative inline-flex items-center">{ state.homeCarouselClose ? '[close images]' : `${state.homeCarouselData.currentIndex}/${state.homeCarouselData.total}` }</span>
          </li>
        )}
      </ul>
    </nav>
  )
}

export default MainNavLinks