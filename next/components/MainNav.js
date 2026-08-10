// next/components/MainNav.js

"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import MainNavLinks from "./MainNavLinks";
import CopyLink from "./CopyLink";
import classNames from "classnames";
import { useAppState } from "../context";
import { useTheme } from "../context/ThemeContext";
import { UpArrow } from "./Icons";
import { useMotionValueEvent, useScroll } from "framer-motion";
import { usePathname } from "next/navigation";
import { useAnalytics } from "../utility/useAnalytics";
import { useScrollDirection } from "../utility/useScrollDirection";
import ThemeToggle from "./ThemeToggle";

const MainNav = ({ socialLinks }) => {
  const { state } = useAppState();
  const { theme } = useTheme();
  useScrollDirection();
  const { scrollY } = useScroll();
  const [showUp, setShowUp] = useState(false);
  const pathname = usePathname();
  const { trackSocial } = useAnalytics();

  const classes = classNames(
    "fixed top-0 left-0 w-full bg-cream dark:bg-black px-14 py-10 hidden lg:flex justify-between items-center",
    {
      hide: state.hideNav,
    },
  );

  useMotionValueEvent(scrollY, "change", (latestScrollY) => {
    if (latestScrollY > 300) {
      setShowUp(true);
    } else {
      setShowUp(false);
    }
  });

  return (
    <header id="main-nav" className={classes}>
      <Link href="/">
        <Image src="/FLOWERS.png" alt="FLOWERS" width={50} height={40} className="dark:invert" />
      </Link>

      <nav className="main-nav-links">
        <ul className="font-secondary font-bold text-base text-black dark:text-cream flex justify-end items-center gap-6">
          <MainNavLinks />

          {socialLinks &&
            socialLinks
              .filter((link) => !link.link.toLowerCase().includes("instagram"))
              .map((link, index) => (
                <li key={index}>
                  {link.link.includes("mailto") ? (
                    <CopyLink title="Contact" url={link.link} />
                  ) : (
                    <Link
                      href={link.link}
                      target="_blank"
                      className="lg:hover:opacity-50 transition-opacity duration-300"
                      onClick={() => trackSocial(link.title)}
                    >
                      {link.title}
                    </Link>
                  )}
                </li>
              ))}

          <ThemeToggle />

          <li>
            <button
              onClick={() => {
                window.scrollTo({
                  top: 0,
                  behavior: "smooth",
                });
              }}
              className={`up lg:hover:opacity-50 transition-opacity duration-300 ${
                showUp &&
                (pathname.includes("/projects") ||
                  pathname.includes("/gallery"))
                  ? "opacity-100"
                  : "opacity-0 pointer-events-none"
              }`}
            >
              <UpArrow color={theme === "dark" ? "#EEEBE6" : "black"} />
            </button>
          </li>
        </ul>
      </nav>
    </header>
  );
};

export default MainNav;
