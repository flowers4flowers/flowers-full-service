// next/components/HomeLink.js

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SecondaryMark } from "./Icons";
import { useMotionValueEvent, useScroll } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAppState } from "../context";
import classNames from "classnames";
import { UpArrow } from "./Icons";

const WORDMARK_ASPECT_RATIO = 1312 / 217;

const HomeLink = () => {
  let targetSize = 170;
  let isLargeQuery = false;

  if (typeof window !== "undefined") {
    isLargeQuery = window.matchMedia("(min-width: 992px)").matches;

    if (!isLargeQuery) {
      targetSize = 130;
    }
  }

  const pathname = usePathname();
  const container = useRef(null);
  const { state, dispatch } = useAppState();
  const { scrollY } = useScroll();
  const scrollTriggerVal = 400;

  // const [titleAnimated, setTitleAnimated] = useState(false)
  const [maxTitleSize, setMaxTitleSize] = useState(false);
  const [titleSize, setTitleSize] = useState(false);
  const [prevScroll, setPrevScroll] = useState(0);
  const [showCaptions, setShowCaptions] = useState(false);

  const handleResize = useCallback(
    ({ initialLoad }) => {
      if (container.current) {
        setMaxTitleSize(container.current.offsetWidth);

        if (initialLoad) {
          setTitleSize(container.current.offsetWidth);
        } else {
          setTitleSize(targetSize);
        }
      }
    },
    [targetSize]
  );

  useEffect(() => {
    handleResize({
      initialLoad: true,
    });

    // check if window exists
    if (typeof window !== "undefined") {
      window.addEventListener("resize", handleResize);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", handleResize);
      }
    };
  }, [handleResize]);

  // on pathname change, reset title size
  useEffect(() => {
    handleResize({
      initialLoad: true,
    });
  }, [pathname, handleResize]);

  useMotionValueEvent(scrollY, "change", (latestScrollY) => {
    // only do animation if not on gallery page
    if (!pathname.includes("/gallery")) {
      if (latestScrollY >= scrollTriggerVal) {
        setTitleSize(targetSize);
        setShowCaptions(true);
      } else if (latestScrollY < scrollTriggerVal) {
        setShowCaptions(false);

        // get the progress between 100 and 300 and convert it to pixel value between titleSize and targetSize
        const progress = latestScrollY / scrollTriggerVal;
        const maxTitleSizeInt = parseInt(maxTitleSize);
        const targetSizeInt = parseInt(targetSize);
        const diff = maxTitleSizeInt - targetSizeInt;
        const newTitleSize = maxTitleSizeInt - diff * progress;

        setTitleSize(newTitleSize);
      }
    }

    // check if scrolling up or down
    if (latestScrollY >= prevScroll && latestScrollY > scrollTriggerVal + 200) {
      dispatch({
        type: "SET_HIDE_HOME_LINK",
        payload: true,
      });

      dispatch({
        type: "SET_HIDE_NAV",
        payload: true,
      });
    } else {
      dispatch({
        type: "SET_HIDE_HOME_LINK",
        payload: false,
      });

      dispatch({
        type: "SET_HIDE_NAV",
        payload: false,
      });
    }

    setPrevScroll(latestScrollY);
  });

  const classes = classNames(
    "fixed top-0 left-0 w-full px-5 lg:px-14 py-5 lg:py-10 hidden lg:block",
    {
      hide: state.hideHomeLink,
      "show-captions": showCaptions,
    }
  );

  return (
    <nav id="home-link" className={classes}>
      <div ref={container} className="flex justify-center">
        {titleSize && (
          <Link
            href="/"
            className="flex justify-center"
            style={{
              width: `${titleSize}px`,
            }}
          >
            <Image
              src="/FLOWERS-Full.svg"
              alt="FLOWERS"
              width={titleSize}
              height={Math.round(titleSize / WORDMARK_ASPECT_RATIO)}
            />
          </Link>
        )}

        {pathname.includes("/projects") && (
          <button
            className="caption lg:hidden absolute top-[16px] right-5 lg:right-14 text-lg font-secondary lg:hover:opacity-50 transition-opacity duration-300"
            onClick={() => {
              window.scrollTo({
                top: 0,
                behavior: "smooth",
              });
            }}
          >
            <UpArrow />
          </button>
        )}
      </div>
    </nav>
  );
};

export default HomeLink;
