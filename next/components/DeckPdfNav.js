// next/components/DeckPdfNav.js

"use client";

const DeckPdfNav = ({ currentPage, numPages, onNavigate }) => {
  return (
    <div className="deck-pdf-nav">
      <button
        type="button"
        className="deck-pdf-nav__prev"
        disabled={currentPage <= 1}
        onClick={() => onNavigate(currentPage - 1)}
      >
        ‹
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
        ›
      </button>
    </div>
  );
};

export default DeckPdfNav;
