import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { CategoryRack, SPINE_PALETTE } from '../types/library';
import { pickHarmoniousColor } from '../lib/autoColor';

interface NewCategoryModalProps {
  nextOrder: number;
  parentCategory?: CategoryRack | null;
  onClose: () => void;
  onCreate: (category: CategoryRack) => Promise<void>;
}

export const NewCategoryModal: React.FC<NewCategoryModalProps> = ({
  nextOrder,
  parentCategory,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [colorMode, setColorMode] = useState<'auto' | 'manual'>('auto');
  const [accentColor, setAccentColor] = useState(
    parentCategory ? SPINE_PALETTE[0].color : '#C86D51'
  );

  const isBinder = Boolean(parentCategory);
  const resolvedColor =
    isBinder && colorMode === 'auto'
      ? pickHarmoniousColor(name || 'binder').color
      : accentColor;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onCreate({
      id: crypto.randomUUID(),
      parentId: parentCategory ? parentCategory.id : null,
      name: name.trim(),
      description: description.trim(),
      accentColor: resolvedColor,
      sortOrder: nextOrder,
      createdAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <motion.div
      className="modal-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-card"
        style={{ maxWidth: 480 }}
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '20px 28px',
            borderBottom: '1px solid #EBE3D6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, margin: 0 }}>
              {isBinder ? 'New Sub-Category Binder' : 'New Category Rack'}
            </h3>
            {isBinder && parentCategory && (
              <div style={{ fontSize: 12, color: '#7A6F64', marginTop: 2 }}>
                Inside <strong>{parentCategory.name}</strong>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', color: '#7A6F64' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5A5148', marginBottom: 6 }}>
              {isBinder ? 'BINDER / SUB-GENRE NAME' : 'RACK NAME'}
            </label>
            <input
              className="zen-input"
              placeholder={isBinder ? 'e.g. Stoicism, Cyberpunk, Lecture Notes' : 'e.g. Manga & Graphic Novels'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5A5148', marginBottom: 6 }}>
              SHORT DESCRIPTION (OPTIONAL)
            </label>
            <input
              className="zen-input"
              placeholder={isBinder ? 'e.g. Curated editions & notes for this genre' : 'e.g. Favorite illustrated editions'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {isBinder && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5A5148', marginBottom: 10 }}>
                BINDER LINEN COLOR
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setColorMode('auto')}
                  style={{
                    height: 30,
                    padding: '0 12px',
                    borderRadius: 999,
                    border:
                      colorMode === 'auto' ? '2px solid #C86D51' : '1px solid #D5CAB8',
                    background: colorMode === 'auto' ? '#2C2621' : '#F2ECE2',
                    color: colorMode === 'auto' ? '#FAF7F2' : '#5A5148',
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <Sparkles size={12} />
                  <span>Auto</span>
                </button>
                {SPINE_PALETTE.slice(0, 8).map((opt) => (
                  <button
                    type="button"
                    key={opt.name}
                    title={opt.name}
                    onClick={() => {
                      setColorMode('manual');
                      setAccentColor(opt.color);
                    }}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: opt.color,
                      border:
                        colorMode === 'manual' && accentColor === opt.color
                          ? '3px solid #C86D51'
                          : '1px solid rgba(44,38,33,0.18)',
                      padding: 0,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" className="zen-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="zen-btn-primary">
              {isBinder ? 'Place Binder on Shelf' : 'Create Rack'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
