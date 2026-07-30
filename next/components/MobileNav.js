// next/components/MobileNav.js

"use client";

import Link from "next/link";
import Image from "next/image";
import classNames from "classnames";
import { useState } from "react";
import { useAppState } from "../context";
import { UpArrow } from "./Icons";
import { useMotionValueEvent, useScroll } from "framer-motion";
import { usePathname } from "next/navigation";
import { useScrollDirection } from "../utility/useScrollDirection";

const MobileNav = () => {
  const { state, dispatch } = useAppState();
  useScrollDirection();
  const { scrollY } = useScroll();
  const [showUp, setShowUp] = useState(false);
  const pathname = usePathname();

  useMotionValueEvent(scrollY, "change", (latestScrollY) => {
    if (latestScrollY > 300) {
      setShowUp(true);
    } else {
      setShowUp(false);
    }
  });

  const classes = classNames(
    "fixed top-0 left-0 w-full bg-cream px-5 py-5 flex lg:hidden justify-between items-center",
    {
      hide: state.hideNav,
    }
  );

  return (
    <header id="mobile-nav" className={classes}>
      <Link href="/">
        <Image src="/FLOWERS.png" alt="FLOWERS" width={40} height={32} />
      </Link>

      <div className="flex justify-end items-center gap-6">
        <button
          onClick={() => {
            dispatch({
              type: "SET_MOBILE_MENU_OPEN",
              payload: true,
            });
          }}
          className="text-md font-secondary text-center"
        >
          Menu
        </button>

        {(pathname.includes("/projects") ||
          pathname.includes("/gallery")) && (
          <button
            onClick={() => {
              window.scrollTo({
                top: 0,
                behavior: "smooth",
              });
            }}
            className={`up transition-opacity duration-300 ${
              showUp ? "opacity-100" : "opacity-0"
            }`}
          >
            <UpArrow />
          </button>
        )}
      </div>
    </header>
  );
};

export default MobileNav;
