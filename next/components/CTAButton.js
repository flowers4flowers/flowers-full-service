// next/components/CTAButton.js

"use client";

import { useState, useContext, useEffect } from "react";

export default function FloatingFormButton() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isWiggling, setIsWiggling] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    // Handle form submission here
    console.log("Form submitted:", data);

    // Close form after submission
    setIsFormOpen(false);

    // You can add your form submission logic here
    // For example: send to API, show success message, etc.
  };

  // Wiggle animation effect
  useEffect(() => {
    if (isFormOpen) return; // Don't wiggle if form is open

    const wiggleInterval = setInterval(() => {
      setIsWiggling(true);
      // Stop wiggling after animation completes (0.5s)
      setTimeout(() => setIsWiggling(false), 500);
    }, 5000); // Every 7 seconds

    return () => clearInterval(wiggleInterval);
  }, [isFormOpen]);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsFormOpen(true)}
        className={`fixed bottom-6 right-6 bg-black text-white px-4 py-2 shadow-lg hover:bg-gray-800 transition-colors duration-200 z-[9999] ${
          isWiggling ? "animate-wiggle" : ""
        }`}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          backgroundColor: "black",
          color: "white",
          padding: "8px 16px",
          borderRadius: "0px",
          border: "none",
          cursor: "pointer",
          fontSize: "14px",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          fontFamily: "LetterGothicMT, sans-serif",
        }}
      >
        MAKE SOMETHING WITH FLOWERS
      </button>

      {/* Form Popup */}
      {isFormOpen && (
        <>
          {/* Backdrop for closing when clicking outside */}
          <div
            className="fixed inset-0 z-[9998] bg-black bg-opacity-50 md:bg-transparent"
            onClick={() => setIsFormOpen(false)}
          />

          {/* Form - centered on mobile, positioned by button on desktop */}
          <div
            className="fixed bg-white shadow-xl z-[10000] 
                       /* Mobile: centered and full width with margins */
                       left-4 right-4 top-1/2 -translate-y-1/2
                       /* Desktop: positioned by button */
                       md:left-auto md:right-6 md:top-auto md:bottom-20 md:translate-y-0 md:w-[500px]"
            style={{
              zIndex: 10000,
              maxHeight: "calc(100vh - 120px)", // Prevent overflow
              overflow: "hidden",
            }}
          >
            {/* Form Header */}
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                Get in touch
              </h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Form Content */}
            <div className="max-h-[600px] overflow-y-auto">
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="company"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Company *
                  </label>
                  <input
                    type="text"
                    id="company"
                    name="company"
                    required
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Your company name"
                  />
                </div>

                <div>
                  <label
                    htmlFor="role"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Role *
                  </label>
                  <input
                    type="text"
                    id="role"
                    name="role"
                    required
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Your job title/role"
                  />
                </div>

                <div>
                  <label
                    htmlFor="challenge"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Creative Challenge *
                  </label>
                  <textarea
                    id="challenge"
                    name="challenge"
                    required
                    rows="4"
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                    placeholder="Tell us about your creative challenge or project..."
                  />
                </div>

                <div>
                  <label
                    htmlFor="timeline"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Timeline *
                  </label>
                  <select
                    id="timeline"
                    name="timeline"
                    required
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select your timeline</option>
                    <option value="asap">ASAP (Within 2 weeks)</option>
                    <option value="this-month">This Month</option>
                    <option value="next-month">Next Month</option>
                    <option value="next-quarter">
                      Next Quarter (3 months)
                    </option>
                    <option value="next-6-months">Next 6 Months</option>
                    <option value="planning-ahead">
                      Planning Ahead (6+ months)
                    </option>
                    <option value="exploring">Just Exploring Options</option>
                  </select>
                </div>

                {/* Form Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors duration-200"
                  >
                    Send Message
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Custom CSS for wiggle animation and font loading */}
      <style jsx>{`
        @font-face {
          font-family: "LetterGothicMT";
          src: url("/LetterGothicMTStd.woff2") format("woff2");
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }

        @keyframes wiggle {
          0%,
          100% {
            transform: rotate(0deg) scale(1);
          }
          25% {
            transform: rotate(-3deg) scale(1.1);
          }
          75% {
            transform: rotate(3deg) scale(1);
          }
        }

        .animate-wiggle {
          animation: wiggle 0.5s ease-in-out;
        }
      `}</style>
    </>
  );
}
