import React, { useEffect, useRef, useState } from 'react';
import ePub, { Book, Rendition } from 'epubjs';
import { ReaderTheme } from '../types/library';

interface EpubReaderProps {
  blob: Blob;
  initialLocation: string;
  theme: ReaderTheme;
  fontScale: number;
  navSignal: { dir: 'prev' | 'next'; seq: number } | null;
  seekPercentSignal?: { percent: number; seq: number } | null;
  onLocationChange: (cfi: string, percent: number) => void;
}

const THEME_STYLES: Record<ReaderTheme, { bg: string; color: string }> = {
  cream: { bg: '#faf6ee', color: '#2c2621' },
  white: { bg: '#ffffff', color: '#1c1c1c' },
  sepia: { bg: '#f4ecd8', color: '#3a2e22' },
  night: { bg: '#1e1c19', color: '#e6dfd5' },
};

export const EpubReader: React.FC<EpubReaderProps> = ({
  blob,
  initialLocation,
  theme,
  fontScale,
  navSignal,
  seekPercentSignal,
  onLocationChange,
}) => {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const bookRef = useRef<Book | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initEpub() {
      if (!viewerRef.current) return;
      try {
        const buffer = await blob.arrayBuffer();
        if (cancelled) return;
        const book = ePub(buffer);
        bookRef.current = book;

        const rendition = book.renderTo(viewerRef.current, {
          width: '100%',
          height: 640,
          spread: 'auto',
        });
        renditionRef.current = rendition;

        const startLoc = initialLocation && initialLocation.startsWith('epubcfi') ? initialLocation : undefined;
        await rendition.display(startLoc);

        await book.ready;
        await book.locations.generate(1024);

        rendition.on('relocated', (location: { start: { cfi: string; percentage?: number } }) => {
          const cfi = location.start.cfi;
          const pct = Math.round((book.locations.percentageFromCfi(cfi) || location.start.percentage || 0) * 100);
          onLocationChange(cfi, pct);
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to open EPUB file.');
        }
      }
    }

    initEpub();
    return () => {
      cancelled = true;
      renditionRef.current?.destroy();
      bookRef.current?.destroy();
    };
  }, [blob]);

  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    const colors = THEME_STYLES[theme];
    rendition.themes.default({
      body: {
        background: `${colors.bg} !important`,
        color: `${colors.color} !important`,
        'font-family': 'Georgia, serif !important',
        'font-size': `${Math.round(fontScale * 100)}% !important`,
        'line-height': '1.75 !important',
        padding: '12px 24px !important',
      },
    });
  }, [theme, fontScale]);

  useEffect(() => {
    if (!navSignal || !renditionRef.current) return;
    if (navSignal.dir === 'next') renditionRef.current.next();
    else renditionRef.current.prev();
  }, [navSignal]);

  useEffect(() => {
    if (!seekPercentSignal || !renditionRef.current || !bookRef.current) return;
    if (bookRef.current.locations.length() <= 0) return;
    const pct = Math.max(0, Math.min(1, seekPercentSignal.percent / 100));
    const cfi = bookRef.current.locations.cfiFromPercentage(pct);
    if (cfi) {
      renditionRef.current.display(cfi);
    }
  }, [seekPercentSignal]);

  if (error) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#B4433C' }}>
        <p style={{ fontWeight: 600 }}>Could not render EPUB</p>
        <p style={{ fontSize: 13 }}>{error}</p>
      </div>
    );
  }

  return <div ref={viewerRef} style={{ width: '100%', minHeight: 640 }} />;
};
