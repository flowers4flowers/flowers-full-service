// next/components/MainNavLinks.js

"use client";

import { usePathname } from "next/navigation";
import { useAppState } from "../context";
import Link from "next/link";
import { useAnalytics } from "../utility/useAnalytics";

const MainNavLinks = () => {
  const { state, dispatch } = useAppState();
  const pathname = usePathname();
  const { trackLink } = useAnalytics();

  const checkLinkActive = (link) => {
    return pathname === link;
  };

  return (
    <nav className="main-nav-links col-span-9">
      <ul className="w-full font-secondary text-base grid grid-cols-9 gap-6">
        <li className="col-span-2">
          <Link
            href="/gallery"
            className={checkLinkActive("/gallery") ? "active" : ""}
            onClick={() => trackLink("Main Nav: Gallery", "/gallery")}
          >
            <span>Gallery</span>
          </Link>
        </li>

        <li className="col-span-2">
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
      </ul>
    </nav>
  );
};

export default MainNavLinks;
