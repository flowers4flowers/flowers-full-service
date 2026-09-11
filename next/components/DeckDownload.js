// next/components/DeckDownload.js

function sanitiseFilename(title) {
  const cleaned = (title || "").trim().replace(/[\\/:*?"<>|]/g, "-");

  return `${cleaned || "Deck"}.pdf`;
}

const DeckDownload = ({ pdfUrl, title }) => {
  return (
    <a href={pdfUrl} download={sanitiseFilename(title)} className="deck-download">
      <span className="uppercase font-primary font-bold text-md">
        Download PDF
      </span>
    </a>
  );
};

export default DeckDownload;
