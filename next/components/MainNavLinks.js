'use client'

import { usePathname } from "next/navigation"
import { useAppState } from "@/context"
import Link from "next/link"
// import classNames from "classnames"

// const CarouselInfo = ({ state, dispatch }) => {
//   const counterClasses = classNames(
//     'col-span-3',
//     {
//       'left': state.homeCarouselSide === 'left',
//       'right': state.homeCarouselSide === 'right'
//     }
//   )

//   if (state.homeCarouselOpen) {
//     return (
//       <li
//         id="home-carousel-counter"
//         className={counterClasses}
//       >
//         <span className="relative inline-flex items-center">{ state.homeCarouselClose ? '[close images]' : `${state.homeCarouselData?.currentIndex}/${state.homeCarouselData?.total}` }</span>
//       </li>
//     )
//   }

//   return (
//     <li
//       id="home-carousel-counter"
//       className="col-span-3"
//     >
//       <button
//         className="lg:hover:opacity-50 transition-opacity duration-300"
//         onClick={() => {
//           dispatch({
//             type: 'SET_HOME_CAROUSEL_OPEN',
//             payload: true
//           })
//         }}
//       >[view images]</button>
//     </li>
//   )
// }

const MainNavLinks = () => {
  const { state, dispatch } = useAppState()
  const pathname = usePathname()

  const checkLinkActive = (link) => {
    return pathname === link
  }

  return (
    <nav className="main-nav-links col-span-9">
      <ul className="w-full font-secondary text-base grid grid-cols-9 gap-6">
        <li className="col-span-2">
          <Link
            href="/gallery"
            className={checkLinkActive('/gallery') ? 'active': ''}
          >
            <span>Gallery</span>
          </Link>
        </li>

        <li className="col-span-2">
          <Link
            href="/about"
            className={checkLinkActive('/about') ? 'active': ''}
          >
            <span>About</span>
          </Link>
        </li>

        <li className="col-span-2">
          <Link
            href="/shop"
            className={checkLinkActive('/shop') ? 'active': ''}
          >
            <span>Shop</span>
          </Link>
        </li>

        {/* {pathname === '/' && (
          <CarouselInfo
            state={state}
            dispatch={dispatch}
          />
        )} */}
      </ul>
    </nav>
  )
}

export default MainNavLinks