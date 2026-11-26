import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Trash2, X } from 'lucide-react';

interface ResetLibraryModalProps {
  rackCount: number;
  bookCount: number;
  isCloudSynced: boolean;
  onClose: () => void;
  onClearAll: () => Promise<void>;
  onRestoreSamples: () => Promise<void>;
}

export const ResetLibraryModal: React.FC<ResetLibraryModalProps> = ({
  rackCount,
  bookCount,
  isCloudSynced,
  onClose,
  onClearAll,
  onRestoreSamples,
}) => {
  const [busyAction, setBusyAction] = useState<'clear' | 'restore' | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClear = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setBusyAction('clear');
    await onClearAll();
    setBusyAction(null);
    onClose();
  };

  const handleRestore = async () => {
    setBusyAction('restore');
    await onRestoreSamples();
    setBusyAction(null);
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
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, margin: 0 }}>
            Reset or Clear Library
          </h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', color: '#7A6F64' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, fontSize: 14, color: '#5A5148', lineHeight: 1.6 }}>
            You currently have <strong>{rackCount} racks</strong> and{' '}
            <strong>{bookCount} books</strong>.
            {isCloudSynced
              ? ' Changes will apply to both this browser and your synced Supabase cloud library.'
              : ' Changes apply to your local browser library.'}
          </p>

          {/* Option 1: Remove All Racks & Books */}
          <div
            style={{
              padding: 18,
              borderRadius: 16,
              background: '#FDF4F2',
              border: '1px solid #F0C7BE',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: '#9E332C', marginBottom: 4 }}>
              Remove All Racks &amp; Books
            </div>
            <div style={{ fontSize: 13, color: '#6E514D', marginBottom: 14, lineHeight: 1.5 }}>
              Permanently deletes every category rack, uploaded PDF/EPUB, and bookmark so you can
              start with a completely blank library.
            </div>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handleClear}
              style={{
                height: 38,
                padding: '0 18px',
                borderRadius: 999,
                border: 'none',
                background: confirmClear ? '#9E332C' : '#B4433C',
                color: '#FAF7F2',
                fontSize: 13,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Trash2 size={14} />
              <span>
                {busyAction === 'clear'
                  ? 'Clearing...'
                  : confirmClear
                    ? 'Click Again to Confirm Delete All'
                    : 'Remove All Racks & Books'}
              </span>
            </button>
          </div>

          {/* Option 2: Restore Default Sample Library */}
          <div
            style={{
              padding: 18,
              borderRadius: 16,
              background: '#F4EFE6',
              border: '1px solid #E5DDD0',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: '#2C2621', marginBottom: 4 }}>
              Restore Sample Library
            </div>
            <div style={{ fontSize: 13, color: '#6E6358', marginBottom: 14, lineHeight: 1.5 }}>
              Resets your shelves back to the 6 curated starter racks and preloaded classic books.
            </div>
            <button
              type="button"
              className="zen-btn-secondary"
              disabled={busyAction !== null}
              onClick={handleRestore}
            >
              <RotateCcw size={14} />
              <span>{busyAction === 'restore' ? 'Restoring...' : 'Restore Sample Books'}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
