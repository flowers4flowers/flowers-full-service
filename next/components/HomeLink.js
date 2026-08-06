// next/components/HomeLink.js

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { UpArrow } from "./Icons";

const HomeLink = () => {
  const pathname = usePathname();

  return (
    <nav id="home-link" className="w-full px-5 lg:px-14 lg:mt-[120px] hidden lg:block">
      <div className="flex justify-center">
        {!pathname.includes("/projects") && !pathname.includes("/about") && (
          <Link href="/" className="relative flex justify-center w-full h-[250px]">
            <Image
              src="/FLOWERS-Full.svg"
              alt="FLOWERS"
              fill
              style={{ objectFit: "contain" }}
            />
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
            <UpArrow />
          </button>
        )}
      </div>
    </nav>
  );
};

export default HomeLink;
