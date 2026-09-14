// next/components/DeckPdfViewer.js

"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import DeckPdfNav from "./DeckPdfNav";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

const DeckPdfViewer = ({ pdfUrl }) => {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  return (
    <div className="deck-pdf-viewer">
      <Document
        file={pdfUrl}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        onLoadError={(error) => console.error("PDF load failed:", error)}
        loading={<p className="font-secondary text-md">Loading deck…</p>}
      >
        {numPages && <Page pageNumber={currentPage} />}
      </Document>

      {numPages && (
        <DeckPdfNav
          currentPage={currentPage}
          numPages={numPages}
          onNavigate={setCurrentPage}
        />
      )}
    </div>
  );
};

export default DeckPdfViewer;
