import "../styles/global.css";
import Script from "next/script";
import { GoogleAnalytics } from '@next/third-parties/google'
import { AppWrapper } from "../context";
import MainNav from "../components/MainNav";
import MobileNav from "../components/MobileNav";
import HomeLink from "../components/HomeLink";
import MobileMenu from "../components/MobileMenu";
import Screensaver from "../components/Screensaver";
import { getGlobalData } from "../queries/layoutQuery";
import AnalyticsPageTracker from "../components/AnalyticsPageTracker";

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
      <head>
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-YSM33VGFQP"
        ></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-YSM33VGFQP');
    `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-TNKNK842');`,
          }}
        />
      </head>
      <AppWrapper>
        <body>
          <GoogleAnalytics gaId="G-YSM33VGFQP" />
          <AnalyticsPageTracker />
          {/* Google Tag Manager - Body (noscript) */}
          <noscript>
            <iframe
              src="https://www.googletagmanager.com/ns.html?id=GTM-TNKNK842"
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>

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
