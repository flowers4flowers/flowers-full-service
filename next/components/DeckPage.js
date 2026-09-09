// next/components/DeckPage.js

import MediaItem from "./MediaItem";

const renderBlocks = (blocks) =>
  (blocks || []).map((block, index) => {
    if (block.type === "heading") {
      const Tag = /^h[1-6]$/.test(block.level) ? block.level : "h2";

      return (
        <Tag key={index} className="deck-page__heading font-primary font-bold text-lg">
          {block.text}
        </Tag>
      );
    }

    if (block.type === "text") {
      return (
        <div
          key={index}
          className="deck-page__text rich-text"
          dangerouslySetInnerHTML={{ __html: block.html }}
        ></div>
      );
    }

    return null;
  });

const MediaColumn = ({ media, sizes }) => {
  const hasMedia = media && (media.media || media.videoMp4 || media.vimeoUrl);

  return (
    <div className="deck-page__media-col">
      {hasMedia && <MediaItem media={media} priority sizes={sizes} />}
    </div>
  );
};

const DeckPage = ({ layout, media, blocks }) => {
  if (layout === "full-image") {
    return (
      <div className="deck-page deck-page--full-image">
        <MediaColumn media={media} sizes="100vw" />
      </div>
    );
  }

  if (layout === "left-image" || layout === "right-image") {
    return (
      <div className={`deck-page deck-page--${layout}`}>
        <MediaColumn media={media} sizes="(min-width: 1024px) 50vw, 100vw" />

        <div className="deck-page__text-col">{renderBlocks(blocks)}</div>
      </div>
    );
  }

  return (
    <div className="deck-page deck-page--full-text">
      <div className="deck-page__text-col">{renderBlocks(blocks)}</div>
    </div>
  );
};

export default DeckPage;
