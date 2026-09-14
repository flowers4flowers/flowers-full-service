// next/components/DeckPdfMenuItem.js

"use client";

import { useEffect, useRef, useState } from "react";
import { Thumbnail } from "react-pdf";

const THUMBNAIL_WIDTH = 96;

const DeckPdfMenuItem = ({
  pdf,
  pageNumber,
  isActive,
  activeItemRef,
  onSelect,
  scrollRoot,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const entryRef = useRef(null);

  useEffect(() => {
    if (isVisible) {
      return;
    }

    const node = entryRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { root: scrollRoot.current },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [isVisible, scrollRoot]);

  return (
    <li
      ref={(node) => {
        entryRef.current = node;
        if (isActive && activeItemRef) {
          activeItemRef.current = node;
        }
      }}
      className={
        isActive
          ? "deck-pdf-menu__item deck-pdf-menu__item--active"
          : "deck-pdf-menu__item"
      }
    >
      {isVisible ? (
        <Thumbnail
          pdf={pdf}
          pageNumber={pageNumber}
          width={THUMBNAIL_WIDTH}
          onItemClick={() => onSelect()}
        />
      ) : (
        <div className="deck-pdf-menu__thumb-placeholder" />
      )}

      <span className="deck-pdf-menu__item-number font-secondary text-md">
        {pageNumber}
      </span>
    </li>
  );
};

export default DeckPdfMenuItem;
