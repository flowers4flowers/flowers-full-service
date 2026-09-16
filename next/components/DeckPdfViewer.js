// next/components/DeckPdfViewer.js

"use client";

import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import DeckPdfNav from "./DeckPdfNav";
import DeckPdfMenu from "./DeckPdfMenu";
import useDeckKeyboardNav from "./useDeckKeyboardNav";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

const DOCUMENT_OPTIONS = {
  disableAutoFetch: true,
  disableStream: false,
  disableRange: true,
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
  const [loadProgress, setLoadProgress] = useState(null);
  const [visitedPages, setVisitedPages] = useState(() => new Set([1]));
  const navRef = useRef(null);

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

  useDeckKeyboardNav({ currentPage, numPages, onNavigate: setCurrentPage });

  useEffect(() => {
    setVisitedPages((prev) => {
      if (prev.has(currentPage)) {
        return prev;
      }
      return new Set(prev).add(currentPage);
    });
  }, [currentPage]);

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
        onLoadProgress={({ loaded, total }) => setLoadProgress({ loaded, total })}
        loading={(() => {
          const loaded = loadProgress?.loaded ?? 0;
          const total = loadProgress?.total ?? 0;
          const percentage = total ? Math.round((loaded / total) * 100) : 0;

          return (
            <div className="deck-pdf-viewer__progress">
              <div className="deck-pdf-viewer__progress-track">
                <div
                  className="deck-pdf-viewer__progress-bar"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <p className="deck-pdf-viewer__progress-label font-secondary text-md">
                Loading deck… {percentage}%
              </p>
            </div>
          );
        })()}
      >
        {numPages &&
          Array.from(visitedPages).map((pageNumber) => (
            <div
              key={pageNumber}
              className={
                pageNumber === currentPage
                  ? "deck-pdf-viewer__page deck-pdf-viewer__page--active"
                  : "deck-pdf-viewer__page"
              }
            >
              <Page
                pageNumber={pageNumber}
                width={fitWidth}
                onLoadSuccess={(page) => {
                  if (pageAspectRatio === null) {
                    setPageAspectRatio(page.originalWidth / page.originalHeight);
                  }
                }}
                loading={<p className="font-secondary text-md">Loading page…</p>}
              />
            </div>
          ))}
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
