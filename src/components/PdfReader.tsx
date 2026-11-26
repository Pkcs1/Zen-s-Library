import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PdfReaderProps {
  blob: Blob;
  initialPage: number;
  zoom: number;
  onPageChange: (page: number, totalPages: number) => void;
  externalPageRequest?: number;
}

export const PdfReader: React.FC<PdfReaderProps> = ({
  blob,
  initialPage,
  zoom,
  onPageChange,
  externalPageRequest,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(Math.max(1, initialPage));
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [error, setError] = useState<string | null>(null);

  // Track container width so PDF fits phone & desktop screens with exact aspect ratio
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setContainerWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadedDoc: pdfjsLib.PDFDocumentProxy | null = null;

    async function loadPdf() {
      try {
        const buffer = await blob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: buffer });
        const doc = await loadingTask.promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        loadedDoc = doc;
        setPdfDoc(doc);
        const safePage = Math.min(Math.max(1, initialPage), doc.numPages);
        setCurrentPage(safePage);
        onPageChange(safePage, doc.numPages);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load PDF document.');
        }
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
      loadedDoc?.destroy();
    };
  }, [blob]);

  useEffect(() => {
    if (externalPageRequest && pdfDoc) {
      const clamped = Math.min(Math.max(1, externalPageRequest), pdfDoc.numPages);
      setCurrentPage(clamped);
    }
  }, [externalPageRequest, pdfDoc]);

  useEffect(() => {
    let renderTask: pdfjsLib.RenderTask | null = null;
    let cancelled = false;

    async function render() {
      if (!pdfDoc || !canvasRef.current) return;
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const padding = containerWidth < 640 ? 12 : 48;
        const targetCssWidth = Math.max(240, Math.min(containerWidth - padding, 920));
        const fitScale = (targetCssWidth / baseViewport.width) * zoom;

        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const viewport = page.getViewport({ scale: fitScale });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = 'auto';

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
        onPageChange(currentPage, pdfDoc.numPages);
      } catch (err) {
        if (!cancelled && (err as { name?: string })?.name !== 'RenderingCancelledException') {
          console.error('PDF render error:', err);
        }
      }
    }

    render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, currentPage, zoom, containerWidth]);

  if (error) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#B4433C' }}>
        <p style={{ fontWeight: 600 }}>Could not render PDF</p>
        <p style={{ fontSize: 13 }}>{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="pdf-reader-container"
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          borderRadius: 4,
          boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
          maxWidth: zoom <= 1 ? '100%' : 'none',
          height: 'auto',
        }}
      />
    </div>
  );
};
