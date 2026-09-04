// next/components/DeckNav.js

"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const SWIPE_THRESHOLD = 50;

const DeckNav = ({ children, prevHref, nextHref, counter }) => {
  const router = useRouter();
  const touchStart = useRef(null);

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName;

      if (tag === "INPUT" || tag === "TEXTAREA") {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === "ArrowLeft" && prevHref) {
        router.push(prevHref);
      }

      if (event.key === "ArrowRight" && nextHref) {
        router.push(nextHref);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [prevHref, nextHref, router]);

  const onTouchStart = (event) => {
    const touch = event.changedTouches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event) => {
    if (!touchStart.current) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;

    touchStart.current = null;

    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }

    if (deltaX < -SWIPE_THRESHOLD && nextHref) {
      router.push(nextHref);
    }

    if (deltaX > SWIPE_THRESHOLD && prevHref) {
      router.push(prevHref);
    }
  };

  return (
    <div className="deck-nav" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="deck-nav__slide">{children}</div>

      <div className="deck-nav__controls">
        {prevHref ? (
          <Link
            href={prevHref}
            className="deck-nav__btn deck-nav__prev"
            aria-label="Previous"
          >
            &larr;
          </Link>
        ) : (
          <span
            className="deck-nav__btn deck-nav__prev"
            aria-disabled="true"
          >
            &larr;
          </span>
        )}

        {counter && <span className="deck-nav__counter">{counter}</span>}

        {nextHref ? (
          <Link
            href={nextHref}
            className="deck-nav__btn deck-nav__next"
            aria-label="Next"
          >
            &rarr;
          </Link>
        ) : (
          <span
            className="deck-nav__btn deck-nav__next"
            aria-disabled="true"
          >
            &rarr;
          </span>
        )}
      </div>
    </div>
  );
};

export default DeckNav;
