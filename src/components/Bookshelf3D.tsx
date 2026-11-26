import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, FolderPlus, Plus, Trash2, X } from 'lucide-react';
import { BookFormat, BookItem, CategoryRack } from '../types/library';
import { BookSpine3D } from './BookSpine3D';
import { Binder3D } from './Binder3D';

interface Bookshelf3DProps {
  category: CategoryRack;
  breadcrumbs: CategoryRack[];
  childBinders: CategoryRack[];
  allCategories: CategoryRack[];
  allBooks: BookItem[];
  books: BookItem[];
  zoomOrigin: { x: number; y: number } | null;
  onBackToRacks: () => void;
  onSelectBreadcrumb: (categoryId: string) => void;
  onOpenBinder: (binder: CategoryRack, originRect: DOMRect) => void;
  onOpenBook: (book: BookItem) => void;
  onAddBookClick: () => void;
  onNewBinderClick: () => void;
  onDeleteItems: (binderIds: string[], bookIds: string[]) => Promise<void>;
}

function countBooksRecursive(
  catId: string,
  allCategories: CategoryRack[],
  allBooks: BookItem[]
): number {
  const direct = allBooks.filter((b) => b.categoryId === catId).length;
  const children = allCategories.filter((c) => c.parentId === catId);
  return (
    direct +
    children.reduce((sum, ch) => sum + countBooksRecursive(ch.id, allCategories, allBooks), 0)
  );
}

