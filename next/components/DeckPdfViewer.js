// next/components/DeckPdfViewer.js

"use client";

import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import DeckPdfNav from "./DeckPdfNav";
import DeckPdfMenu from "./DeckPdfMenu";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

const DOCUMENT_OPTIONS = {
  rangeChunkSize: 1024 * 1024,
  disableAutoFetch: true,
  disableStream: false,
};

const getViewportSize = () =>
  typeof window === "undefined"
    ? { width: 0, height: 0 }
    : { width: window.innerWidth, height: window.innerHeight };

const DeckPdfViewer = ({ pdfUrl }) => {
  const [pdfProxy, setPdfProxy] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewportSize, setViewportSize] = useState(getViewportSize);
  const [navHeight, setNavHeight] = useState(0);
  const [pageAspectRatio, setPageAspectRatio] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef(null);

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

  useEffect(() => {
    const measureNavHeight = () => {
      setNavHeight(navRef.current?.offsetHeight ?? 0);
    };

    const handleResize = () => {
      setViewportSize(getViewportSize());
      measureNavHeight();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setNavHeight(navRef.current?.offsetHeight ?? 0);
  }, [numPages]);

  const availableHeight = Math.max(viewportSize.height - navHeight, 0);
  const fitWidth = pageAspectRatio
    ? Math.min(viewportSize.width, availableHeight * pageAspectRatio)
    : viewportSize.width;

  return (
    <div className="deck-pdf-viewer" style={{ paddingBottom: navHeight }}>
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
            width={fitWidth}
            onLoadSuccess={(page) => {
              if (pageAspectRatio === null) {
                setPageAspectRatio(page.originalWidth / page.originalHeight);
              }
            }}
            loading={<p className="font-secondary text-md">Loading page…</p>}
          />
        )}
      </Document>

      {numPages && (
        <DeckPdfNav
          ref={navRef}
          currentPage={currentPage}
          numPages={numPages}
          onNavigate={setCurrentPage}
          onToggleMenu={() => setMenuOpen((open) => !open)}
        />
      )}

      {numPages && (
        <DeckPdfMenu
          isOpen={menuOpen}
          numPages={numPages}
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          onClose={() => setMenuOpen(false)}
          pdf={pdfProxy}
        />
      )}
    </div>
  );
};

export default DeckPdfViewer;
