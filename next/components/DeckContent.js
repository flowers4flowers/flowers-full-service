// next/components/DeckContent.js

"use client";

import { useEffect } from "react";
import MediaItem from "./MediaItem";

const Heading = ({ level, text }) => {
  const Tag = /^h[1-6]$/.test(level) ? level : "h2";

  return <Tag className="deck-heading font-primary font-bold text-lg">{text}</Tag>;
};

const DeckContent = ({ layout, blocks, intro, title, client }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className={`deck deck-${layout}`}>
      {(title || client) && (
        <div className="deck-header">
          {title && <h1 className="font-primary text-xl">{title}</h1>}
          {client && (
            <p className="font-secondary text-md mt-2">{client}</p>
          )}
        </div>
      )}

      {intro && (
        <div
          className="deck-intro rich-text mt-8"
          dangerouslySetInnerHTML={{ __html: intro }}
        ></div>
      )}

      {(blocks || []).map((block, blockIndex) => {
        if (block.type === "heading") {
          return (
            <Heading
              key={blockIndex}
              level={block.level}
              text={block.text}
            />
          );
        }

        if (block.type === "text") {
          return (
            <div
              key={blockIndex}
              className="deck-text rich-text"
              dangerouslySetInnerHTML={{ __html: block.html }}
            ></div>
          );
        }

        if (block.type === "imageSection") {
          return (
            <div key={blockIndex} className="deck-section">
              {(block.media || []).map((item, itemIndex) => (
                <MediaItem
                  key={`${blockIndex}-${itemIndex}`}
                  media={item}
                />
              ))}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};

export default DeckContent;
