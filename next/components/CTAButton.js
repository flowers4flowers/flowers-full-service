//src/components/CTAButton.js

"use client";

import { useState, useContext, useEffect } from "react";

export default function FloatingFormButton() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isWiggling, setIsWiggling] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success' | 'error'

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    console.log("Form data being sent:", data);

    try {
      console.log("Making API call to /api/send-email");
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      console.log("Response status:", response.status);
      const responseData = await response.json();
      console.log("Response data:", responseData);
      
      if (responseData.details) {
        console.log("Error details:", responseData.details);
      }

      if (response.ok) {
        console.log("Email sent successfully!");
        setSubmitStatus('success');
        // Close form after a brief delay to show success message
        setTimeout(() => {
          setIsFormOpen(false);
          setSubmitStatus(null);
        }, 2000);
      } else {
        console.error('API returned error:', responseData);
        throw new Error(responseData.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Wiggle animation effect
  useEffect(() => {
    if (isFormOpen) return; // Don't wiggle if form is open

    const wiggleInterval = setInterval(() => {
      setIsWiggling(true);
      // Stop wiggling after animation completes (0.5s)
      setTimeout(() => setIsWiggling(false), 500);
    }, 5000); // Every 5 seconds

    return () => clearInterval(wiggleInterval);
  }, [isFormOpen]);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsFormOpen(true)}
        className={`fixed bottom-6 right-6 bg-black text-white px-4 py-2 shadow-lg hover:bg-gray-800 transition-colors duration-200 z-[9999]`}
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
        {/* Mobile: Show just "F", Desktop: Show full text */}
        <span className="md:hidden">F</span>
        <span className="hidden md:inline">MAKE SOMETHING WITH FLOWERS</span>
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
              {submitStatus === 'success' && (
                <div className="p-6 bg-green-50 border-b border-green-200">
                  <p className="text-green-800 text-center">
                    ✅ Message sent successfully! We'll get back to you soon.
                  </p>
                </div>
              )}
              
              {submitStatus === 'error' && (
                <div className="p-6 bg-red-50 border-b border-red-200">
                  <p className="text-red-800 text-center">
                    ❌ Failed to send message. Please try again.
                  </p>
                </div>
              )}

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
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Sending...' : 'Send Message'}
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
      `}</style>
    </>
  );
}