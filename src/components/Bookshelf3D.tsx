import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus } from 'lucide-react';
import { BookFormat, BookItem, CategoryRack } from '../types/library';
import { BookSpine3D } from './BookSpine3D';

interface Bookshelf3DProps {
  category: CategoryRack;
  books: BookItem[];
  zoomOrigin: { x: number; y: number } | null;
  onBackToRacks: () => void;
  onOpenBook: (book: BookItem) => void;
  onAddBookClick: () => void;
}

export const Bookshelf3D: React.FC<Bookshelf3DProps> = ({
  category,
  books,
  zoomOrigin,
  onBackToRacks,
  onOpenBook,
  onAddBookClick,
}) => {
  const [formatFilter, setFormatFilter] = useState<'all' | BookFormat>('all');
  const [hoveredBookId, setHoveredBookId] = useState<string | null>(null);

  const filteredBooks = useMemo(() => {
    if (formatFilter === 'all') return books;
    return books.filter((b) => b.format === formatFilter);
  }, [books, formatFilter]);

  // Split books into two aesthetic floating oak tiers (standing + optional horizontal stack)
  const { topRow, bottomStandingLeft, bottomStacked, bottomStandingRight } = useMemo(() => {
    const stacked = filteredBooks.filter((b) => b.isStacked);
    const standing = filteredBooks.filter((b) => !b.isStacked);
    const top = standing.slice(0, 10);
    const bottomRest = standing.slice(10);
    return {
      topRow: top,
      bottomStandingLeft: bottomRest.slice(0, 2),
      bottomStacked: stacked,
      bottomStandingRight: bottomRest.slice(2),
    };
  }, [filteredBooks]);

  const originStyle = zoomOrigin
    ? `${zoomOrigin.x}px ${zoomOrigin.y}px`
    : '50% 40%';

  return (
    <motion.section
      key={`shelf-${category.id}`}
      className="zen-stage"
      style={{ transformOrigin: originStyle }}
      initial={{ opacity: 0, scale: 0.78 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.84 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24, mass: 0.95 }}
    >
      <div className="shelf-toolbar">
        <div className="shelf-breadcrumb">
          <button className="zen-btn-secondary" onClick={onBackToRacks}>
            <ArrowLeft size={15} />
            <span>All Racks</span>
          </button>
          <span style={{ color: '#B8AC9D', fontSize: 18 }}>/</span>
          <h1 className="shelf-title">{category.name}</h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div className="shelf-filters">
            <button
              className={`filter-pill ${formatFilter === 'all' ? 'active' : ''}`}
              onClick={() => setFormatFilter('all')}
            >
              All ({books.length})
            </button>
            <button
              className={`filter-pill ${formatFilter === 'pdf' ? 'active' : ''}`}
              onClick={() => setFormatFilter('pdf')}
            >
              PDF
            </button>
            <button
              className={`filter-pill ${formatFilter === 'epub' ? 'active' : ''}`}
              onClick={() => setFormatFilter('epub')}
            >
              EPUB
            </button>
          </div>

          <button className="zen-btn-primary" onClick={onAddBookClick}>
            <Plus size={16} />
            <span>Add to Rack</span>
          </button>
        </div>
      </div>

      <p className="shelf-hint">
        Hover any book spine to slide it halfway out in 3D &bull; Click to pop it open into the full-screen reader
      </p>

      {filteredBooks.length === 0 ? (
        <div
          style={{
            padding: '72px 24px',
            textAlign: 'center',
            borderRadius: 20,
            background: '#F4EFE6',
            border: '1px dashed #D6CBB8',
          }}
        >
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 26, margin: '0 0 8px' }}>
            This rack is ready for your books
          </p>
          <p style={{ fontSize: 14, color: '#7A6F64', margin: '0 0 20px' }}>
            Upload a PDF or EPUB file to place it on this floating oak shelf.
          </p>
          <button className="zen-btn-primary" onClick={onAddBookClick}>
            <Plus size={16} />
            <span>Upload First Book</span>
          </button>
        </div>
      ) : (
        <>
          {/* Tier 1 Floating Oak Shelf */}
          <div className="shelf-tier">
            <div className="shelf-books-row">
              {topRow.map((book) => (
                <BookSpine3D
                  key={book.id}
                  book={book}
                  isAnyHovered={hoveredBookId !== null}
                  isHovered={hoveredBookId === book.id}
                  onHoverStart={() => setHoveredBookId(book.id)}
                  onHoverEnd={() => setHoveredBookId(null)}
                  onOpenBook={onOpenBook}
                />
              ))}
            </div>
            <div className="oak-plank" />
          </div>

          {/* Tier 2 Floating Oak Shelf (if we have stacked or overflow books) */}
          {(bottomStandingLeft.length > 0 ||
            bottomStacked.length > 0 ||
            bottomStandingRight.length > 0) && (
            <div className="shelf-tier">
              <div className="shelf-books-row">
                {bottomStandingLeft.map((book) => (
                  <BookSpine3D
                    key={book.id}
                    book={book}
                    isAnyHovered={hoveredBookId !== null}
                    isHovered={hoveredBookId === book.id}
                    onHoverStart={() => setHoveredBookId(book.id)}
                    onHoverEnd={() => setHoveredBookId(null)}
                    onOpenBook={onOpenBook}
                  />
                ))}

                {bottomStacked.length > 0 && (
                  <div className="book-stack-col">
                    {bottomStacked.map((book) => (
                      <BookSpine3D
                        key={book.id}
                        book={book}
                        isAnyHovered={hoveredBookId !== null}
                        isHovered={hoveredBookId === book.id}
                        onHoverStart={() => setHoveredBookId(book.id)}
                        onHoverEnd={() => setHoveredBookId(null)}
                        onOpenBook={onOpenBook}
                      />
                    ))}
                  </div>
                )}

                {bottomStandingRight.map((book) => (
                  <BookSpine3D
                    key={book.id}
                    book={book}
                    isAnyHovered={hoveredBookId !== null}
                    isHovered={hoveredBookId === book.id}
                    onHoverStart={() => setHoveredBookId(book.id)}
                    onHoverEnd={() => setHoveredBookId(null)}
                    onOpenBook={onOpenBook}
                  />
                ))}
              </div>
              <div className="oak-plank" />
            </div>
          )}
        </>
      )}
    </motion.section>
  );
};
