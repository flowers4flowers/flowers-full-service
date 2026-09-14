// next/components/DeckPdfNav.js

"use client";

import { forwardRef } from "react";
import { HamburgerIcon, LeftArrow, RightArrow } from "./Icons";

const DeckPdfNav = forwardRef(function DeckPdfNav(
  { currentPage, numPages, onNavigate, onToggleMenu },
  ref,
) {
  return (
    <div className="deck-pdf-nav" ref={ref}>
      <button
        type="button"
        className="deck-pdf-nav__menu-toggle"
        onClick={onToggleMenu}
      >
        <HamburgerIcon color="currentColor" />
      </button>

      <button
        type="button"
        className="deck-pdf-nav__prev"
        disabled={currentPage <= 1}
        onClick={() => onNavigate(currentPage - 1)}
      >
        <LeftArrow color="currentColor" />
      </button>

      <span className="deck-pdf-nav__counter font-secondary text-md">
        {currentPage} / {numPages}
      </span>

      <button
        type="button"
        className="deck-pdf-nav__next"
        disabled={currentPage >= numPages}
        onClick={() => onNavigate(currentPage + 1)}
      >
        <RightArrow color="currentColor" />
      </button>
    </div>
  );
});

export default DeckPdfNav;
