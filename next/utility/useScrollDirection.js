// next/utility/useScrollDirection.js

"use client";

import { useEffect, useRef } from "react";
import { useAppState } from "../context";

const scrollTriggerVal = 400;

export const useScrollDirection = () => {
  const { dispatch } = useAppState();
  const prevScrollRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const latestScrollY = document.body.scrollTop;

      if (latestScrollY >= prevScrollRef.current && latestScrollY > scrollTriggerVal + 200) {
        dispatch({
          type: "SET_HIDE_NAV",
          payload: true,
        });
      } else {
        dispatch({
          type: "SET_HIDE_NAV",
          payload: false,
        });
      }

      prevScrollRef.current = latestScrollY;
    };

    document.body.addEventListener("scroll", handleScroll, { passive: true });

    return () => document.body.removeEventListener("scroll", handleScroll);
  }, [dispatch]);
};
