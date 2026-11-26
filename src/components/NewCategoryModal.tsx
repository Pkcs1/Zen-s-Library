import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { CategoryRack } from '../types/library';

interface NewCategoryModalProps {
  nextOrder: number;
  onClose: () => void;
  onCreate: (category: CategoryRack) => Promise<void>;
}

export const NewCategoryModal: React.FC<NewCategoryModalProps> = ({
  nextOrder,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onCreate({
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      accentColor: '#C86D51',
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
        style={{ maxWidth: 460 }}
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
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, margin: 0 }}>
            New Category Rack
          </h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', color: '#7A6F64' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5A5148', marginBottom: 6 }}>
              RACK NAME
            </label>
            <input
              className="zen-input"
              placeholder="e.g. Manga & Graphic Novels"
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
              placeholder="e.g. Favorite illustrated editions"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" className="zen-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="zen-btn-primary">
              Create Rack
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
