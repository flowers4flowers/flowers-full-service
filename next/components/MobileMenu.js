// next/components/MobileMenu.js

"use client";

import CopyLink from "./CopyLink";
import classNames from "classnames";
import { useAppState } from "../context";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAnalytics } from "../utility/useAnalytics";

const MobileMenu = ({ socialLinks }) => {
  const { state, dispatch } = useAppState();
  const pathname = usePathname();
  const { trackLink, trackSocial } = useAnalytics();

  const checkLinkActive = (link) => {
    return pathname === link;
  };

  const classes = classNames(
    "fixed top-0 left-0 w-full h-full bg-white px-5 pt-12 flex flex-col",
    {
      active: state.mobileMenuOpen,
    }
  );

  // on pathname change, close mobile menu
  useEffect(() => {
    dispatch({
      type: "SET_MOBILE_MENU_OPEN",
      payload: false,
    });
  }, [pathname, dispatch]);

  return (
    <div id="mobile-menu" className={classes}>
      <nav className="main-links flex-1">
        <ul className="w-full font-secondary text-xl leading-[1.4]">
          <li
            className={`${
              checkLinkActive("/") ? "active" : ""
            } grid grid-cols-6 gap-4`}
          >
            <div className="col-span-1 flex items-center justify-start">
              <div className="circle w-6 h-6 bg-black rounded-full"></div>
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
              <div className="circle w-6 h-6 bg-black rounded-full"></div>
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
              checkLinkActive("/work") ? "active" : ""
            } grid grid-cols-6 gap-4`}
          >
            <div className="col-span-1 flex items-center justify-start">
              <div className="circle w-6 h-6 bg-black rounded-full"></div>
            </div>
            <Link
              href="/work"
              className="col-span-5"
              onClick={() => trackLink("Mobile Menu: Work", "/work")}
            >
              Work
            </Link>
          </li>

          <li
            className={`${
              checkLinkActive("/shop") ? "active" : ""
            } grid grid-cols-6 gap-4`}
          >
            <div className="col-span-1 flex items-center justify-start">
              <div className="circle w-6 h-6 bg-black rounded-full"></div>
            </div>
            <Link
              href="/shop"
              className="col-span-5"
              onClick={() => trackLink("Mobile Menu: Shop", "/shop")}
            >
              Shop
            </Link>
          </li>
        </ul>

        <ul className="w-full mt-12 font-secondary text-xl leading-[1.4]">
          {socialLinks.map((link, index) => {
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
      </nav>

      <div className="flex-none w-full flex justify-center items-center py-6 px-5">
        <button
          onClick={() => {
            dispatch({
              type: "SET_MOBILE_MENU_OPEN",
              payload: false,
            });
          }}
          className="text-md font-secondary text-center"
        >
          Close Menu
        </button>
      </div>
    </div>
  );
};

export default MobileMenu;
