// next/components/HomeLink.js

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "../context/ThemeContext";
import { UpArrow, FlowersFullLogo } from "./Icons";
import Container from "./Container";

const HomeLink = () => {
  const pathname = usePathname();
  const { theme } = useTheme();
  const iconColor = theme === "dark" ? "#EEEBE6" : "black";

  return (
    <Container as="nav" id="home-link" className="lg:mt-[120px]">
      <div className="flex justify-center">
        {!pathname.includes("/projects") && !pathname.includes("/about") && (
          <Link href="/" className="relative flex justify-center w-full h-[80px] lg:h-[250px] mt-24 lg:mt-0">
            <FlowersFullLogo color={iconColor} className="w-full h-full" />
          </Link>
        )}

        {pathname.includes("/projects") && (
          <button
            className="caption lg:hidden absolute top-24 right-5 lg:top-[16px] lg:right-14 text-lg font-secondary lg:hover:opacity-50 transition-opacity duration-300"
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
    </Container>
  );
};

export default HomeLink;
