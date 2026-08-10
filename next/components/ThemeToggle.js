// next/components/ThemeToggle.js

"use client";

import { useTheme } from "../context/ThemeContext";
import { useAnalytics } from "../utility/useAnalytics";

const ThemeToggle = ({ className = "" }) => {
  const { theme, toggleTheme } = useTheme();
  const { trackButton } = useAnalytics();
  const isDark = theme === "dark";

  const handleClick = () => {
    trackButton("Theme Toggle", { theme: isDark ? "light" : "dark" });
    toggleTheme();
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
      onClick={handleClick}
      className={`relative inline-flex items-center w-12 h-6 rounded-full border border-black dark:border-cream transition-colors duration-300 ${className}`}
    >
      <span
        className={`inline-block w-4 h-4 rounded-full bg-black dark:bg-cream transform transition-transform duration-300 ${
          isDark ? "translate-x-7" : "translate-x-1"
        }`}
      />
    </button>
  );
};

export default ThemeToggle;
