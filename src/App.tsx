import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { BookItem, BookmarkItem, CategoryRack } from './types/library';
import {
  BatchSaveResult,
  deleteBook,
  deleteCategoriesAndBooks,
  loadLibraryState,
  saveBooksWithFiles,
  saveCategory,
  toggleBookmark,
  updateBookProgress,
} from './lib/storage';
import { isSupabaseConfigured } from './lib/supabase';
import { Header } from './components/Header';
import { CategoryRackGrid } from './components/CategoryRackGrid';
import { Bookshelf3D } from './components/Bookshelf3D';
import { ReaderOverlay } from './components/ReaderOverlay';
import { UploadBookModal } from './components/UploadBookModal';
import { NewCategoryModal } from './components/NewCategoryModal';
import { AuthModal } from './components/AuthModal';

export const App: React.FC = () => {
  const [categories, setCategories] = useState<CategoryRack[]>([]);
  const [books, setBooks] = useState<BookItem[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [cloudUserEmail, setCloudUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number } | null>(null);
  const [activeBook, setActiveBook] = useState<BookItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [creatingBinderParent, setCreatingBinderParent] = useState<CategoryRack | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const refreshLibrary = useCallback(async () => {
    const state = await loadLibraryState();
    setCategories(state.categories);
    setBooks(state.books);
    setBookmarks(state.bookmarks);
    setCloudUserEmail(state.cloudUserEmail);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.fileName.toLowerCase().includes(q)
    );
  }, [books, searchQuery]);

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        filteredBooks.some((b) => b.categoryId === c.id)
    );
  }, [categories, filteredBooks, searchQuery]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  );

  const selectedBreadcrumbs = useMemo(() => {
    const chain: CategoryRack[] = [];
    let curr = selectedCategory;
    const seen = new Set<string>();
    while (curr && !seen.has(curr.id)) {
      chain.unshift(curr);
      seen.add(curr.id);
      curr = curr.parentId ? categories.find((c) => c.id === curr!.parentId) ?? null : null;
    }
    return chain;
  }, [categories, selectedCategory]);

  const childBindersOfSelected = useMemo(
    () => categories.filter((c) => c.parentId === selectedCategoryId),
    [categories, selectedCategoryId]
  );

  const booksInSelectedCategory = useMemo(
    () => filteredBooks.filter((b) => b.categoryId === selectedCategoryId),
    [filteredBooks, selectedCategoryId]
  );

  const handleSelectCategory = (cat: CategoryRack, rect: DOMRect) => {
    setZoomOrigin({
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
    });
    setSelectedCategoryId(cat.id);
  };

  const handleSaveBooks = async (
    entries: Array<{ book: BookItem; file: File }>,
    onProgress?: (
      completed: number,
      total: number,
      chunkProgress?: { uploaded: number; total: number }
    ) => void
  ): Promise<BatchSaveResult> => {
    const result = await saveBooksWithFiles(entries, onProgress);
    if (result.saved.length > 0) {
      setBooks((prev) => [...prev, ...result.saved]);
      if (Object.keys(result.categoryRemap).length > 0) {
        setCategories((prev) =>
          prev.map((c) =>
            result.categoryRemap[c.id] ? { ...c, id: result.categoryRemap[c.id] } : c
          )
        );
      }
      setSelectedCategoryId(result.saved[result.saved.length - 1].categoryId);
    }
    return result;
  };

  const handleCreateCategory = async (category: CategoryRack) => {
    await saveCategory(category);
    setCategories((prev) => [...prev, category]);
  };

  const handleUpdateProgress = async (
    book: BookItem,
    location: string,
    percent: number,
    pageCount?: number
  ) => {
    const updated = await updateBookProgress(book, location, percent, pageCount);
    setBooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const handleToggleBookmark = async (bookId: string, location: string, label: string) => {
    const existing = bookmarks.find((bm) => bm.bookId === bookId && bm.location === location);
    if (existing) {
      await toggleBookmark(existing, true);
      setBookmarks((prev) => prev.filter((bm) => bm.id !== existing.id));
    } else {
      const created: BookmarkItem = {
        id: crypto.randomUUID(),
        bookId,
        location,
        label,
        createdAt: new Date().toISOString(),
      };
      await toggleBookmark(created, false);
      setBookmarks((prev) => [created, ...prev]);
    }
  };

  const handleDeleteBook = async (book: BookItem) => {
    await deleteBook(book.id, book.filePath);
    setBooks((prev) => prev.filter((b) => b.id !== book.id));
    setActiveBook(null);
  };

  const handleDeleteItems = async (categoryIds: string[], bookIds: string[]) => {
    const { deletedCategoryIds, deletedBookIds } = await deleteCategoriesAndBooks(
      categoryIds,
      bookIds
    );
    const catSet = new Set(deletedCategoryIds);
    const bookSet = new Set(deletedBookIds);
    setCategories((prev) => prev.filter((c) => !catSet.has(c.id)));
    setBooks((prev) => prev.filter((b) => !bookSet.has(b.id)));
    setBookmarks((prev) => prev.filter((bm) => !bookSet.has(bm.bookId)));
    if (selectedCategoryId && catSet.has(selectedCategoryId)) {
      setSelectedCategoryId(null);
    }
    if (activeBook && bookSet.has(activeBook.id)) {
      setActiveBook(null);
    }
  };

  return (
    <div>
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onLogoClick={() => setSelectedCategoryId(null)}
        onUploadClick={() => setShowUploadModal(true)}
        onSyncClick={() => setShowAuthModal(true)}
        cloudUserEmail={cloudUserEmail}
        isCloudConfigured={isSupabaseConfigured}
      />

      {loading ? (
        <div className="zen-stage" style={{ textAlign: 'center', paddingTop: 120, color: '#7A6F64' }}>
          Opening your reading room...
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {!selectedCategory ? (
            <CategoryRackGrid
              key="racks"
              categories={filteredCategories}
              books={filteredBooks}
              onSelectCategory={handleSelectCategory}
              onNewCategoryClick={() => {
                setCreatingBinderParent(null);
                setShowCategoryModal(true);
              }}
              onDeleteRacks={(rackIds) => handleDeleteItems(rackIds, [])}
            />
          ) : (
            <Bookshelf3D
              key={`shelf-${selectedCategory.id}`}
              category={selectedCategory}
              breadcrumbs={selectedBreadcrumbs}
              childBinders={childBindersOfSelected}
              allCategories={categories}
              allBooks={books}
              books={booksInSelectedCategory}
              zoomOrigin={zoomOrigin}
              onBackToRacks={() => setSelectedCategoryId(null)}
              onSelectBreadcrumb={(id) => {
                setZoomOrigin(null);
                setSelectedCategoryId(id);
              }}
              onOpenBinder={handleSelectCategory}
              onOpenBook={(book) => setActiveBook(book)}
              onAddBookClick={() => setShowUploadModal(true)}
              onNewBinderClick={() => {
                setCreatingBinderParent(selectedCategory);
                setShowCategoryModal(true);
              }}
              onDeleteItems={handleDeleteItems}
            />
          )}
        </AnimatePresence>
      )}

      <AnimatePresence>
        {activeBook && (
          <ReaderOverlay
            key={activeBook.id}
            book={activeBook}
            bookmarks={bookmarks}
            onClose={() => setActiveBook(null)}
            onUpdateProgress={handleUpdateProgress}
            onToggleBookmark={handleToggleBookmark}
            onDeleteBook={handleDeleteBook}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUploadModal && (
          <UploadBookModal
            categories={categories}
            defaultCategoryId={selectedCategoryId || categories[0]?.id || ''}
            isCloudSynced={Boolean(cloudUserEmail)}
            onClose={() => setShowUploadModal(false)}
            onSaveBooks={handleSaveBooks}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCategoryModal && (
          <NewCategoryModal
            nextOrder={categories.length}
            parentCategory={creatingBinderParent}
            onClose={() => {
              setShowCategoryModal(false);
              setCreatingBinderParent(null);
            }}
            onCreate={handleCreateCategory}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAuthModal && (
          <AuthModal
            cloudUserEmail={cloudUserEmail}
            onClose={() => setShowAuthModal(false)}
            onAuthSuccess={refreshLibrary}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
