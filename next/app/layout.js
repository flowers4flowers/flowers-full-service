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
          {/* Google Tag Manager - Body (noscript) */}
          <noscript>
            <iframe
              src="https://www.googletagmanager.com/ns.html?id=GTM-TNKNK842"
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>

          <Script
            src="https://cdn.amplitude.com/script/49900a6abbaf3be1288f2fe1813d60a7.js"
            strategy="afterInteractive"
          />
          <Script
            id="amplitude-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
      // Wait for Amplitude to be available
      function initAmplitude() {
        if (typeof window !== 'undefined' && window.amplitude && window.amplitude.init) {
          try {
            // Initialize Amplitude
            window.amplitude.init('49900a6abbaf3be1288f2fe1813d60a7', {
              "fetchRemoteConfig": true,
              "autocapture": true
            });
            
            // Add session replay after initialization
            if (window.sessionReplay && window.sessionReplay.plugin) {
              window.amplitude.add(window.sessionReplay.plugin({sampleRate: 1}));
            }
            
            // Send a test event to verify installation
            window.amplitude.track('Page View', {
              page: window.location.pathname,
              timestamp: new Date().toISOString()
            });
            
            console.log('✅ Amplitude initialized successfully');
          } catch (error) {
            console.error('❌ Amplitude initialization failed:', error);
          }
        } else {
          // If Amplitude isn't ready, try again in 100ms
          setTimeout(initAmplitude, 100);
        }
      }
      
      // Start trying to initialize
      initAmplitude();
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
