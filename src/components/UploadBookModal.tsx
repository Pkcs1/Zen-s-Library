import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Plus, Sparkles, UploadCloud, X } from 'lucide-react';
import { BookFormat, BookItem, CategoryRack, SPINE_PALETTE } from '../types/library';
import { AutoColorResult, detectAutoBookColor, pickHarmoniousColor } from '../lib/autoColor';

interface UploadBookModalProps {
  categories: CategoryRack[];
  defaultCategoryId: string;
  isCloudSynced: boolean;
  onClose: () => void;
  onSaveBooks: (
    entries: Array<{ book: BookItem; file: File }>,
    onProgress?: (
      completed: number,
      total: number,
      chunkProgress?: { uploaded: number; total: number }
    ) => void
  ) => Promise<{
    saved: BookItem[];
    failed: Array<{ bookId: string; title: string; error: string }>;
    cloudWarnings?: Array<{ bookId: string; title: string; error: string }>;
  }>;
}

interface QueuedBook {
  id: string;
  file: File;
  title: string;
  author: string;
  categoryId: string;
  colorMode: 'auto' | 'manual';
  selectedPaletteIdx: number;
  autoColor: AutoColorResult;
  spineThickness: number;
  spineHeight: number;
}

function cleanFileTitle(fileName: string): string {
  return fileName
    .replace(/\.(pdf|epub)$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}

function getFileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function resolveSpineAppearance(item: QueuedBook) {
  const manualPalette = SPINE_PALETTE[item.selectedPaletteIdx] ?? SPINE_PALETTE[0];
  return {
    color: item.colorMode === 'auto' ? item.autoColor.color : manualPalette.color,
    textColor: item.colorMode === 'auto' ? item.autoColor.textColor : manualPalette.textColor,
    finishLabel: item.colorMode === 'auto' ? item.autoColor.label : manualPalette.finish,
  };
}

export const UploadBookModal: React.FC<UploadBookModalProps> = ({
  categories,
  defaultCategoryId,
  isCloudSynced,
  onClose,
  onSaveBooks,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mountedRef = useRef(true);

  const [queue, setQueue] = useState<QueuedBook[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [defaultRackId, setDefaultRackId] = useState(
    defaultCategoryId || categories[0]?.id || ''
  );
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
    chunkUploaded?: number;
    chunkTotal?: number;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const activeIdx = useMemo(() => {
    if (queue.length === 0) return -1;
    const idx = queue.findIndex((item) => item.id === activeId);
    return idx >= 0 ? idx : 0;
  }, [queue, activeId]);

  const activeBook = activeIdx >= 0 ? queue[activeIdx] : null;
  const fallbackAppearance = useMemo(
    () => ({
      ...pickHarmoniousColor('new-book'),
      finishLabel: pickHarmoniousColor('new-book').label,
    }),
    []
  );
  const activeAppearance = activeBook
    ? resolveSpineAppearance(activeBook)
    : fallbackAppearance;

  const updateActiveBook = (patch: Partial<QueuedBook>) => {
    if (!activeBook) return;
    const targetId = activeBook.id;
    setQueue((prev) =>
      prev.map((item) => (item.id === targetId ? { ...item, ...patch } : item))
    );
  };

  const handleFilesPick = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    const existingKeys = new Set(queue.map((item) => getFileKey(item.file)));
    const validItems: QueuedBook[] = [];
    let unsupportedCount = 0;

    for (const picked of incoming) {
      const lower = picked.name.toLowerCase();
      if (!lower.endsWith('.pdf') && !lower.endsWith('.epub')) {
        unsupportedCount++;
        continue;
      }
      const key = getFileKey(picked);
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);

      const cleanTitle = cleanFileTitle(picked.name);
      validItems.push({
        id: crypto.randomUUID(),
        file: picked,
        title: cleanTitle,
        author: '',
        categoryId: defaultRackId || categories[0]?.id || '',
        colorMode: 'auto',
        selectedPaletteIdx: 0,
        autoColor: pickHarmoniousColor(cleanTitle || picked.name),
        spineThickness: 60,
        spineHeight: 230,
      });
    }

    if (validItems.length === 0) {
      if (unsupportedCount > 0) {
        setError('Please choose .pdf or .epub files.');
      }
      return;
    }

    if (unsupportedCount > 0) {
      setError(
        `Skipped ${unsupportedCount} unsupported file(s). Only .pdf and .epub files are supported.`
      );
    } else {
      setError(null);
    }

    setQueue((prev) => [...prev, ...validItems]);
    setActiveId((prev) => prev ?? validItems[0].id);

    // Detect PDF cover colors sequentially so dropping many books doesn't spike memory
    void (async () => {
      for (const item of validItems) {
        const detected = await detectAutoBookColor(item.file, item.title);
        if (!mountedRef.current) return;
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, autoColor: detected } : q))
        );
      }
    })();
  };

  const handleRemoveBook = (idToRemove: string) => {
    setQueue((prev) => {
      const removeIdx = prev.findIndex((item) => item.id === idToRemove);
      if (removeIdx < 0) return prev;
      const next = prev.filter((item) => item.id !== idToRemove);
      if (activeId === idToRemove) {
        const nextActive = next[Math.min(removeIdx, next.length - 1)] ?? null;
        setActiveId(nextActive ? nextActive.id : null);
      }
      return next;
    });
  };

  const handleClearQueue = () => {
    setQueue([]);
    setActiveId(null);
    setError(null);
  };

  const handleApplyRackToAll = () => {
    if (!activeBook) return;
    const rackId = activeBook.categoryId;
    setDefaultRackId(rackId);
    setQueue((prev) => prev.map((item) => ({ ...item, categoryId: rackId })));
  };

  const handleApplyAuthorToAll = () => {
    if (!activeBook) return;
    const authorValue = activeBook.author;
    setQueue((prev) => prev.map((item) => ({ ...item, author: authorValue })));
  };

  const handleTitleChange = (nextTitle: string) => {
    if (!activeBook) return;
    const targetId = activeBook.id;
    const shouldRefreshHashColor =
      activeBook.colorMode === 'auto' &&
      !activeBook.file.name.toLowerCase().endsWith('.pdf') &&
      nextTitle.trim().length > 0;

    setQueue((prev) =>
      prev.map((item) => {
        if (item.id !== targetId) return item;
        return {
          ...item,
          title: nextTitle,
          autoColor: shouldRefreshHashColor
            ? pickHarmoniousColor(nextTitle)
            : item.autoColor,
        };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (queue.length === 0) {
      setError('Please drop or select at least one PDF or EPUB file first.');
      return;
    }

    const missingTitle = queue.find((item) => !item.title.trim());
    if (missingTitle) {
      setActiveId(missingTitle.id);
      setError('Please enter a title for every queued book.');
      return;
    }

    const entries = queue.map((item) => {
      const format: BookFormat = item.file.name.toLowerCase().endsWith('.epub')
        ? 'epub'
        : 'pdf';
      const appearance = resolveSpineAppearance(item);
      const book: BookItem = {
        id: item.id,
        categoryId: item.categoryId || categories[0]?.id || '',
        title: item.title.trim(),
        author: item.author.trim() || 'Unknown Author',
        format,
        fileName: item.file.name,
        fileSizeBytes: item.file.size,
        pageCount: 0,
        spineColor: appearance.color,
        spineTextColor: appearance.textColor,
        spineHeight: item.spineHeight,
        spineThickness: item.spineThickness,
        tiltDeg: 0,
        currentLocation: '1',
        progressPercent: 0,
        createdAt: new Date().toISOString(),
        hasLocalBlob: true,
      };
      return { book, file: item.file };
    });

    setSaving(true);
    setUploadProgress({ done: 0, total: entries.length });
    setError(null);

    try {
      const result = await onSaveBooks(entries, (done, total, chunkProgress) => {
        if (mountedRef.current) {
          setUploadProgress({
            done,
            total,
            chunkUploaded: chunkProgress?.uploaded,
            chunkTotal: chunkProgress?.total,
          });
        }
      });

      if (!mountedRef.current) return;

      if (result.failed.length === 0) {
        if (result.cloudWarnings && result.cloudWarnings.length > 0) {
          setQueue([]);
          setActiveId(null);
          setSaving(false);
          setUploadProgress(null);
          setError(
            `Saved locally, but cloud sync failed for ${result.cloudWarnings.length} book(s) (${result.cloudWarnings[0].title}: ${result.cloudWarnings[0].error}). You can retry from Cloud Sync.`
          );
          return;
        }
        onClose();
        return;
      }

      const failedIds = new Set(result.failed.map((f) => f.bookId));
      const remaining = queue.filter((item) => failedIds.has(item.id));
      setQueue(remaining);
      setActiveId(remaining[0]?.id ?? null);
      setSaving(false);
      setUploadProgress(null);
      setError(
        `${result.failed.length} of ${entries.length} book(s) failed to save (${result.failed[0].title}: ${result.failed[0].error}). Remaining books are still queued to retry.`
      );
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to save books.');
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const handleRequestClose = () => {
    if (saving) return;
    onClose();
  };

  const primaryButtonLabel = saving
    ? uploadProgress?.chunkTotal && uploadProgress.chunkTotal > 1
      ? queue.length > 1
        ? `Placing ${Math.min(uploadProgress.done + 1, uploadProgress.total)} of ${uploadProgress.total} (part ${uploadProgress.chunkUploaded ?? 0}/${uploadProgress.chunkTotal})...`
        : `Uploading part ${uploadProgress.chunkUploaded ?? 0}/${uploadProgress.chunkTotal}...`
      : queue.length > 1 && uploadProgress
        ? `Placing ${Math.min(uploadProgress.done + 1, uploadProgress.total)} of ${uploadProgress.total}...`
        : 'Placing on Shelf...'
    : queue.length > 1
      ? `Place ${queue.length} Books on Shelf →`
      : 'Place on Shelf →';

  return (
    <motion.div
      className="modal-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleRequestClose}
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
            {queue.length > 1
              ? `Add ${queue.length} Books to Your Rack`
              : 'Add a Book to Your Rack'}
          </h2>
          <button
            type="button"
            onClick={handleRequestClose}
            disabled={saving}
            style={{
              border: 'none',
              background: 'none',
              color: '#7A6F64',
              padding: 4,
              opacity: saving ? 0.4 : 1,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="upload-modal-grid">
            {/* Left Column: Files + Queue + Metadata + Color Picker */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.epub"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesPick(e.target.files);
                  }
                  e.target.value = '';
                }}
              />

              {/* Dropzone */}
              <div
                onClick={() => !saving && fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (!saving && e.dataTransfer.files?.length) {
                    handleFilesPick(e.dataTransfer.files);
                  }
                }}
                style={{
                  padding: queue.length === 0 ? '20px 24px' : '12px 16px',
                  borderRadius: 16,
                  background: dragOver ? '#EFE6D9' : '#F2ECE2',
                  border: `1.5px dashed ${queue.length > 0 || dragOver ? '#C86D51' : '#D5CAB8'}`,
                  cursor: saving ? 'default' : 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {queue.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <UploadCloud size={28} color="#C86D51" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        Drop PDF or EPUB files here, or click to browse
                      </div>
                      <div style={{ fontSize: 12, color: '#7A6F64', marginTop: 2 }}>
                        Select one or multiple books &mdash; stored locally &amp; synced when
                        Supabase is connected
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Plus size={18} color="#C86D51" />
                      <span style={{ fontWeight: 600, fontSize: 13 }}>
                        Add more PDF or EPUB files (click or drop)
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: '#7A6F64', fontWeight: 600 }}>
                      Multi-upload ready
                    </span>
                  </div>
                )}
              </div>

              {/* Single-file ready card OR Multi-file queue */}
              {queue.length === 1 && activeBook && (
                <div
                  style={{
                    padding: '14px 18px',
                    borderRadius: 14,
                    background: '#FFFFFF',
                    border: '1px solid #E5DDD0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: '#2B463C',
                        fontSize: 11,
                        fontWeight: 700,
                        marginBottom: 4,
                      }}
                    >
                      <CheckCircle2 size={14} />
                      <span>FILE READY FOR LIBRARY</span>
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: 18,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {activeBook.file.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#7A6F64', marginTop: 2 }}>
                      {(activeBook.file.size / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>
                  <button
                    type="button"
                    title="Remove file"
                    disabled={saving}
                    onClick={() => handleRemoveBook(activeBook.id)}
                    style={{
                      border: 'none',
                      background: '#F2ECE2',
                      color: '#7A6F64',
                      borderRadius: 999,
                      width: 28,
                      height: 28,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
              )}

              {queue.length > 1 && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#5A5148',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {queue.length} BOOKS QUEUED (CLICK TO EDIT)
                    </span>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleClearQueue}
                      style={{
                        border: 'none',
                        background: 'none',
                        padding: 0,
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#B4433C',
                      }}
                    >
                      Clear all
                    </button>
                  </div>

                  <div className="upload-queue-list">
                    {queue.map((item) => {
                      const isActive = activeBook?.id === item.id;
                      const itemAppearance = resolveSpineAppearance(item);
                      const ext = item.file.name.toLowerCase().endsWith('.epub')
                        ? 'EPUB'
                        : 'PDF';
                      return (
                        <div
                          key={item.id}
                          onClick={() => setActiveId(item.id)}
                          className={`upload-queue-item${isActive ? ' active' : ''}`}
                        >
                          <span
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              background: itemAppearance.color,
                              border: '1px solid rgba(44,38,33,0.2)',
                              flexShrink: 0,
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: '#2C2621',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {item.title || item.file.name}
                            </div>
                            <div style={{ fontSize: 11, color: '#7A6F64' }}>
                              {ext} &bull; {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                            </div>
                          </div>
                          <button
                            type="button"
                            title="Remove from queue"
                            disabled={saving}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveBook(item.id);
                            }}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: '#7A6F64',
                              padding: 4,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#5A5148',
                    marginBottom: 6,
                    letterSpacing: '0.06em',
                  }}
                >
                  BOOK / SPINE TITLE
                </label>
                <input
                  className="zen-input"
                  value={activeBook ? activeBook.title : ''}
                  disabled={!activeBook || saving}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder={
                    activeBook ? 'e.g. Atomic Habits' : 'Select files above to edit title'
                  }
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                    }}
                  >
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#5A5148',
                        letterSpacing: '0.06em',
                      }}
                    >
                      AUTHOR
                    </label>
                    {queue.length > 1 && activeBook && activeBook.author.trim() && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleApplyAuthorToAll}
                        style={{
                          border: 'none',
                          background: 'none',
                          padding: 0,
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#C86D51',
                        }}
                      >
                        Apply to all
                      </button>
                    )}
                  </div>
                  <input
                    className="zen-input"
                    value={activeBook ? activeBook.author : ''}
                    disabled={!activeBook || saving}
                    onChange={(e) => updateActiveBook({ author: e.target.value })}
                    placeholder="e.g. James Clear"
                  />
                </div>

                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                    }}
                  >
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#5A5148',
                        letterSpacing: '0.06em',
                      }}
                    >
                      RACK OR BINDER
                    </label>
                    {queue.length > 1 && activeBook && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleApplyRackToAll}
                        style={{
                          border: 'none',
                          background: 'none',
                          padding: 0,
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#C86D51',
                        }}
                      >
                        Apply to all
                      </button>
                    )}
                  </div>
                  <select
                    className="zen-input"
                    disabled={saving}
                    value={activeBook ? activeBook.categoryId : defaultRackId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setDefaultRackId(nextId);
                      if (activeBook) {
                        updateActiveBook({ categoryId: nextId });
                      }
                    }}
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
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#5A5148',
                    marginBottom: 10,
                    letterSpacing: '0.06em',
                  }}
                >
                  3D SPINE COLOR &amp; FINISH
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    disabled={!activeBook || saving}
                    onClick={() => updateActiveBook({ colorMode: 'auto' })}
                    title="Automatically pick color from PDF cover or book title"
                    style={{
                      height: 32,
                      padding: '0 12px',
                      borderRadius: 999,
                      border:
                        (activeBook?.colorMode ?? 'auto') === 'auto'
                          ? '2px solid #C86D51'
                          : '1px solid #D5CAB8',
                      background:
                        (activeBook?.colorMode ?? 'auto') === 'auto' ? '#2C2621' : '#F2ECE2',
                      color:
                        (activeBook?.colorMode ?? 'auto') === 'auto' ? '#FAF7F2' : '#5A5148',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      opacity: activeBook ? 1 : 0.6,
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
                      disabled={!activeBook || saving}
                      onClick={() =>
                        updateActiveBook({ colorMode: 'manual', selectedPaletteIdx: i })
                      }
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: opt.color,
                        border:
                          activeBook?.colorMode === 'manual' &&
                          activeBook.selectedPaletteIdx === i
                            ? '3px solid #C86D51'
                            : '1px solid rgba(44,38,33,0.18)',
                        padding: 0,
                        opacity: activeBook ? 1 : 0.6,
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#5A5148' }}>
                  Spine Thickness ({activeBook ? activeBook.spineThickness : 60}px)
                  <input
                    type="range"
                    min={44}
                    max={72}
                    disabled={!activeBook || saving}
                    value={activeBook ? activeBook.spineThickness : 60}
                    onChange={(e) =>
                      updateActiveBook({ spineThickness: Number(e.target.value) })
                    }
                    style={{ width: '100%', accentColor: '#C86D51' }}
                  />
                </label>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#5A5148' }}>
                  Book Height ({activeBook ? activeBook.spineHeight : 230}px)
                  <input
                    type="range"
                    min={198}
                    max={246}
                    disabled={!activeBook || saving}
                    value={activeBook ? activeBook.spineHeight : 230}
                    onChange={(e) =>
                      updateActiveBook({ spineHeight: Number(e.target.value) })
                    }
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
                minWidth: 0,
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
                {queue.length <= 1 ? (
                  <div
                    className="book-spine-face"
                    style={{
                      width: activeBook ? activeBook.spineThickness : 60,
                      height: activeBook ? activeBook.spineHeight : 230,
                      background: activeAppearance.color,
                      color: activeAppearance.textColor,
                      boxShadow: '-12px 16px 24px rgba(44, 38, 33, 0.24)',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    <div className="book-spine-sheen" />
                    <div className="book-spine-band" style={{ top: 14 }} />
                    <div className="book-spine-band" style={{ bottom: 14 }} />
                    <span className="book-spine-title">
                      {activeBook?.title || 'YOUR BOOK TITLE'}
                    </span>
                  </div>
                ) : (
                  <div className="upload-preview-shelf">
                    {queue.map((item) => {
                      const isActive = activeBook?.id === item.id;
                      const appearance = resolveSpineAppearance(item);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveId(item.id)}
                          title={item.title || item.file.name}
                          className="book-spine-face"
                          style={{
                            border: isActive
                              ? '2px solid #C86D51'
                              : '1px solid rgba(44,38,33,0.12)',
                            width: item.spineThickness,
                            height: item.spineHeight,
                            background: appearance.color,
                            color: appearance.textColor,
                            flexShrink: 0,
                            transform: isActive ? 'translateY(-10px)' : 'none',
                            boxShadow: isActive
                              ? '-10px 18px 24px rgba(200, 109, 81, 0.34)'
                              : '-8px 12px 18px rgba(44, 38, 33, 0.2)',
                            transition: 'all 0.22s ease',
                          }}
                        >
                          <div className="book-spine-sheen" />
                          <div className="book-spine-band" style={{ top: 14 }} />
                          <div className="book-spine-band" style={{ bottom: 14 }} />
                          <span className="book-spine-title">
                            {item.title || 'UNTITLED'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="oak-plank" style={{ height: 18, width: '92%' }} />
              </div>

              <div style={{ fontSize: 12, color: '#7A6F64', textAlign: 'center' }}>
                {queue.length > 1 && activeBook
                  ? `Book ${activeIdx + 1} of ${queue.length} • ${activeAppearance.finishLabel} • ${activeBook.spineThickness}px Spine`
                  : `${activeAppearance.finishLabel} • ${activeBook ? activeBook.spineThickness : 60}px Spine`}
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
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: '#4E8A6E' }}>
              &bull;{' '}
              {isCloudSynced
                ? 'Syncs privately to your Supabase Cloud Library'
                : 'Saves instantly to Local IndexedDB (Cloud Sync Ready)'}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                className="zen-btn-secondary"
                disabled={saving}
                onClick={handleRequestClose}
              >
                Cancel
              </button>
              <button type="submit" className="zen-btn-primary" disabled={saving}>
                {primaryButtonLabel}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
