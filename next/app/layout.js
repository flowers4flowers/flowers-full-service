import "../styles/global.css";
import Script from "next/script";
import { AppWrapper } from "../context";
import MainNav from "../components/MainNav";
import MobileNav from "../components/MobileNav";
import HomeLink from "../components/HomeLink";
import MobileMenu from "../components/MobileMenu";
import Screensaver from "../components/Screensaver";
import { getGlobalData } from "../queries/layoutQuery";

/*
----------
COMPONENT LOGIC
----------
*/

export default async function RootLayout({ children }) {
  const data = await getGlobalData();

  const { socialLinks, screensaverImages } = data.result;

  return (
    <html lang="en">
      <AppWrapper>
        <body>
          <Script
            src="https://cdn.amplitude.com/script/49900a6abbaf3be1288f2fe1813d60a7.js"
            strategy="afterInteractive"
          />
          <Script
            id="amplitude-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
      // Initialize Amplitude first
      window.amplitude.init('49900a6abbaf3be1288f2fe1813d60a7', {
        "fetchRemoteConfig": true,
        "autocapture": true
      });
      
      // Add session replay after initialization
      window.amplitude.add(window.sessionReplay.plugin({sampleRate: 1}));
      
      // Send a test event to verify installation
      window.amplitude.track('Page View', {
        page: window.location.pathname,
        timestamp: new Date().toISOString()
      });
      
      console.log('Amplitude initialized and test event sent');
    `,
            }}
          />
          <MainNav socialLinks={socialLinks} />

          <MobileNav />

          <HomeLink />

          <main className="px-5 lg:px-14">{children}</main>

          <MobileMenu socialLinks={socialLinks} />

          {screensaverImages.length > 0 && (
            <Screensaver images={screensaverImages} />
          )}
        </body>
      </AppWrapper>
    </html>
  );
}

/*
----------
GET METADATA
----------
*/

export async function generateMetadata() {
  const res = await fetch(process.env.API_HOST, {
    method: "POST",
    headers: {
      Authorization: `Basic ${process.env.AUTH}`,
    },
    body: JSON.stringify({
      query: "site",
      select: {
        title: "site.title",
        description: "site.site_description",
        ogImage: "site.og_image",
      },
    }),
  }).then((res) => res.json());

  const data = res.result;

  // const ogImages = data.ogImage ? [data.ogImage] : []

  return {
    title: data.title,
    description: data.description ? data.description : data.title,
    // openGraph: {
    //   images: ogImages
    // }
  };
}
