// next/app/layout.js

import "../styles/global.css";
import Script from "next/script";
import { GoogleAnalytics } from "@next/third-parties/google";
import { AppWrapper } from "../context";
import { ThemeProvider } from "../context/ThemeContext";
import MainNav from "../components/MainNav";
import MobileNav from "../components/MobileNav";
import HomeLink from "../components/HomeLink";
import MobileMenu from "../components/MobileMenu";
import Screensaver from "../components/Screensaver";
import Footer from "../components/Footer";
import Container from "../components/Container";
import { getGlobalData } from "../queries/layoutQuery";
import AnalyticsPageTracker from "../components/AnalyticsPageTracker";

export const metadata = {
  metadataBase: new URL("https://www.flowersfullservice.art"),
  title: "FLOWERS Studio",
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
  description:
    "Full-service commercial photography studio led by Cait Oppermann. Creative direction, photography, and production for brands and agencies. Based in New York, working globally.",
  openGraph: {
    title: "FLOWERS Studio",
    description:
      "Full-service commercial photography studio led by Cait Oppermann. Creative direction, photography, and production for brands and agencies.",
    url: "https://www.flowersfullservice.art",
    siteName: "FLOWERS",
    images: [
      {
        url: "https://www.flowersfullservice.art/CaitOppermann_03_06_GQ_HugoMcCloud_DSC3500.jpg",
        width: 1200,
        height: 630,
        alt: "FLOWERS — Commercial Photography Studio, NYC",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "FLOWERS Studio",
    description:
      "Full-service commercial photography studio led by Cait Oppermann. Creative direction, photography, and production for brands and agencies.",
    images: ["https://www.flowersfullservice.art/CaitOppermann_03_06_GQ_HugoMcCloud_DSC3500.jpg"],
  },
};

export default async function RootLayout({ children }) {
  const data = await getGlobalData();

  const { socialLinks, screensaverImages } = data.result;

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `try {
      var stored = localStorage.getItem('theme');
      var isDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', isDark);
    } catch (e) {}`,
          }}
        />
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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "vioyjktsk2");`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "FLOWERS Everywhere LLC",
              alternateName: "FLOWERS",
              url: "https://www.flowersfullservice.art",
              logo: "https://www.flowersfullservice.art/CaitOppermann_03_06_GQ_HugoMcCloud_DSC3500.jpg",
              description:
                "Full-service commercial photography studio and creative direction, led by Cait Oppermann. Based in New York.",
              foundingDate: "2012",
              sameAs: [
                "https://www.instagram.com/flowersfullservice/",
                "https://www.linkedin.com/company/flowersfullservice/",
              ],
              contactPoint: {
                "@type": "ContactPoint",
                email: "studio@flowersfullservice.art",
                contactType: "Business Inquiries",
              },
              address: {
                "@type": "PostalAddress",
                addressLocality: "Brooklyn",
                addressRegion: "NY",
                addressCountry: "US",
              },
              hasOfferCatalog: {
                "@type": "OfferCatalog",
                name: "FLOWERS Studio Services",
                itemListElement: [
                  {
                    "@type": "Offer",
                    itemOffered: {
                      "@type": "Service",
                      name: "Commercial Photography",
                    },
                  },
                  {
                    "@type": "Offer",
                    itemOffered: {
                      "@type": "Service",
                      name: "Video & Film Production",
                    },
                  },
                  {
                    "@type": "Offer",
                    itemOffered: {
                      "@type": "Service",
                      name: "Creative Direction",
                    },
                  },
                  {
                    "@type": "Offer",
                    itemOffered: { "@type": "Service", name: "Art Direction" },
                  },
                  {
                    "@type": "Offer",
                    itemOffered: {
                      "@type": "Service",
                      name: "Strategy & Concept Development",
                    },
                  },
                  {
                    "@type": "Offer",
                    itemOffered: {
                      "@type": "Service",
                      name: "Full-Service Production",
                    },
                  },
                  {
                    "@type": "Offer",
                    itemOffered: {
                      "@type": "Service",
                      name: "Location Scouting",
                    },
                  },
                  {
                    "@type": "Offer",
                    itemOffered: { "@type": "Service", name: "Casting" },
                  },
                ],
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Person",
              name: "Cait Oppermann",
              jobTitle: "Commercial Photographer & Creative Director",
              url: "https://www.flowersfullservice.art",
              sameAs: [
                "https://www.instagram.com/flowersfullservice/",
                "https://www.linkedin.com/company/flowersfullservice/",
              ],
              worksFor: {
                "@type": "Organization",
                name: "FLOWERS Everywhere LLC",
              },
              knowsAbout: [
                "Commercial Photography",
                "Creative Direction",
                "Art Direction",
                "Advertising Photography",
                "Video Production",
                "Location Scouting",
                "Casting",
                "Full-Service Production",
              ],
            }),
          }}
        />
      </head>
      <ThemeProvider>
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

          <main><Container>{children}</Container></main>

          <Footer />

          <MobileMenu socialLinks={socialLinks} />

          {screensaverImages.length > 0 && (
            <Screensaver images={screensaverImages} />
          )}
        </body>
      </AppWrapper>
      </ThemeProvider>
    </html>
  );
}
