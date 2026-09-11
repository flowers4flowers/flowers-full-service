// next/components/DeckDownload.js

import { sanitiseFilename } from "../utility/filename";

const DeckDownload = ({ token, pdfUrl, title }) => {
  return (
    <a
      href={`/portal/${token}/pdf`}
      download={sanitiseFilename(title)}
      className="deck-download"
    >
      <span className="uppercase font-primary font-bold text-md">
        Download PDF
      </span>
    </a>
  );
};

export default DeckDownload;
