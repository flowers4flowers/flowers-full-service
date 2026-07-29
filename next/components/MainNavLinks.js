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
      <li>
        <Link
          href="/gallery"
          className={checkLinkActive("/gallery") ? "active" : ""}
          onClick={() => trackLink("Main Nav: Gallery", "/gallery")}
        >
          <span>Gallery</span>
        </Link>
      </li>

      <li>
        <Link
          href="https://shop.flowersfullservice.art/"
          target="_blank"
          onClick={() =>
            trackLink("Main Nav: Shop", "https://shop.flowersfullservice.art/")
          }
        >
          <span>Shop</span>
        </Link>
      </li>
    </Fragment>
  );
};

export default MainNavLinks;
