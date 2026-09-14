// next/components/DeckPdfMenu.js

"use client";

import { useEffect, useRef } from "react";
import { CloseX } from "./Icons";

const DeckPdfMenu = ({ isOpen, numPages, currentPage, onNavigate, onClose }) => {
  const activeItemRef = useRef(null);

  useEffect(() => {
    if (isOpen && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: "center" });
    }
  }, [isOpen, currentPage]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="deck-pdf-menu-backdrop" onClick={onClose}>
      <div
        className="deck-pdf-menu"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="deck-pdf-menu__close"
          onClick={onClose}
        >
          <CloseX color="currentColor" />
        </button>

        <ul className="deck-pdf-menu__list">
          {Array.from({ length: numPages }, (_, index) => index + 1).map(
            (page) => {
              const isActive = page === currentPage;
              return (
                <li key={page}>
                  <button
                    type="button"
                    ref={isActive ? activeItemRef : null}
                    className={
                      isActive
                        ? "deck-pdf-menu__item deck-pdf-menu__item--active"
                        : "deck-pdf-menu__item"
                    }
                    onClick={() => {
                      onNavigate(page);
                      onClose();
                    }}
                  >
                    {page}
                  </button>
                </li>
              );
            },
          )}
        </ul>
      </div>
    </div>
  );
};

export default DeckPdfMenu;
