// next/components/Footer.js

"use client";

import Link from "next/link";
import CopyLink from "./CopyLink";
import { FlowersFullLogo } from "./Icons";
import { useTheme } from "../context/ThemeContext";

const Footer = () => {
  const year = new Date().getFullYear();
  const { theme } = useTheme();

  return (
    <footer id="site-footer" className="px-5 lg:px-14 py-5 lg:py-10">
      <div className="flex justify-between items-start font-secondary font-bold text-sm lg:text-base">
        <ul className="flex flex-col">
          <li>
            <Link
              href="https://www.instagram.com/flowersfullservice/"
              target="_blank"
              className="lg:hover:opacity-50 transition-opacity duration-300"
            >
              IG
            </Link>
          </li>

          <li>
            <Link
              href="https://youtu.be/nxyKLUwG1g4?si=UBM-Xtziblg3kcRX"
              target="_blank"
              className="lg:hover:opacity-50 transition-opacity duration-300"
            >
              YOUTUBE
            </Link>
          </li>

          <li>
            <Link
              href="https://fl0wers.substack.com"
              target="_blank"
              className="lg:hover:opacity-50 transition-opacity duration-300"
            >
              SUBSTACK
            </Link>
          </li>
        </ul>

        <CopyLink title="Contact" url="mailto:studio@flowersfullservice.art" />
      </div>

      <div className="wordmark">
        <FlowersFullLogo color={theme === "dark" ? "cream" : "black"} className="w-full h-auto" />
      </div>

      <div className="flex justify-between items-center font-secondary font-bold text-sm lg:text-base">
        <span>&copy;{year}</span>
        <span>NYC</span>
      </div>
    </footer>
  );
};

export default Footer;
