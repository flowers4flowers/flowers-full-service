// next/app/(site)/layout.js

import MainNav from "../../components/MainNav";
import MobileNav from "../../components/MobileNav";
import HomeLink from "../../components/HomeLink";
import MobileMenu from "../../components/MobileMenu";
import Screensaver from "../../components/Screensaver";
import Footer from "../../components/Footer";
import Container from "../../components/Container";
import { getGlobalData } from "../../queries/layoutQuery";

export default async function SiteLayout({ children }) {
  // The layout wraps every page, so a failed fetch here must not take the
  // whole site down. Fall back to an empty nav/screensaver instead.
  const data = await getGlobalData().catch((error) => {
    console.error("SiteLayout: failed to fetch global data", error);
    return null;
  });

  const socialLinks = data?.result?.socialLinks ?? [];
  const screensaverImages = data?.result?.screensaverImages ?? [];

  return (
    <>
      <MainNav socialLinks={socialLinks} />

      <MobileNav />

      <HomeLink />

      <main><Container>{children}</Container></main>

      <Footer />

      <MobileMenu socialLinks={socialLinks} />

      {screensaverImages.length > 0 && (
        <Screensaver images={screensaverImages} />
      )}
    </>
  );
}
