// next/components/DeckPdfNav.js

"use client";

import { forwardRef } from "react";
import { LeftArrow, RightArrow } from "./Icons";

const DeckPdfNav = forwardRef(({ currentPage, numPages, onNavigate }, ref) => {
  return (
    <div className="deck-pdf-nav" ref={ref}>
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
