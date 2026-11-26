import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { BookItem, CategoryRack } from '../types/library';

interface CategoryRackGridProps {
  categories: CategoryRack[];
  books: BookItem[];
  onSelectCategory: (category: CategoryRack, originRect: DOMRect) => void;
  onNewCategoryClick: () => void;
  onDeleteRacks: (rackIds: string[]) => Promise<void>;
}

export const CategoryRackGrid: React.FC<CategoryRackGridProps> = ({
  categories,
  books,
  onSelectCategory,
  onNewCategoryClick,
  onDeleteRacks,
}) => {
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  const topLevelRacks = categories.filter((c) => !c.parentId);
  const totalBooks = books.length;

  const getDescendantIds = (rootId: string): string[] => {
    const children = categories.filter((c) => c.parentId === rootId);
    return [rootId, ...children.flatMap((ch) => getDescendantIds(ch.id))];
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConfirmDelete = async () => {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    await onDeleteRacks(selectedIds);
    setDeleting(false);
    setSelectedIds([]);
    setDeleteMode(false);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === topLevelRacks.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(topLevelRacks.map((r) => r.id));
    }
  };

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
            {topLevelRacks.length} category racks &bull; {totalBooks} books stored &bull; PDF &amp; EPUB ready
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {topLevelRacks.length > 0 && (
            <button
              className="zen-btn-secondary"
              onClick={() => {
                setDeleteMode((d) => !d);
                setSelectedIds([]);
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
              <span>{deleteMode ? 'Cancel Delete' : 'Delete Racks'}</span>
            </button>
          )}

          <button className="zen-btn-secondary" onClick={onNewCategoryClick}>
            <Plus size={15} />
            <span>New Category</span>
          </button>
        </div>
      </div>

      {/* Delete Mode Action Bar */}
      {deleteMode && topLevelRacks.length > 0 && (
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
            Click racks below to select them for deletion ({selectedIds.length} selected)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="zen-btn-secondary"
              onClick={handleSelectAll}
              style={{ height: 34, fontSize: 12 }}
            >
              {selectedIds.length === topLevelRacks.length ? 'Deselect All' : 'Select All'}
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0 || deleting}
              onClick={handleConfirmDelete}
              style={{
                height: 36,
                padding: '0 18px',
                borderRadius: 999,
                border: 'none',
                background: selectedIds.length === 0 ? '#D9B6B2' : '#B4433C',
                color: '#FAF7F2',
                fontSize: 13,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <Trash2 size={14} />
              <span>
                {deleting
                  ? 'Deleting...'
                  : `Delete Selected (${selectedIds.length})`}
              </span>
            </button>
          </div>
        </motion.div>
      )}

      {topLevelRacks.length === 0 ? (
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
            Create your first category rack to start shelving your PDFs and EPUBs.
          </p>
          <button className="zen-btn-primary" onClick={onNewCategoryClick}>
            <Plus size={16} />
            <span>Create First Rack</span>
          </button>
        </div>
      ) : (
        <div className="rack-grid">
          {topLevelRacks.map((cat, idx) => {
            const allIds = getDescendantIds(cat.id);
            const binderCount = allIds.length - 1;
            const catBooks = books.filter((b) => allIds.includes(b.categoryId));
            const previewSpines = catBooks.slice(0, 6);
            const formats =
              Array.from(new Set(catBooks.map((b) => b.format.toUpperCase()))).join(' & ') ||
              'Empty Rack';
            const isSelected = selectedIds.includes(cat.id);

            return (
              <motion.button
                key={cat.id}
                className="rack-card"
                style={
                  deleteMode
                    ? {
                        borderColor: isSelected ? '#B4433C' : '#E5DDD0',
                        background: isSelected ? '#FDF4F2' : '#FAF7F2',
                        boxShadow: isSelected
                          ? '0 0 0 2px rgba(180, 67, 60, 0.25)'
                          : undefined,
                      }
                    : undefined
                }
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: deleteMode ? -2 : -5 }}
                whileTap={{ scale: 0.985 }}
                onClick={(e) => {
                  if (deleteMode) {
                    toggleSelect(cat.id);
                    return;
                  }
                  const rect = e.currentTarget.getBoundingClientRect();
                  onSelectCategory(cat, rect);
                }}
              >
                {deleteMode && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 16,
                      right: 16,
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      border: `2px solid ${isSelected ? '#B4433C' : '#C5B9A7'}`,
                      background: isSelected ? '#B4433C' : '#FFFFFF',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isSelected && <Check size={14} strokeWidth={3} />}
                  </div>
                )}

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
                    {catBooks.length} {catBooks.length === 1 ? 'book' : 'books'}
                    {binderCount > 0
                      ? ` • ${binderCount} ${binderCount === 1 ? 'binder' : 'binders'}`
                      : ` • ${formats}`}
                  </span>
                  <span
                    className="rack-card-cta"
                    style={
                      deleteMode
                        ? { opacity: 1, transform: 'none', color: isSelected ? '#B4433C' : '#8C8073' }
                        : undefined
                    }
                  >
                    {deleteMode
                      ? isSelected
                        ? 'Selected'
                        : 'Select to delete'
                      : 'Open Rack →'}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </motion.section>
  );
};
