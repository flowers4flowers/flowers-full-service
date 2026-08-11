// next/components/MobileMenu.js

"use client";

import CopyLink from "./CopyLink";
import classNames from "classnames";
import { useAppState } from "../context";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAnalytics } from "../utility/useAnalytics";
import ThemeToggle from "./ThemeToggle";

const MobileMenu = ({ socialLinks }) => {
  const { state, dispatch } = useAppState();
  const pathname = usePathname();
  const { trackLink, trackSocial } = useAnalytics();

  const checkLinkActive = (link) => {
    return pathname === link;
  };

  const classes = classNames(
    "fixed top-16 right-4 bottom-16 w-[80vw] max-w-xs bg-white dark:bg-black text-black dark:text-cream px-5 pt-12 pb-4 lg:hidden flex flex-col shadow-xl",
    {
      active: state.mobileMenuOpen,
    },
  );

  const backdropClasses = classNames(
    "fixed inset-0 z-[3400] lg:hidden bg-black bg-opacity-50 opacity-0 pointer-events-none transition-opacity duration-300",
    {
      "opacity-100 pointer-events-auto": state.mobileMenuOpen,
    },
  );

  // on pathname change, close mobile menu
  useEffect(() => {
    dispatch({
      type: "SET_MOBILE_MENU_OPEN",
      payload: false,
    });
  }, [pathname, dispatch]);

  return (
    <>
      <div
        id="mobile-menu-backdrop"
        className={backdropClasses}
        onClick={() =>
          dispatch({
            type: "SET_MOBILE_MENU_OPEN",
            payload: false,
          })
        }
      />

      <div id="mobile-menu" className={classes}>
        <button
          onClick={() => {
            dispatch({
              type: "SET_MOBILE_MENU_OPEN",
              payload: false,
            });
          }}
          className="absolute top-4 right-4 text-2xl font-secondary leading-none"
        >
          ×
        </button>

        <nav className="main-links flex-1">
          <ul className="w-full font-secondary text-xl leading-[1.4]">
            <li
              className={`${
                checkLinkActive("/") ? "active" : ""
              } grid grid-cols-6 gap-4`}
            >
              <div className="col-span-1 flex items-center justify-start">
                <div className="circle w-6 h-6 bg-black dark:bg-cream rounded-full"></div>
              </div>
              <Link
                href="/"
                className="col-span-5"
                onClick={() => trackLink("Mobile Menu: Home", "/")}
              >
                Home
              </Link>
            </li>

            <li
              className={`${
                checkLinkActive("/gallery") ? "active" : ""
              } grid grid-cols-6 gap-4`}
            >
              <div className="col-span-1 flex items-center justify-start">
                <div className="circle w-6 h-6 bg-black dark:bg-cream rounded-full"></div>
              </div>
              <Link
                href="/gallery"
                className="col-span-5"
                onClick={() => trackLink("Mobile Menu: Gallery", "/gallery")}
              >
                Gallery
              </Link>
            </li>
            <li
              className={`${
                checkLinkActive("/about") ? "active" : ""
              } grid grid-cols-6 gap-4`}
            >
              <div className="col-span-1 flex items-center justify-start">
                <div className="circle w-6 h-6 bg-black dark:bg-cream rounded-full"></div>
              </div>
              <Link
                href="/about"
                className="col-span-5"
                onClick={() => trackLink("Mobile Menu: About", "/about")}
              >
                About
              </Link>
            </li>
          </ul>

          <ul className="w-full font-secondary text-xl leading-[1.4]">
            {socialLinks
              .filter((link) => !link.link.toLowerCase().includes("instagram"))
              .map((link, index) => {
                if (link.link.includes("mailto")) {
                  return (
                    <li key={index} className="grid grid-cols-6 gap-4">
                      <CopyLink
                        title={link.title}
                        url={link.link}
                        className="col-span-5 col-start-2 text-left"
                      />
                    </li>
                  );
                } else {
                  return (
                    <li key={index} className="grid grid-cols-6 gap-4">
                      <Link
                        href={link.link}
                        target="_blank"
                        className="col-span-5 col-start-2"
                        onClick={() => trackSocial(link.title)}
                      >
                        {link.title}
                      </Link>
                    </li>
                  );
                }
              })}
          </ul>
          <ThemeToggle className="mt-8" />
        </nav>
      </div>
    </>
  );
};

export default MobileMenu;