export const Bookshelf3D: React.FC<Bookshelf3DProps> = ({
  category,
  breadcrumbs,
  childBinders,
  allCategories,
  allBooks,
  books,
  zoomOrigin,
  onBackToRacks,
  onSelectBreadcrumb,
  onOpenBinder,
  onOpenBook,
  onAddBookClick,
  onNewBinderClick,
  onDeleteItems,
}) => {
  const [formatFilter, setFormatFilter] = useState<'all' | BookFormat>('all');
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedBinderIds, setSelectedBinderIds] = useState<string[]>([]);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  const filteredBooks = useMemo(() => {
    if (formatFilter === 'all') return books;
    return books.filter((b) => b.format === formatFilter);
  }, [books, formatFilter]);

  const { topRow, bottomStandingLeft, bottomStacked, bottomStandingRight } = useMemo(() => {
    const stacked = filteredBooks.filter((b) => b.isStacked);
    const standing = filteredBooks.filter((b) => !b.isStacked);
    const maxTopStanding = Math.max(4, 10 - childBinders.length * 2);
    const top = standing.slice(0, maxTopStanding);
    const bottomRest = standing.slice(maxTopStanding);
    return {
      topRow: top,
      bottomStandingLeft: bottomRest.slice(0, 2),
      bottomStacked: stacked,
      bottomStandingRight: bottomRest.slice(2),
    };
  }, [filteredBooks, childBinders.length]);

  const originStyle = zoomOrigin ? `${zoomOrigin.x}px ${zoomOrigin.y}px` : '50% 40%';
  const isEmpty = childBinders.length === 0 && filteredBooks.length === 0;
  const totalSelected = selectedBinderIds.length + selectedBookIds.length;
  const totalItemsOnShelf = childBinders.length + filteredBooks.length;

  const toggleBookSelect = (id: string) => {
    setSelectedBookIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleBinderSelect = (id: string) => {
    setSelectedBinderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (totalSelected === totalItemsOnShelf) {
      setSelectedBinderIds([]);
      setSelectedBookIds([]);
    } else {
      setSelectedBinderIds(childBinders.map((b) => b.id));
      setSelectedBookIds(filteredBooks.map((b) => b.id));
    }
  };

  const handleConfirmDelete = async () => {
    if (totalSelected === 0) return;
    setDeleting(true);
    await onDeleteItems(selectedBinderIds, selectedBookIds);
    setDeleting(false);
    setSelectedBinderIds([]);
    setSelectedBookIds([]);
    setDeleteMode(false);
  };

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
        <div className="shelf-breadcrumb" style={{ flexWrap: 'wrap' }}>
          <button className="zen-btn-secondary" onClick={onBackToRacks}>
            <ArrowLeft size={15} />
            <span>All Racks</span>
          </button>

          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.id}>
                <span style={{ color: '#B8AC9D', fontSize: 18 }}>/</span>
                {isLast ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h1 className="shelf-title">{crumb.name}</h1>
                    {crumb.parentId && (
                      <span
                        className="format-badge"
                        style={{
                          background: 'rgba(200, 109, 81, 0.16)',
                          color: '#A54E34',
                        }}
                      >
                        BINDER
                      </span>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => onSelectBreadcrumb(crumb.id)}
                    style={{
                      border: 'none',
                      background: 'none',
                      padding: 0,
                      fontFamily: 'var(--font-serif)',
                      fontSize: 26,
                      fontWeight: 600,
                      color: '#7A6F64',
                      textDecoration: 'underline',
                      textUnderlineOffset: 4,
                    }}
                  >
                    {crumb.name}
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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

          {!isEmpty && (
            <button
              className="zen-btn-secondary"
              onClick={() => {
                setDeleteMode((d) => !d);
                setSelectedBinderIds([]);
                setSelectedBookIds([]);
              }}
              style={
                deleteMode
                  ? {
                      background: '#FDF4F2',
                      borderColor: '#D98E84',
                      color: '#9E332C',
                    }
                  : undefined
              }
            >
              {deleteMode ? <X size={14} /> : <Trash2 size={14} />}
              <span>{deleteMode ? 'Cancel Delete' : 'Delete'}</span>
            </button>
          )}

          <button className="zen-btn-secondary" onClick={onNewBinderClick}>
            <FolderPlus size={15} />
            <span>New Binder</span>
          </button>

          <button className="zen-btn-primary" onClick={onAddBookClick}>
            <Plus size={16} />
            <span>Add Book</span>
          </button>
        </div>
      </div>

      {/* Delete Mode Action Bar inside Rack */}
      {deleteMode && !isEmpty ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginBottom: 24,
            padding: '14px 20px',
            borderRadius: 16,
            background: '#FDF4F2',
            border: '1px solid #F0C7BE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 14, color: '#8A2D27', fontWeight: 600 }}>
            Click books or binders on the shelf to select them for deletion ({totalSelected}{' '}
            selected)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="zen-btn-secondary"
              onClick={handleSelectAll}
              style={{ height: 34, fontSize: 12 }}
            >
              {totalSelected === totalItemsOnShelf ? 'Deselect All' : 'Select All'}
            </button>
            <button
              type="button"
              disabled={totalSelected === 0 || deleting}
              onClick={handleConfirmDelete}
              style={{
                height: 36,
                padding: '0 18px',
                borderRadius: 999,
                border: 'none',
                background: totalSelected === 0 ? '#D9B6B2' : '#B4433C',
                color: '#FAF7F2',
                fontSize: 13,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: totalSelected === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <Trash2 size={14} />
              <span>
                {deleting ? 'Deleting...' : `Delete Selected (${totalSelected})`}
              </span>
            </button>
          </div>
        </motion.div>
      ) : (
        <p className="shelf-hint">
          Hover any binder or book spine to slide it halfway out in 3D &bull; Click a binder to open
          its sub-genre shelf, or click a book to read
        </p>
      )}

      {isEmpty ? (
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
            This {category.parentId ? 'binder' : 'rack'} is ready for your collection
          </p>
          <p style={{ fontSize: 14, color: '#7A6F64', margin: '0 0 20px' }}>
            Upload a PDF/EPUB or create a sub-category binder to organize genres inside.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button className="zen-btn-primary" onClick={onAddBookClick}>
              <Plus size={16} />
              <span>Upload First Book</span>
            </button>
            <button className="zen-btn-secondary" onClick={onNewBinderClick}>
              <FolderPlus size={15} />
              <span>Create Binder</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Tier 1 Floating Oak Shelf (Binders + Standing Books) */}
          <div className="shelf-tier">
            <div className="shelf-books-row">
              {childBinders.map((binder) => (
                <Binder3D
                  key={binder.id}
                  binder={binder}
                  bookCount={countBooksRecursive(binder.id, allCategories, allBooks)}
                  subBinderCount={allCategories.filter((c) => c.parentId === binder.id).length}
                  isAnyHovered={!deleteMode && hoveredItemId !== null}
                  isHovered={hoveredItemId === binder.id}
                  deleteMode={deleteMode}
                  isSelectedForDelete={selectedBinderIds.includes(binder.id)}
                  onToggleSelectForDelete={toggleBinderSelect}
                  onHoverStart={() => setHoveredItemId(binder.id)}
                  onHoverEnd={() => setHoveredItemId(null)}
                  onOpenBinder={onOpenBinder}
                />
              ))}

              {topRow.map((book) => (
                <BookSpine3D
                  key={book.id}
                  book={book}
                  isAnyHovered={!deleteMode && hoveredItemId !== null}
                  isHovered={hoveredItemId === book.id}
                  deleteMode={deleteMode}
                  isSelectedForDelete={selectedBookIds.includes(book.id)}
                  onToggleSelectForDelete={toggleBookSelect}
                  onHoverStart={() => setHoveredItemId(book.id)}
                  onHoverEnd={() => setHoveredItemId(null)}
                  onOpenBook={onOpenBook}
                />
              ))}
            </div>
            <div className="oak-plank" />
          </div>

          {/* Tier 2 Floating Oak Shelf */}
          {(bottomStandingLeft.length > 0 ||
            bottomStacked.length > 0 ||
            bottomStandingRight.length > 0) && (
            <div className="shelf-tier">
              <div className="shelf-books-row">
                {bottomStandingLeft.map((book) => (
                  <BookSpine3D
                    key={book.id}
                    book={book}
                    isAnyHovered={!deleteMode && hoveredItemId !== null}
                    isHovered={hoveredItemId === book.id}
                    deleteMode={deleteMode}
                    isSelectedForDelete={selectedBookIds.includes(book.id)}
                    onToggleSelectForDelete={toggleBookSelect}
                    onHoverStart={() => setHoveredItemId(book.id)}
                    onHoverEnd={() => setHoveredItemId(null)}
                    onOpenBook={onOpenBook}
                  />
                ))}

                {bottomStacked.length > 0 && (
                  <div className="book-stack-col">
                    {bottomStacked.map((book) => (
                      <BookSpine3D
                        key={book.id}
                        book={book}
                        isAnyHovered={!deleteMode && hoveredItemId !== null}
                        isHovered={hoveredItemId === book.id}
                        deleteMode={deleteMode}
                        isSelectedForDelete={selectedBookIds.includes(book.id)}
                        onToggleSelectForDelete={toggleBookSelect}
                        onHoverStart={() => setHoveredItemId(book.id)}
                        onHoverEnd={() => setHoveredItemId(null)}
                        onOpenBook={onOpenBook}
                      />
                    ))}
                  </div>
                )}

                {bottomStandingRight.map((book) => (
                  <BookSpine3D
                    key={book.id}
                    book={book}
                    isAnyHovered={!deleteMode && hoveredItemId !== null}
                    isHovered={hoveredItemId === book.id}
                    deleteMode={deleteMode}
                    isSelectedForDelete={selectedBookIds.includes(book.id)}
                    onToggleSelectForDelete={toggleBookSelect}
                    onHoverStart={() => setHoveredItemId(book.id)}
                    onHoverEnd={() => setHoveredItemId(null)}
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
