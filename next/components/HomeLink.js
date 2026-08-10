// next/components/HomeLink.js

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "../context/ThemeContext";
import { UpArrow, FlowersFullLogo } from "./Icons";

const HomeLink = () => {
  const pathname = usePathname();
  const { theme } = useTheme();
  const iconColor = theme === "dark" ? "#EEEBE6" : "black";

  return (
    <nav id="home-link" className="w-full px-5 lg:px-14 lg:mt-[120px] hidden lg:block">
      <div className="flex justify-center">
        {!pathname.includes("/projects") && !pathname.includes("/about") && (
          <Link href="/" className="relative flex justify-center w-full h-[250px]">
            <FlowersFullLogo color={iconColor} className="w-full h-full" />
          </Link>
        )}

        {pathname.includes("/projects") && (
          <button
            className="caption lg:hidden absolute top-[16px] right-5 lg:right-14 text-lg font-secondary lg:hover:opacity-50 transition-opacity duration-300"
            onClick={() => {
              window.scrollTo({
                top: 0,
                behavior: "smooth",
              });
            }}
          >
            <UpArrow color={iconColor} />
          </button>
        )}
      </div>
    </nav>
  );
};

export default HomeLink;
