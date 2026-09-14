// next/components/DeckPdfMenu.js

"use client";

import { useEffect, useRef, useState } from "react";
import { CloseX } from "./Icons";
import DeckPdfMenuItem from "./DeckPdfMenuItem";

const DeckPdfMenu = ({ isOpen, numPages, currentPage, onNavigate, onClose, pdf }) => {
  const activeItemRef = useRef(null);
  const panelRef = useRef(null);
  const [hasOpenedMenu, setHasOpenedMenu] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setHasOpenedMenu(true);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: "center" });
    }
  }, [isOpen, currentPage]);

  if (!hasOpenedMenu) {
    return null;
  }

  return (
    <div
      className={
        isOpen
          ? "deck-pdf-menu-backdrop deck-pdf-menu-backdrop--open"
          : "deck-pdf-menu-backdrop"
      }
      onClick={onClose}
    >
      <div
        className={isOpen ? "deck-pdf-menu deck-pdf-menu--open" : "deck-pdf-menu"}
        ref={panelRef}
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
            (page) => (
              <DeckPdfMenuItem
                key={page}
                pdf={pdf}
                pageNumber={page}
                isActive={page === currentPage}
                activeItemRef={activeItemRef}
                scrollRoot={panelRef}
                onSelect={() => {
                  onNavigate(page);
                  onClose();
                }}
              />
            ),
          )}
        </ul>
      </div>
    </div>
  );
};

export default DeckPdfMenu;
