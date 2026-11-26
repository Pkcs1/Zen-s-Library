import React from 'react';
import { motion } from 'framer-motion';
import { Plus, RotateCcw } from 'lucide-react';
import { BookItem, CategoryRack } from '../types/library';

interface CategoryRackGridProps {
  categories: CategoryRack[];
  books: BookItem[];
  onSelectCategory: (category: CategoryRack, originRect: DOMRect) => void;
  onNewCategoryClick: () => void;
  onResetClick: () => void;
}

export const CategoryRackGrid: React.FC<CategoryRackGridProps> = ({
  categories,
  books,
  onSelectCategory,
  onNewCategoryClick,
  onResetClick,
}) => {
  const totalBooks = books.length;

  return (
    <motion.section
      key="category-landing"
      className="zen-stage"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.12, filter: 'blur(4px)' }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="zen-hero-row">
        <div>
          <div className="zen-kicker">Your Personal Reading Room</div>
          <h1 className="zen-hero-title">Choose a rack to browse</h1>
          <p className="zen-hero-sub">
            {categories.length} category racks &bull; {totalBooks} books stored &bull; PDF &amp; EPUB ready
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="zen-btn-secondary"
            onClick={onResetClick}
            title="Clear all racks and books, or restore sample library"
          >
            <RotateCcw size={14} />
            <span>Reset / Clear</span>
          </button>
          <button className="zen-btn-secondary" onClick={onNewCategoryClick}>
            <Plus size={15} />
            <span>New Category</span>
          </button>
        </div>
      </div>

      {categories.length === 0 ? (
        <div
          style={{
            padding: '80px 28px',
            textAlign: 'center',
            borderRadius: 24,
            background: '#F4EFE6',
            border: '1.5px dashed #D5CAB8',
          }}
        >
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, margin: '0 0 10px' }}>
            Your reading room is empty
          </h2>
          <p style={{ fontSize: 15, color: '#7A6F64', margin: '0 0 24px' }}>
            Create your first category rack to start shelving your PDFs and EPUBs, or restore the
            sample library.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button className="zen-btn-primary" onClick={onNewCategoryClick}>
              <Plus size={16} />
              <span>Create First Rack</span>
            </button>
            <button className="zen-btn-secondary" onClick={onResetClick}>
              <RotateCcw size={14} />
              <span>Restore Sample Library</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="rack-grid">
        {categories.map((cat, idx) => {
          const catBooks = books.filter((b) => b.categoryId === cat.id);
          const previewSpines = catBooks.slice(0, 6);
          const formats = Array.from(new Set(catBooks.map((b) => b.format.toUpperCase()))).join(' & ') || 'Empty Rack';

          return (
            <motion.button
              key={cat.id}
              className="rack-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.985 }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onSelectCategory(cat, rect);
              }}
            >
              <div className="rack-mini-stage">
                <div className="rack-mini-books">
                  {previewSpines.length > 0 ? (
                    previewSpines.map((book, bIdx) => (
                      <div
                        key={book.id}
                        className="rack-mini-spine"
                        style={{
                          width: Math.max(18, Math.round(book.spineThickness * 0.42)),
                          height: Math.max(76, Math.round(book.spineHeight * 0.46)),
                          background: book.spineColor,
                          transform:
                            bIdx === previewSpines.length - 1 && previewSpines.length >= 4
                              ? 'rotate(-7deg) translateX(4px)'
                              : undefined,
                        }}
                      />
                    ))
                  ) : (
                    <span style={{ fontSize: 12, color: '#9a8e80', paddingBottom: 12 }}>
                      Click to add your first book
                    </span>
                  )}
                </div>
                <div className="rack-mini-plank" />
              </div>

              <h2 className="rack-card-title">{cat.name}</h2>
              <div className="rack-card-footer">
                <span>
                  {catBooks.length} {catBooks.length === 1 ? 'book' : 'books'} &bull; {formats}
                </span>
                <span className="rack-card-cta">Open Rack &rarr;</span>
              </div>
            </motion.button>
          );
        })}
        </div>
      )}
    </motion.section>
  );
};
