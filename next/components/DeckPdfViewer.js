// next/components/DeckPdfViewer.js

"use client";

import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import DeckPdfNav from "./DeckPdfNav";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

const DOCUMENT_OPTIONS = {
  rangeChunkSize: 1024 * 1024,
  disableAutoFetch: true,
  disableStream: false,
};

const DeckPdfViewer = ({ pdfUrl }) => {
  const [pdfProxy, setPdfProxy] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!pdfProxy) {
      return;
    }

    if (currentPage + 1 <= numPages) {
      pdfProxy.getPage(currentPage + 1);
    }

    if (currentPage - 1 >= 1) {
      pdfProxy.getPage(currentPage - 1);
    }
  }, [pdfProxy, currentPage, numPages]);

  return (
    <div className="deck-pdf-viewer">
      <Document
        file={pdfUrl}
        options={DOCUMENT_OPTIONS}
        onLoadSuccess={(pdf) => {
          setPdfProxy(pdf);
          setNumPages(pdf.numPages);
        }}
        onLoadError={(error) => console.error("PDF load failed:", error)}
        loading={<p className="font-secondary text-md">Loading deck…</p>}
      >
        {numPages && (
          <Page
            pageNumber={currentPage}
            loading={<p className="font-secondary text-md">Loading page…</p>}
          />
        )}
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
