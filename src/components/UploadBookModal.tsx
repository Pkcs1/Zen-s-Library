import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Sparkles, UploadCloud, X } from 'lucide-react';
import { BookFormat, BookItem, CategoryRack, SPINE_PALETTE } from '../types/library';
import { AutoColorResult, detectAutoBookColor, pickHarmoniousColor } from '../lib/autoColor';

interface UploadBookModalProps {
  categories: CategoryRack[];
  defaultCategoryId: string;
  isCloudSynced: boolean;
  onClose: () => void;
  onSaveBook: (book: BookItem, file: File) => Promise<void>;
}

export const UploadBookModal: React.FC<UploadBookModalProps> = ({
  categories,
  defaultCategoryId,
  isCloudSynced,
  onClose,
  onSaveBook,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [categoryId, setCategoryId] = useState(defaultCategoryId || categories[0]?.id || '');
  const [colorMode, setColorMode] = useState<'auto' | 'manual'>('auto');
  const [selectedPaletteIdx, setSelectedPaletteIdx] = useState(0);
  const [autoColor, setAutoColor] = useState<AutoColorResult>(() => pickHarmoniousColor('new-book'));
  const [spineThickness, setSpineThickness] = useState(60);
  const [spineHeight, setSpineHeight] = useState(230);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (colorMode !== 'auto') return;
    if (file) {
      let active = true;
      detectAutoBookColor(file, title).then((res) => {
        if (active) setAutoColor(res);
      });
      return () => {
        active = false;
      };
    } else if (title.trim()) {
      setAutoColor(pickHarmoniousColor(title));
    }
  }, [colorMode, file, title]);

  const manualPalette = SPINE_PALETTE[selectedPaletteIdx];
  const activeColor = colorMode === 'auto' ? autoColor.color : manualPalette.color;
  const activeTextColor = colorMode === 'auto' ? autoColor.textColor : manualPalette.textColor;
  const activeFinishLabel = colorMode === 'auto' ? autoColor.label : manualPalette.finish;

  const handleFilePick = (picked: File) => {
    const lower = picked.name.toLowerCase();
    if (!lower.endsWith('.pdf') && !lower.endsWith('.epub')) {
      setError('Please choose a .pdf or .epub file.');
      return;
    }
    setError(null);
    setFile(picked);
    if (!title) {
      const cleanName = picked.name
        .replace(/\.(pdf|epub)$/i, '')
        .replace(/[_-]+/g, ' ')
        .trim();
      setTitle(cleanName);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please drop or select a PDF or EPUB file first.');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a book title for the spine.');
      return;
    }

    setSaving(true);
    try {
      const format: BookFormat = file.name.toLowerCase().endsWith('.epub') ? 'epub' : 'pdf';
      const newBook: BookItem = {
        id: crypto.randomUUID(),
        categoryId: categoryId || categories[0].id,
        title: title.trim(),
        author: author.trim() || 'Unknown Author',
        format,
        fileName: file.name,
        fileSizeBytes: file.size,
        pageCount: 0,
        spineColor: activeColor,
        spineTextColor: activeTextColor,
        spineHeight,
        spineThickness,
        tiltDeg: 0,
        currentLocation: '1',
        progressPercent: 0,
        createdAt: new Date().toISOString(),
        hasLocalBlob: true,
      };
      await onSaveBook(newBook, file);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save book.');
      setSaving(false);
    }
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
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '24px 36px',
            borderBottom: '1px solid #EBE3D6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, margin: 0 }}>
            Add a Book to Your Rack
          </h2>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'none', color: '#7A6F64', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="upload-modal-grid">
            {/* Left Column: File + Metadata + Color Picker */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped) handleFilePick(dropped);
                }}
                style={{
                  padding: '20px 24px',
                  borderRadius: 16,
                  background: dragOver ? '#EFE6D9' : '#F2ECE2',
                  border: `1.5px dashed ${file || dragOver ? '#C86D51' : '#D5CAB8'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.epub"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const picked = e.target.files?.[0];
                    if (picked) handleFilePick(picked);
                  }}
                />
                {file ? (
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: '#2B463C',
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      <CheckCircle2 size={15} />
                      <span>FILE READY FOR LIBRARY</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600 }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#7A6F64', marginTop: 4 }}>
                      {(file.size / (1024 * 1024)).toFixed(2)} MB &bull; Click to replace PDF or EPUB
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <UploadCloud size={28} color="#C86D51" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        Drop your PDF or EPUB here, or click to browse
                      </div>
                      <div style={{ fontSize: 12, color: '#7A6F64', marginTop: 2 }}>
                        Stored locally in IndexedDB &amp; synced privately when Supabase is connected
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5A5148', marginBottom: 6, letterSpacing: '0.06em' }}>
                  BOOK / SPINE TITLE
                </label>
                <input
                  className="zen-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Atomic Habits"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5A5148', marginBottom: 6, letterSpacing: '0.06em' }}>
                    AUTHOR
                  </label>
                  <input
                    className="zen-input"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="e.g. James Clear"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5A5148', marginBottom: 6, letterSpacing: '0.06em' }}>
                    RACK OR BINDER
                  </label>
                  <select
                    className="zen-input"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    {categories
                      .filter((c) => !c.parentId)
                      .map((rack) => {
                        const childBinders = categories.filter((b) => b.parentId === rack.id);
                        return (
                          <React.Fragment key={rack.id}>
                            <option value={rack.id}>{rack.name}</option>
                            {childBinders.map((binder) => (
                              <option key={binder.id} value={binder.id}>
                                &nbsp;&nbsp;↳ {binder.name} (Binder)
                              </option>
                            ))}
                          </React.Fragment>
                        );
                      })}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5A5148', marginBottom: 10, letterSpacing: '0.06em' }}>
                  3D SPINE COLOR &amp; FINISH
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setColorMode('auto')}
                    title="Automatically pick color from PDF cover or book title"
                    style={{
                      height: 32,
                      padding: '0 12px',
                      borderRadius: 999,
                      border:
                        colorMode === 'auto'
                          ? '2px solid #C86D51'
                          : '1px solid #D5CAB8',
                      background: colorMode === 'auto' ? '#2C2621' : '#F2ECE2',
                      color: colorMode === 'auto' ? '#FAF7F2' : '#5A5148',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Sparkles size={13} />
                    <span>Auto</span>
                  </button>

                  {SPINE_PALETTE.map((opt, i) => (
                    <button
                      type="button"
                      key={opt.name}
                      title={opt.name}
                      onClick={() => {
                        setColorMode('manual');
                        setSelectedPaletteIdx(i);
                      }}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: opt.color,
                        border:
                          colorMode === 'manual' && selectedPaletteIdx === i
                            ? '3px solid #C86D51'
                            : '1px solid rgba(44,38,33,0.18)',
                        padding: 0,
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#5A5148' }}>
                  Spine Thickness ({spineThickness}px)
                  <input
                    type="range"
                    min={44}
                    max={72}
                    value={spineThickness}
                    onChange={(e) => setSpineThickness(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#C86D51' }}
                  />
                </label>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#5A5148' }}>
                  Book Height ({spineHeight}px)
                  <input
                    type="range"
                    min={198}
                    max={246}
                    value={spineHeight}
                    onChange={(e) => setSpineHeight(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#C86D51' }}
                  />
                </label>
              </div>

              {error && (
                <div style={{ fontSize: 13, color: '#B4433C', fontWeight: 600 }}>{error}</div>
              )}
            </div>

            {/* Right Column: Live 3D Shelf Preview */}
            <div
              style={{
                borderRadius: 20,
                background: '#F2ECE2',
                border: '1px solid #E5DDD0',
                padding: '22px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  color: '#7A6F64',
                }}
              >
                LIVE SHELF PREVIEW
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '100%',
                  margin: '16px 0',
                }}
              >
                <div
                  className="book-spine-face"
                  style={{
                    width: spineThickness,
                    height: spineHeight,
                    background: activeColor,
                    color: activeTextColor,
                    boxShadow: '-12px 16px 24px rgba(44, 38, 33, 0.24)',
                    transition: 'all 0.25s ease',
                  }}
                >
                  <div className="book-spine-sheen" />
                  <div className="book-spine-band" style={{ top: 14 }} />
                  <div className="book-spine-band" style={{ bottom: 14 }} />
                  <span className="book-spine-title">{title || 'YOUR BOOK TITLE'}</span>
                </div>
                <div className="oak-plank" style={{ height: 18, width: '92%' }} />
              </div>

              <div style={{ fontSize: 12, color: '#7A6F64' }}>
                {activeFinishLabel} &bull; {spineThickness}px Spine
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '18px 36px',
              borderTop: '1px solid #EBE3D6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: '#4E8A6E' }}>
              &bull;{' '}
              {isCloudSynced
                ? 'Syncs privately to your Supabase Cloud Library'
                : 'Saves instantly to Local IndexedDB (Cloud Sync Ready)'}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" className="zen-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="zen-btn-primary" disabled={saving}>
                {saving ? 'Placing on Shelf...' : 'Place on Shelf →'}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
