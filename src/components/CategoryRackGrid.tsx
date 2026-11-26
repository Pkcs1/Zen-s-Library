import React from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { BookItem, CategoryRack } from '../types/library';

interface CategoryRackGridProps {
  categories: CategoryRack[];
  books: BookItem[];
  onSelectCategory: (category: CategoryRack, originRect: DOMRect) => void;
  onNewCategoryClick: () => void;
}

export const CategoryRackGrid: React.FC<CategoryRackGridProps> = ({
  categories,
  books,
  onSelectCategory,
  onNewCategoryClick,
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

        <button className="zen-btn-secondary" onClick={onNewCategoryClick}>
          <Plus size={15} />
          <span>New Category</span>
        </button>
      </div>

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
    </motion.section>
  );
};
