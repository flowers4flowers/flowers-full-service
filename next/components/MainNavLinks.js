// next/components/MainNavLinks.js

"use client";

import { usePathname } from "next/navigation";
import { useAppState } from "../context";
import Link from "next/link";
import { Fragment } from "react";
import { useAnalytics } from "../utility/useAnalytics";


const MainNavLinks = () => {
  const { state, dispatch } = useAppState();
  const pathname = usePathname();
  const { trackLink } = useAnalytics();

  const checkLinkActive = (link) => {
    return pathname === link;
  };

  return (
    <Fragment>
      <Link
        href="/gallery"
        onClick={() => trackLink("Main Nav: Gallery", "/gallery")}
      >
        <span>Gallery</span>
      </Link>

      <Link
        href="https://shop.flowersfullservice.art/"
        target="_blank"
        onClick={() =>
          trackLink("Main Nav: Shop", "https://shop.flowersfullservice.art/")
        }
      >
        <span>Shop</span>
      </Link>
      <Link
        href="/about"
        onClick={() => trackLink("Main Nav: About", "/about")}
      >
        <span>About</span>
      </Link>

      
    </Fragment>
  );
};

export default MainNavLinks;
