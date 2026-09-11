// next/components/DeckEmbed.js

"use client";

import { useState } from "react";

const EMBED_HOST = "flowersfullservice";

function buildEmbedSrc(url) {
  if (url.startsWith("https://www.figma.com/embed")) {
    return url;
  }

  return `https://www.figma.com/embed?embed_host=${EMBED_HOST}&url=${encodeURIComponent(url)}`;
}

const DeckEmbed = ({ figmaUrl }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="deck-embed">
      <div className={`deck-embed__loader${loaded ? " is-hidden" : ""}`}>
        <p className="font-secondary text-md">Loading deck…</p>
      </div>

      <iframe
        src={buildEmbedSrc(figmaUrl)}
        className="deck-embed__frame"
        title="Deck"
        allow="fullscreen"
        allowFullScreen
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
};

export default DeckEmbed;
