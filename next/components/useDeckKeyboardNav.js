// next/components/useDeckKeyboardNav.js

"use client";

import { useEffect } from "react";

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown", " ", "Spacebar"]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

const useDeckKeyboardNav = ({ currentPage, numPages, onNavigate, enabled = true }) => {
  useEffect(() => {
    if (!enabled || !numPages) {
      return;
    }

    const handleKeyDown = (event) => {
      let next;

      if (NEXT_KEYS.has(event.key)) {
        next = Math.min(currentPage + 1, numPages);
      } else if (PREV_KEYS.has(event.key)) {
        next = Math.max(currentPage - 1, 1);
      } else {
        return;
      }

      event.preventDefault();

      if (next !== currentPage) {
        onNavigate(next);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, numPages, onNavigate, enabled]);
};

export default useDeckKeyboardNav;
