// next/components/DeckPdfViewer.js

"use client";

import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import DeckPdfNav from "./DeckPdfNav";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

const DeckPdfViewer = ({ pdfUrl }) => {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 800,
    height: typeof window !== "undefined" ? window.innerHeight : 600,
  }));
  const [pageAspectRatio, setPageAspectRatio] = useState(null);

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fitWidth = pageAspectRatio
    ? Math.min(viewportSize.width, viewportSize.height * pageAspectRatio)
    : 800;

  return (
    <div className="deck-pdf-viewer">
      <Document
        file={pdfUrl}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        onLoadError={(error) => console.error("PDF load failed:", error)}
        loading={<p className="font-secondary text-md">Loading deck…</p>}
      >
        {numPages && (
          <Page
            pageNumber={currentPage}
            width={fitWidth}
            onLoadSuccess={(page) => {
              if (pageAspectRatio === null) {
                setPageAspectRatio(page.originalWidth / page.originalHeight);
              }
            }}
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
