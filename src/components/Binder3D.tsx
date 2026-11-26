import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, FolderOpen } from 'lucide-react';
import { CategoryRack } from '../types/library';

interface Binder3DProps {
  binder: CategoryRack;
  bookCount: number;
  subBinderCount: number;
  isAnyHovered: boolean;
  isHovered: boolean;
  deleteMode?: boolean;
  isSelectedForDelete?: boolean;
  onToggleSelectForDelete?: (binderId: string) => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onOpenBinder: (binder: CategoryRack, originRect: DOMRect) => void;
}

export const Binder3D: React.FC<Binder3DProps> = ({
  binder,
  bookCount,
  subBinderCount,
  isAnyHovered,
  isHovered,
  deleteMode = false,
  isSelectedForDelete = false,
  onToggleSelectForDelete,
  onHoverStart,
  onHoverEnd,
  onOpenBinder,
}) => {
  return (
    <motion.div
      className="book-3d-slot"
      style={{ zIndex: isHovered ? 50 : 3, marginRight: 8 }}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onClick={(e) => {
        if (deleteMode) {
          onToggleSelectForDelete?.(binder.id);
          return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        onOpenBinder(binder, rect);
      }}
      animate={{
        opacity: isAnyHovered && !isHovered ? 0.58 : 1,
      }}
      transition={{ duration: 0.22 }}
    >
      <motion.div
        className="book-3d-body"
        animate={{
          y: isHovered ? -14 : 0,
          z: isHovered ? 54 : 0,
          rotateY: isHovered ? -20 : 0,
          scale: isHovered ? 1.06 : 1,
        }}
        transition={{
          type: 'spring',
          stiffness: 270,
          damping: 22,
          mass: 0.92,
        }}
      >
        {/* Archival Linen Binder Spine */}
        <div
          className="binder-spine-face"
          style={{
            background: binder.accentColor || '#2B463C',
            outline: isSelectedForDelete ? '3px solid #B4433C' : undefined,
            outlineOffset: 2,
            boxShadow: isHovered
              ? '-22px 28px 40px rgba(44, 38, 33, 0.36)'
              : '-10px 12px 18px rgba(44, 38, 33, 0.22)',
          }}
        >
          <div className="book-spine-sheen" />
          {deleteMode && (
            <span
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: isSelectedForDelete ? '#B4433C' : 'rgba(255,255,255,0.92)',
                border: `2px solid ${isSelectedForDelete ? '#B4433C' : '#8C8073'}`,
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 5,
              }}
            >
              {isSelectedForDelete && <Check size={12} strokeWidth={3} />}
            </span>
          )}

          {/* Top Cream Index Label Plate */}
          <div className="binder-label-plate">
            <span className="binder-label-kicker">BINDER</span>
            <span className="binder-label-name">{binder.name}</span>
          </div>

          {/* Count pill */}
          <div className="binder-count-tag">
            {bookCount} {bookCount === 1 ? 'book' : 'books'}
          </div>

          {/* Archival Brass Finger-Pull Eyelet */}
          <div className="binder-eyelet" aria-hidden="true" />
        </div>

        {/* Binder Box Side Wall (visible when pulled halfway out) */}
        <motion.div
          className="binder-box-side"
          style={{ background: binder.accentColor || '#2B463C' }}
          animate={{
            opacity: isHovered ? 1 : 0,
            scaleX: isHovered ? 1 : 0.2,
          }}
          transition={{ duration: 0.22 }}
        />
      </motion.div>

      {/* Floating Binder Preview Card */}
      <AnimatePresence>
        {isHovered && !deleteMode && (
          <motion.div
            className="hover-preview-card"
            initial={{ opacity: 0, y: 10, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.2 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span
                className="format-badge"
                style={{
                  background: 'rgba(200, 109, 81, 0.16)',
                  color: '#A54E34',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <FolderOpen size={12} />
                <span>BINDER</span>
              </span>
              <span style={{ fontSize: 12, color: '#8C8073' }}>
                {bookCount} {bookCount === 1 ? 'book' : 'books'}
                {subBinderCount > 0 ? ` • ${subBinderCount} sub-binders` : ''}
              </span>
            </div>

            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 22,
                fontWeight: 700,
                color: '#2C2621',
                lineHeight: 1.15,
                marginBottom: 6,
              }}
            >
              {binder.name}
            </div>
            {binder.description && (
              <div style={{ fontSize: 13, color: '#6E6358', marginBottom: 14, lineHeight: 1.45 }}>
                {binder.description}
              </div>
            )}

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
              Click Binder to Open Shelf &rarr;
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
