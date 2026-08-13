// next/utility/useScrollDirection.js

"use client";

import { useMotionValueEvent, useScroll } from "framer-motion";
import { useState } from "react";
import { useAppState } from "../context";

const scrollTriggerVal = 400;

export const useScrollDirection = () => {
  const { dispatch } = useAppState();
  const { scrollY } = useScroll();
  const [prevScroll, setPrevScroll] = useState(0);

  useMotionValueEvent(scrollY, "change", (latestScrollY) => {
    if (latestScrollY >= prevScroll && latestScrollY > scrollTriggerVal + 200) {
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

    setPrevScroll(latestScrollY);
  });
};
