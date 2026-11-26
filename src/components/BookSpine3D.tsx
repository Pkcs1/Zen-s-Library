import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookItem } from '../types/library';

interface BookSpine3DProps {
  book: BookItem;
  isAnyHovered: boolean;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onOpenBook: (book: BookItem) => void;
}

function formatSize(bytes: number): string {
  if (!bytes) return 'Sample';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const BookSpine3D: React.FC<BookSpine3DProps> = ({
  book,
  isAnyHovered,
  isHovered,
  onHoverStart,
  onHoverEnd,
  onOpenBook,
}) => {
  const [isOpening, setIsOpening] = useState(false);

  const handleClick = () => {
    setIsOpening(true);
    setTimeout(() => {
      onOpenBook(book);
      setIsOpening(false);
    }, 180);
  };

  if (book.isStacked) {
    return (
      <motion.div
        className="book-3d-slot"
        style={{ zIndex: isHovered ? 40 : 2 }}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
        onClick={handleClick}
        animate={{
          x: isHovered ? 24 : 0,
          y: isHovered ? -6 : 0,
          scale: isOpening ? 1.08 : isHovered ? 1.04 : 1,
          opacity: isAnyHovered && !isHovered ? 0.62 : 1,
        }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      >
        <div
          className="book-stacked-face"
          style={{
            width: book.spineHeight,
            height: book.spineThickness,
            background: book.spineColor,
            color: book.spineTextColor,
            boxShadow: isHovered
              ? '-14px 18px 28px rgba(44, 38, 33, 0.34)'
              : '-6px 8px 14px rgba(44, 38, 33, 0.18)',
          }}
        >
          <div className="book-spine-sheen" />
          <span className="book-stacked-title">{book.title}</span>
        </div>

        <AnimatePresence>
          {isHovered && (
            <motion.div
              className="hover-preview-card"
              initial={{ opacity: 0, y: 12, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.2 }}
            >
              <HoverCardContent book={book} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="book-3d-slot"
      style={{
        zIndex: isHovered ? 50 : 2,
        marginLeft: book.tiltDeg < 0 ? 14 : 0,
        marginRight: book.tiltDeg > 0 ? 14 : 0,
      }}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onClick={handleClick}
      animate={{
        opacity: isAnyHovered && !isHovered ? 0.58 : 1,
      }}
      transition={{ duration: 0.22 }}
    >
      {/* 3D Book Body: Halfway Pull-Out on Hover + Pop-Out on Click */}
      <motion.div
        className="book-3d-body"
        animate={{
          y: isOpening ? -28 : isHovered ? -14 : 0,
          z: isOpening ? 110 : isHovered ? 56 : 0,
          rotateY: isOpening ? -34 : isHovered ? -22 : 0,
          rotateZ: isHovered ? 0 : book.tiltDeg,
          scale: isOpening ? 1.12 : isHovered ? 1.07 : 1,
        }}
        transition={{
          type: 'spring',
          stiffness: isOpening ? 210 : 280,
          damping: isOpening ? 20 : 22,
          mass: 0.9,
        }}
      >
        <div
          className="book-spine-face"
          style={{
            width: book.spineThickness,
            height: book.spineHeight,
            background: book.spineColor,
            color: book.spineTextColor,
            boxShadow: isHovered
              ? '-22px 28px 40px rgba(44, 38, 33, 0.36)'
              : '-8px 10px 14px rgba(44, 38, 33, 0.2)',
            transition: 'box-shadow 0.28s ease',
          }}
        >
          <div className="book-spine-sheen" />
          <div className="book-spine-band" style={{ top: 14 }} />
          <div className="book-spine-band" style={{ bottom: 14 }} />
          <span className="book-spine-title">{book.title}</span>
        </div>

        {/* Exposed Cream Page Block & Front Cover Edge (visible when pulled halfway out) */}
        <motion.div
          className="book-pages-side"
          animate={{
            opacity: isHovered || isOpening ? 1 : 0,
            scaleX: isHovered || isOpening ? 1 : 0.2,
          }}
          transition={{ duration: 0.22 }}
        />
        <motion.div
          className="book-cover-lip"
          style={{ background: book.spineColor }}
          animate={{
            opacity: isHovered || isOpening ? 1 : 0,
          }}
          transition={{ duration: 0.22 }}
        />
      </motion.div>

      {/* Floating Metadata Preview Card */}
      <AnimatePresence>
        {isHovered && !isOpening && (
          <motion.div
            className="hover-preview-card"
            initial={{ opacity: 0, y: 12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2 }}
          >
            <HoverCardContent book={book} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const HoverCardContent: React.FC<{ book: BookItem }> = ({ book }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <span className={`format-badge ${book.format}`}>{book.format}</span>
      <span style={{ fontSize: 12, color: '#8C8073' }}>
        {formatSize(book.fileSizeBytes)}
        {book.pageCount > 0 ? ` • ${book.pageCount} pages` : ''}
      </span>
    </div>

    <div
      style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 22,
        fontWeight: 700,
        color: '#2C2621',
        lineHeight: 1.15,
        marginBottom: 4,
      }}
    >
      {book.title}
    </div>
    <div style={{ fontSize: 13, color: '#6E6358', marginBottom: 14 }}>
      {book.author}
    </div>

    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 11,
        fontWeight: 600,
        color: '#7A6F64',
        marginBottom: 6,
      }}
    >
      <span>Reading Progress</span>
      <span>{book.progressPercent}%</span>
    </div>
    <div
      style={{
        height: 6,
        borderRadius: 999,
        background: '#EFE8DC',
        overflow: 'hidden',
        marginBottom: 14,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${book.progressPercent}%`,
          borderRadius: 999,
          background: '#C86D51',
        }}
      />
    </div>

    <div
      style={{
        height: 36,
        borderRadius: 999,
        background: '#2C2621',
        color: '#FAF7F2',
        fontSize: 12,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      Click Book to Open Full-Screen Reader &rarr;
    </div>
  </div>
);
