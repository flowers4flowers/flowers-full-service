// next/components/CopyLink.js

"use client";

import { useState } from "react";

const CopyLink = ({ title, url, className }) => {
  const [copied, setCopied] = useState(false);

  // remove mailto from url
  url = url.replace("mailto:", "");

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 1000);
  };

  return (
    <button
      onClick={copy}
      className={`lg:hover:opacity-50 transition-opacity duration-300 ${className}`}
    >
      {copied ? "Copied!" : title}
    </button>
  );
};

export default CopyLink;
