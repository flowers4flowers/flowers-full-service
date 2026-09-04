// next/components/DeckCover.js

const DeckCover = ({ title, client, intro }) => {
  return (
    <div className="deck-cover">
      <h1 className="deck-cover__title font-primary text-xl">{title}</h1>

      {client && (
        <p className="deck-cover__client font-secondary text-md mt-2">
          {client}
        </p>
      )}

      {intro && (
        <div
          className="deck-cover__intro rich-text mt-8"
          dangerouslySetInnerHTML={{ __html: intro }}
        ></div>
      )}
    </div>
  );
};

export default DeckCover;
