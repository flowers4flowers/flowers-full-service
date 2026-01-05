

// next/components/InfoContent.js

'use client'

import { useAppState } from "../context";
import classNames from "classnames";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import DefImage from "./DefImage";
import { useAnalytics } from "../utility/useAnalytics";

const clientLinks = {
  AG1: "/projects/ag-evergreen",
  Airbnb: "/projects/morocco-airbnb",
  Chase: "/work",
  "Delta Air Lines": "/projects/delta-air-lines",
  "EA Sports": "/projects/nhl-24",
  Expedia: "/work",
  "Goldman Sachs": "/work",
  Google: "/work",
  IBM: "/projects/ibm-yorktown",
  Nike: "/work",
  Meta: "/work",
  Pentagram: "/work",
  On: "/work",
  Sonos: "/work",
  Spotify: "/work",
  Square: "/work",
  "Stella Artois": "/projects/beckham-taste-worth-more",
  "Wieden+Kennedy": "/work",
  Volvo: "/projects/ex90-sop",
  Uber: "/work",
};

// Client logo images
const clientLogos = [
  { name: "StellaOOH", src: "/info/FLOWERSfullservice_StellaOOH.png" },
  { name: "AG1_1", src: "/info/FLOWERSfullservice_AG1_1.png" },
  { name: "AG1_2", src: "/info/FLOWERSfullservice_AG1_2.png" },
  { name: "Beckham", src: "/info/FLOWERSfullservice_Beckham.png" },
  { name: "BwayLaf", src: "/info/FLOWERSfullservice_BwayLaf.png" },
  {
    name: "Expediawilliamsburg",
    src: "/info/FLOWERSfullservice_Expediawilliamsburg.png",
  },
  { name: "IBMnext", src: "/info/FLOWERSfullservice_IBMnext.png" },
];

const InfoContent = () => {
  const { trackLink } = useAnalytics();
  const [copied, setCopied] = useState(false);
  const [visibleImages, setVisibleImages] = useState(new Set());
  const imageRefs = useRef([]);

  const handleClientClick = (clientName, url) => {
    trackLink(`Client: ${clientName}`, url);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText("idea@flowersfullservice.art");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = parseInt(entry.target.getAttribute("data-index"));
          if (entry.isIntersecting) {
            setVisibleImages((prev) => new Set([...prev, index]));
          } else {
            // Optional: Remove from visible set when out of view if you want images to fade out again
            // setVisibleImages(prev => {
            //   const newSet = new Set(prev);
            //   newSet.delete(index);
            //   return newSet;
            // });
          }
        });
      },
      {
        threshold: 0.2, // Trigger when 20% of the image is visible
        rootMargin: "0px 0px -100px 0px", // Start animation 100px before the image enters viewport
      }
    );

    // Clean up refs array to match clientLogos length
    imageRefs.current = imageRefs.current.slice(0, clientLogos.length);

    imageRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      imageRefs.current.forEach((ref) => {
        if (ref) observer.unobserve(ref);
      });
    };
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Main content spread across full page */}
      <div className="w-full px-8 lg:px-16 xl:px-24">
        <div className="grid grid-cols-12 gap-8 lg:gap-16 xl:gap-24">
          {/* Column 1 - Main description with better hierarchy - Made smaller */}
          <div className="col-span-12 lg:col-span-4 space-y-8">
            <div className="space-y-6">
              <p className="text-xl lg:text-3xl xl:text-4xl leading-relaxed font-light pb-8">
                FLOWERS is a creative studio and full-service production company
                based in New York, operating globally.
              </p>

              <div className="pl-8 space-y-12 text-lg font-secondary">
                <p>We take ideas from</p>

                <div className="space-y-3 text-lg italic">
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-black rounded-full mr-4"></span>
                    <span>napkin sketch → billboard</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-black rounded-full mr-4"></span>
                    <span>folder → published photobook</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-black rounded-full mr-4"></span>
                    <span>conversation → brand world</span>
                  </div>
                </div>

                <p className="text-lg">and see them through,</p>
                <p className="text-lg font-medium">from start to finish.</p>
              </div>
            </div>
            <div className="p-6">
              <h3 className="text-xxl uppercase tracking-widest mb-4">
                Drop us a line
              </h3>
              <div className="space-y-2 text-xl font-secondary">
                <p
                  onClick={copyToClipboard}
                  className="cursor-pointer hover:underline transition-all duration-200"
                >
                  {copied ? "Email Copied" : "idea@flowersfullservice.art"}
                </p>

                <p>
                  <a
                    href="https://www.instagram.com/flowersfullservice/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    @flowersfullservice.art
                  </a>
                </p>
                <p>
                  <a
                    href="https://instagram.com/caitoppermann"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    @caitoppermann
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Column 2 - Services in a more structured way */}
          <div className="col-span-12 lg:col-span-4 space-y-12">
            <div>
              <h3 className="text-lg uppercase tracking-widest mb-6 border-b border-b-gray-200 pb-2">
                Our Expertise
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {[
                  "Creative Direction",
                  "Art Direction",
                  "Photography",
                  "Film & Video",
                  "Campaign Development",
                  "Brand Strategy",
                  "Creative Production",
                  "Experience Design",
                  "Curation",
                  "Consulting",
                  "Building & Ideation",
                  "Research & Development",
                ].map((service, index) => (
                  <div key={index} className="flex items-center py-1">
                    <span className="text-m font-secondary">{service}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Column 3 - Clients in a more dynamic layout */}
          <div className="col-span-12 lg:col-span-4">
            <h3 className="text-lg uppercase tracking-widest mb-6 border-b border-b-gray-200 pb-2">
              Select Clients
            </h3>
            <div className="space-y-1">
              {Object.entries(clientLinks).map(([client, url], index) => {
                // Check if the URL is "/work" to determine if it should be a link
                const isWorkLink = url === "/work";

                if (isWorkLink) {
                  // Render as non-clickable text for /work links
                  return (
                    <div
                      key={index}
                      className="block py-2 border-b border-b-gray-200 last:border-b-0 px-2 -mx-2"
                      style={{ borderBottomColor: "#C0C0C0" }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-m font-secondary">{client}</span>
                      </div>
                    </div>
                  );
                } else {
                  // Render as clickable link for other URLs with tracking
                  return (
                    <Link
                      key={index}
                      href={url}
                      onClick={() => handleClientClick(client, url)} // ADD THIS LINE
                      className="block py-2 border-b border-b-gray-100 last:border-b-0 hover:bg-gray-100 transition-colors duration-200 px-2 -mx-2"
                      style={{ borderBottomColor: "#C0C0C0" }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-m font-secondary">{client}</span>
                        <span className="text-xs text-gray-400">→</span>
                      </div>
                    </Link>
                  );
                }
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Client Logos Column - Fixed fade-in animation */}
      <div className="w-full px-8 lg:px-16 xl:px-24 mt-16 mb-8">
        <div className="flex flex-col space-y-10">
          {clientLogos.map((logo, index) => (
            <div
              key={index}
              ref={(el) => (imageRefs.current[index] = el)}
              data-index={index}
              className={`flex items-center justify-center p-4 cursor-pointer transition-all duration-1000 ease-out transform ${
                visibleImages.has(index)
                  ? "opacity-100 translate-y-0 scale-100"
                  : "opacity-0 translate-y-12 scale-95"
              }`}
            >
              <img
                src={logo.src}
                alt={logo.name}
                className="max-w-full object-contain"
                style={{ maxHeight: "500px" }}
                loading="lazy" // Add lazy loading for better performance
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InfoContent;
