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
  const data = await getGlobalData();

  const { socialLinks, screensaverImages } = data.result;

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
