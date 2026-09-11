// next/app/(portal)/layout.js

import Image from "next/image";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function PortalLayout({ children }) {
  return (
    <div className="portal-shell min-h-screen">
      <header className="py-8 px-6">
        <Image
          src="/FLOWERS.png"
          alt="FLOWERS"
          width={50}
          height={40}
          className="dark:invert"
        />
      </header>

      <div className="portal-content pb-24">{children}</div>
    </div>
  );
}
