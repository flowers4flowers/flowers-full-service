// next/components/Footer.js

import Link from "next/link";
import Image from "next/image";
import CopyLink from "./CopyLink";

const WORDMARK_ASPECT_RATIO = 1312 / 217;
const WORDMARK_WIDTH = 1310;

const Footer = () => {
  const year = new Date().getFullYear();

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
        <Image
          src="/FLOWERS-Full.svg"
          alt="FLOWERS"
          width={WORDMARK_WIDTH}
          height={Math.round(WORDMARK_WIDTH / WORDMARK_ASPECT_RATIO)}
        />
      </div>

      <div className="flex justify-between items-center font-secondary font-bold text-sm lg:text-base">
        <span>&copy;{year}</span>
        <span>NYC</span>
      </div>
    </footer>
  );
};

export default Footer;
