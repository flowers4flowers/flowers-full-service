// next/components/MobileNav.js

"use client";

import { useAppState } from "../context";

const MobileNav = () => {
  const { state, dispatch } = useAppState();

  return (
    <header
      id="mobile-nav"
      className="fixed bottom-0 left-0 w-full bg-cream flex lg:hidden justify-center items-center py-6 px-5"
    >
      <button
        onClick={() => {
          dispatch({
            type: "SET_MOBILE_MENU_OPEN",
            payload: true,
          });
        }}
        className="text-md font-secondary text-center"
      >
        Menu
      </button>
    </header>
  );
};

export default MobileNav;
