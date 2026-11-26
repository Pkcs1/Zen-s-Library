import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react';
import { BookItem, BookmarkItem, ReaderTheme } from '../types/library';
import { getBookFileBlob } from '../lib/storage';
import { PdfReader } from './PdfReader';
import { EpubReader } from './EpubReader';

interface ReaderOverlayProps {
  book: BookItem;
  bookmarks: BookmarkItem[];
  onClose: () => void;
  onUpdateProgress: (book: BookItem, location: string, percent: number, pageCount?: number) => void;
  onToggleBookmark: (bookId: string, location: string, label: string) => void;
  onDeleteBook: (book: BookItem) => void;
}

export const ReaderOverlay: React.FC<ReaderOverlayProps> = ({
  book,
  bookmarks,
  onClose,
  onUpdateProgress,
  onToggleBookmark,
  onDeleteBook,
}) => {
  const [theme, setTheme] = useState<ReaderTheme>('cream');
  const [zoom, setZoom] = useState(1);
  const [fileBlob, setFileBlob] = useState<Blob | null>(null);
  const [loadingBlob, setLoadingBlob] = useState(true);

  // Page & progress state
  const [currentPage, setCurrentPage] = useState(() => {
    const parsed = parseInt(book.currentLocation, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  });
  const [totalPages, setTotalPages] = useState(book.pageCount || 1);
  const [progressPercent, setProgressPercent] = useState(book.progressPercent || 0);
  const [currentLocation, setCurrentLocation] = useState(book.currentLocation || '1');
  const [epubNavSignal, setEpubNavSignal] = useState<{ dir: 'prev' | 'next'; seq: number } | null>(null);
  const [demoChapterIdx, setDemoChapterIdx] = useState(0);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingBlob(true);
    getBookFileBlob(book)
      .then((blob) => {
        if (active) {
          setFileBlob(blob);
          setLoadingBlob(false);
        }
      })
      .catch(() => {
        if (active) setLoadingBlob(false);
      });
    return () => {
      active = false;
    };
  }, [book.id]);

  // Keyboard navigation (Escape to close, Left/Right arrows to flip pages)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const chapters = book.demoChapters ?? [
    {
      kicker: 'CHAPTER I',
      title: book.title,
      paragraphs: [
        `You are viewing the sample reading spread for “${book.title}” by ${book.author}.`,
        'Upload your own PDF or EPUB file using the “+ Upload Book” button on the shelf to read full-resolution documents with automatic page memory and cloud sync.',
      ],
      highlightedQuote:
        'A room without books is like a body without a soul. — Marcus Tullius Cicero',
    },
  ];

  const activeDemoChapter = chapters[Math.min(demoChapterIdx, chapters.length - 1)];

  const isBookmarked = bookmarks.some(
    (bm) => bm.bookId === book.id && bm.location === currentLocation
  );

  const handlePrev = () => {
    if (fileBlob && book.format === 'epub') {
      setEpubNavSignal((prev) => ({ dir: 'prev', seq: (prev?.seq ?? 0) + 1 }));
      return;
    }
    if (fileBlob && book.format === 'pdf') {
      setCurrentPage((p) => Math.max(1, p - 1));
      return;
    }
    const nextIdx = Math.max(0, demoChapterIdx - 1);
    setDemoChapterIdx(nextIdx);
    const pct = Math.round(((nextIdx + 1) / chapters.length) * 100);
    setProgressPercent(pct);
    setCurrentLocation(String(nextIdx + 1));
    onUpdateProgress(book, String(nextIdx + 1), pct);
  };

  const handleNext = () => {
    if (fileBlob && book.format === 'epub') {
      setEpubNavSignal((prev) => ({ dir: 'next', seq: (prev?.seq ?? 0) + 1 }));
      return;
    }
    if (fileBlob && book.format === 'pdf') {
      setCurrentPage((p) => Math.min(totalPages, p + 1));
      return;
    }
    const nextIdx = Math.min(chapters.length - 1, demoChapterIdx + 1);
    setDemoChapterIdx(nextIdx);
    const pct = Math.round(((nextIdx + 1) / chapters.length) * 100);
    setProgressPercent(pct);
    setCurrentLocation(String(nextIdx + 1));
    onUpdateProgress(book, String(nextIdx + 1), pct);
  };

  return (
    <motion.div
      className={`reader-backdrop theme-${theme}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, pointerEvents: 'none' }}
      transition={{ duration: 0.25 }}
    >
      {/* Top Reader Toolbar */}
      <div className="reader-topbar">
        <button className="zen-btn-secondary" onClick={onClose}>
          <ArrowLeft size={15} />
          <span>Return to Shelf</span>
        </button>

        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 20,
              fontWeight: 700,
              lineHeight: 1.15,
            }}
          >
            {book.title} &mdash; {book.author}
          </div>
          <div style={{ fontSize: 12, opacity: 0.68 }}>
            {fileBlob ? book.fileName : activeDemoChapter.title} &bull; {book.format.toUpperCase()}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Zoom / Font controls */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 999,
              background: theme === 'night' ? '#2c2925' : '#f2ece2',
            }}
          >
            <button
              onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.1).toFixed(2)))}
              title="Decrease size"
              style={{ border: 'none', background: 'none', color: 'inherit', padding: 4 }}
            >
              <Minus size={14} />
            </button>
            <span style={{ fontSize: 12, fontWeight: 600, minWidth: 36, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.1).toFixed(2)))}
              title="Increase size"
              style={{ border: 'none', background: 'none', color: 'inherit', padding: 4 }}
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Paper Theme Swatches */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {(
              [
                { id: 'cream', bg: '#FAF6EE', border: '#D4C8B4' },
                { id: 'white', bg: '#FFFFFF', border: '#CCCCCC' },
                { id: 'sepia', bg: '#EFE2C6', border: '#C9B48B' },
                { id: 'night', bg: '#23211E', border: '#4A453F' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                title={`${t.id} theme`}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: t.bg,
                  border:
                    theme === t.id ? '2.5px solid #C86D51' : `1px solid ${t.border}`,
                  padding: 0,
                }}
              />
            ))}
          </div>

          <button
            onClick={() =>
              onToggleBookmark(book.id, currentLocation, `Page ${currentLocation}`)
            }
            style={{
              height: 32,
              padding: '0 12px',
              borderRadius: 999,
              border: 'none',
              background: isBookmarked ? 'rgba(200, 109, 81, 0.2)' : 'rgba(128,116,100,0.14)',
              color: isBookmarked ? '#B4433C' : 'inherit',
              fontSize: 12,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Bookmark size={14} fill={isBookmarked ? 'currentColor' : 'none'} />
            <span>{isBookmarked ? 'Saved' : 'Bookmark'}</span>
          </button>

          <button
            onClick={() => {
              if (window.confirm(`Remove "${book.title}" from your library?`)) {
                onDeleteBook(book);
              }
            }}
            title="Remove book from shelf"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(180, 67, 60, 0.12)',
              color: '#B4433C',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Pop-Out Open Book Spread Canvas */}
      <div className="reader-canvas-area" style={{ perspective: 1600 }}>
        <motion.div
          className="reader-paper"
          initial={{ opacity: 0, scale: 0.68, rotateY: -16, y: 40 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0, y: 0 }}
          exit={{ opacity: 0, scale: 0.76, rotateY: 12, y: 28 }}
          transition={{ type: 'spring', stiffness: 210, damping: 24, mass: 0.95 }}
        >
          {loadingBlob ? (
            <div style={{ padding: 80, textAlign: 'center', opacity: 0.7 }}>
              Opening book...
            </div>
          ) : fileBlob && book.format === 'pdf' ? (
            <PdfReader
              blob={fileBlob}
              initialPage={currentPage}
              zoom={zoom}
              externalPageRequest={currentPage}
              onPageChange={(page, total) => {
                setCurrentPage(page);
                setTotalPages(total);
                const pct = Math.round((page / Math.max(1, total)) * 100);
                setProgressPercent(pct);
                setCurrentLocation(String(page));
                onUpdateProgress(book, String(page), pct, total);
              }}
            />
          ) : fileBlob && book.format === 'epub' ? (
            <EpubReader
              blob={fileBlob}
              initialLocation={currentLocation}
              theme={theme}
              fontScale={zoom}
              navSignal={epubNavSignal}
              onLocationChange={(cfi, pct) => {
                setCurrentLocation(cfi);
                setProgressPercent(pct);
                onUpdateProgress(book, cfi, pct);
              }}
            />
          ) : (
            /* Editorial Two-Page Open Book Spread for Preloaded Sample Books */
            <div className="reader-spread-grid">
              {/* Center Book Binding Crease */}
              <div className="reader-center-crease" />

              {/* Left Page */}
              <div style={{ padding: '44px 56px 56px' }}>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.15em',
                    opacity: 0.55,
                    marginBottom: 42,
                    textTransform: 'uppercase',
                  }}
                >
                  {book.title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                    color: '#C86D51',
                    marginBottom: 8,
                  }}
                >
                  {activeDemoChapter.kicker}
                </div>
                <h2
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: Math.round(34 * zoom),
                    fontWeight: 600,
                    margin: '0 0 28px',
                  }}
                >
                  {activeDemoChapter.title}
                </h2>
                {activeDemoChapter.paragraphs.map((p, i) => (
                  <p
                    key={i}
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: Math.round(19 * zoom),
                      lineHeight: 1.75,
                      marginBottom: 20,
                    }}
                  >
                    {p}
                  </p>
                ))}
              </div>

              {/* Right Page */}
              <div style={{ padding: '44px 56px 56px' }}>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.15em',
                    opacity: 0.55,
                    marginBottom: 42,
                    textTransform: 'uppercase',
                  }}
                >
                  {activeDemoChapter.kicker} &bull; {activeDemoChapter.title}
                </div>

                {activeDemoChapter.highlightedQuote && (
                  <blockquote
                    style={{
                      margin: '0 0 28px',
                      padding: '18px 22px',
                      borderRadius: 10,
                      background: 'rgba(217, 167, 78, 0.2)',
                      fontFamily: 'var(--font-serif)',
                      fontSize: Math.round(20 * zoom),
                      lineHeight: 1.68,
                    }}
                  >
                    {activeDemoChapter.highlightedQuote}
                  </blockquote>
                )}

                <p
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: Math.round(18 * zoom),
                    lineHeight: 1.75,
                    opacity: 0.82,
                  }}
                >
                  This is a built-in reading preview. Drop any real <strong>.pdf</strong> or{' '}
                  <strong>.epub</strong> file into <strong>+ Upload Book</strong> to store it in
                  your library and read every page in full screen with automatic resume.
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Bottom Floating Scrubber Bar */}
      <div className="reader-scrubber">
        <button
          onClick={handlePrev}
          style={{
            border: 'none',
            background: 'none',
            color: 'inherit',
            fontWeight: 600,
            fontSize: 13,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <ChevronLeft size={16} />
          <span>Prev</span>
        </button>

        <div
          style={{
            width: 300,
            height: 6,
            borderRadius: 999,
            background: 'rgba(138, 125, 110, 0.24)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              borderRadius: 999,
              background: '#C86D51',
              transition: 'width 0.25s ease',
            }}
          />
        </div>

        <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.78, minWidth: 124 }}>
          {fileBlob && book.format === 'pdf'
            ? `Page ${currentPage} of ${totalPages} (${progressPercent}%)`
            : `${progressPercent}% read`}
        </span>

        <button
          onClick={handleNext}
          style={{
            border: 'none',
            background: 'none',
            color: 'inherit',
            fontWeight: 600,
            fontSize: 13,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>Next</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </motion.div>
  );
};
