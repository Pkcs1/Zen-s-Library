import { openDB, IDBPDatabase } from 'idb';
import { BookItem, BookmarkItem, CategoryRack } from '../types/library';
import { supabase, isSupabaseConfigured } from './supabase';
import { SEED_BOOKS, SEED_CATEGORIES } from '../data/seedLibrary';

const DB_NAME = 'zens-library-db';
const DB_VERSION = 1;

interface ZenDB {
  categories: { key: string; value: CategoryRack };
  books: { key: string; value: BookItem };
  files: { key: string; value: { id: string; blob: Blob; updatedAt: string } };
  bookmarks: { key: string; value: BookmarkItem };
}

let dbPromise: Promise<IDBPDatabase<ZenDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<ZenDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('books')) {
          db.createObjectStore('books', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('bookmarks')) {
          db.createObjectStore('bookmarks', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function loadLibraryState(): Promise<{
  categories: CategoryRack[];
  books: BookItem[];
  bookmarks: BookmarkItem[];
  cloudUserEmail: string | null;
}> {
  const db = await getDb();

  // Check if cloud session exists
  let cloudUserEmail: string | null = null;
  if (supabase && isSupabaseConfigured) {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      cloudUserEmail = data.user.email ?? 'Signed in';
      try {
        const [{ data: cloudCats }, { data: cloudBooks }, { data: cloudBms }] = await Promise.all([
          supabase.from('categories').select('*').order('sort_order', { ascending: true }),
          supabase.from('books').select('*').order('created_at', { ascending: true }),
          supabase.from('bookmarks').select('*').order('created_at', { ascending: false }),
        ]);

        if (cloudCats && cloudCats.length > 0) {
          const categories: CategoryRack[] = cloudCats.map((c) => ({
            id: c.id,
            parentId: c.parent_id ?? null,
            name: c.name,
            description: c.description ?? '',
            accentColor: c.accent_color ?? '#C86D51',
            sortOrder: c.sort_order ?? 0,
            createdAt: c.created_at,
          }));
          const books: BookItem[] = (cloudBooks ?? []).map((b) => ({
            id: b.id,
            categoryId: b.category_id,
            title: b.title,
            author: b.author ?? 'Unknown Author',
            format: b.format,
            fileName: b.file_name,
            filePath: b.file_path,
            fileSizeBytes: Number(b.file_size_bytes ?? 0),
            pageCount: b.page_count ?? 0,
            spineColor: b.spine_color ?? '#2B463C',
            spineTextColor: b.spine_text_color ?? '#FAF6EE',
            spineHeight: b.spine_height ?? 224,
            spineThickness: b.spine_thickness ?? 56,
            tiltDeg: Number(b.tilt_deg ?? 0),
            isStacked: Boolean(b.is_stacked),
            currentLocation: b.current_location ?? '1',
            progressPercent: b.progress_percent ?? 0,
            lastReadAt: b.last_read_at ?? undefined,
            createdAt: b.created_at,
          }));
          const bookmarks: BookmarkItem[] = (cloudBms ?? []).map((bm) => ({
            id: bm.id,
            bookId: bm.book_id,
            location: bm.location,
            label: bm.label ?? 'Bookmark',
            createdAt: bm.created_at,
          }));
          return { categories, books, bookmarks, cloudUserEmail };
        }
      } catch (err) {
        console.warn('Cloud fetch fell back to local IndexedDB:', err);
      }
    }
  }

  // Local-first IndexedDB state
  let categories = await db.getAll('categories');
  let books = await db.getAll('books');
  const bookmarks = await db.getAll('bookmarks');

  const hasInitialized = localStorage.getItem('zens-library-initialized') === 'true';

  if (categories.length === 0 && !hasInitialized) {
    const tx = db.transaction(['categories', 'books'], 'readwrite');
    for (const c of SEED_CATEGORIES) await tx.objectStore('categories').put(c);
    for (const b of SEED_BOOKS) await tx.objectStore('books').put(b);
    await tx.done;
    localStorage.setItem('zens-library-initialized', 'true');
    categories = SEED_CATEGORIES;
    books = SEED_BOOKS;
  }

  categories.sort((a, b) => a.sortOrder - b.sortOrder);
  return { categories, books, bookmarks, cloudUserEmail };
}

export async function clearAllLibraryData(): Promise<void> {
  const db = await getDb();
  const existingBooks = await db.getAll('books');

  const tx = db.transaction(['categories', 'books', 'files', 'bookmarks'], 'readwrite');
  await Promise.all([
    tx.objectStore('categories').clear(),
    tx.objectStore('books').clear(),
    tx.objectStore('files').clear(),
    tx.objectStore('bookmarks').clear(),
  ]);
  await tx.done;
  localStorage.setItem('zens-library-initialized', 'true');

  if (supabase && isSupabaseConfigured) {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const filePaths = existingBooks
        .map((b) => b.filePath)
        .filter((p): p is string => Boolean(p));
      if (filePaths.length > 0) {
        await supabase.storage.from('books').remove(filePaths);
      }
      await supabase.from('bookmarks').delete().eq('user_id', data.user.id);
      await supabase.from('books').delete().eq('user_id', data.user.id);
      await supabase.from('categories').delete().eq('user_id', data.user.id);
    }
  }
}

export async function restoreSampleLibrary(): Promise<{
  categories: CategoryRack[];
  books: BookItem[];
}> {
  await clearAllLibraryData();
  const db = await getDb();
  const tx = db.transaction(['categories', 'books'], 'readwrite');
  for (const c of SEED_CATEGORIES) await tx.objectStore('categories').put(c);
  for (const b of SEED_BOOKS) await tx.objectStore('books').put(b);
  await tx.done;
  return { categories: SEED_CATEGORIES, books: SEED_BOOKS };
}

export async function saveCategory(category: CategoryRack): Promise<void> {
  const db = await getDb();
  await db.put('categories', category);

  if (supabase && isSupabaseConfigured) {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from('categories').upsert({
        id: category.id,
        user_id: data.user.id,
        parent_id: category.parentId ?? null,
        name: category.name,
        description: category.description,
        accent_color: category.accentColor,
        sort_order: category.sortOrder,
      });
    }
  }
}

export async function saveBookWithFile(book: BookItem, fileBlob?: Blob): Promise<BookItem> {
  const db = await getDb();
  const updatedBook: BookItem = { ...book, hasLocalBlob: Boolean(fileBlob || book.hasLocalBlob) };

  if (fileBlob) {
    await db.put('files', { id: book.id, blob: fileBlob, updatedAt: new Date().toISOString() });
  }

  if (supabase && isSupabaseConfigured) {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      let storagePath = book.filePath ?? `${data.user.id}/${book.id}.${book.format}`;
      if (fileBlob) {
        const { error: uploadErr } = await supabase.storage
          .from('books')
          .upload(storagePath, fileBlob, { upsert: true });
        if (!uploadErr) {
          updatedBook.filePath = storagePath;
        }
      }
      await supabase.from('books').upsert({
        id: updatedBook.id,
        user_id: data.user.id,
        category_id: updatedBook.categoryId,
        title: updatedBook.title,
        author: updatedBook.author,
        format: updatedBook.format,
        file_name: updatedBook.fileName,
        file_path: updatedBook.filePath ?? storagePath,
        file_size_bytes: updatedBook.fileSizeBytes,
        page_count: updatedBook.pageCount,
        spine_color: updatedBook.spineColor,
        spine_text_color: updatedBook.spineTextColor,
        spine_height: updatedBook.spineHeight,
        spine_thickness: updatedBook.spineThickness,
        tilt_deg: updatedBook.tiltDeg,
        is_stacked: Boolean(updatedBook.isStacked),
        current_location: updatedBook.currentLocation,
        progress_percent: updatedBook.progressPercent,
        last_read_at: updatedBook.lastReadAt ?? null,
      });
    }
  }

  await db.put('books', updatedBook);
  return updatedBook;
}

export async function getBookFileBlob(book: BookItem): Promise<Blob | null> {
  const db = await getDb();
  const cached = await db.get('files', book.id);
  if (cached?.blob) return cached.blob;

  if (supabase && isSupabaseConfigured && book.filePath) {
    const { data, error } = await supabase.storage.from('books').download(book.filePath);
    if (!error && data) {
      await db.put('files', { id: book.id, blob: data, updatedAt: new Date().toISOString() });
      return data;
    }
  }
  return null;
}

export async function updateBookProgress(
  book: BookItem,
  currentLocation: string,
  progressPercent: number,
  pageCount?: number
): Promise<BookItem> {
  const updated: BookItem = {
    ...book,
    currentLocation,
    progressPercent: Math.max(0, Math.min(100, Math.round(progressPercent))),
    pageCount: pageCount ?? book.pageCount,
    lastReadAt: new Date().toISOString(),
  };
  const db = await getDb();
  await db.put('books', updated);

  if (supabase && isSupabaseConfigured) {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase
        .from('books')
        .update({
          current_location: updated.currentLocation,
          progress_percent: updated.progressPercent,
          page_count: updated.pageCount,
          last_read_at: updated.lastReadAt,
        })
        .eq('id', updated.id);
    }
  }
  return updated;
}

export async function deleteBook(bookId: string, filePath?: string): Promise<void> {
  const db = await getDb();
  await db.delete('books', bookId);
  await db.delete('files', bookId);

  if (supabase && isSupabaseConfigured) {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from('books').delete().eq('id', bookId);
      if (filePath) {
        await supabase.storage.from('books').remove([filePath]);
      }
    }
  }
}

export async function deleteCategoriesAndBooks(
  categoryIdsToDelete: string[],
  bookIdsToDelete: string[]
): Promise<{ deletedCategoryIds: string[]; deletedBookIds: string[] }> {
  const db = await getDb();
  const allCategories = await db.getAll('categories');
  const allBooks = await db.getAll('books');
  const allBookmarks = await db.getAll('bookmarks');

  // Recursively include descendant binders of any deleted category
  const catSet = new Set<string>(categoryIdsToDelete);
  let added = true;
  while (added) {
    added = false;
    for (const c of allCategories) {
      if (c.parentId && catSet.has(c.parentId) && !catSet.has(c.id)) {
        catSet.add(c.id);
        added = true;
      }
    }
  }

  const bookSet = new Set<string>(bookIdsToDelete);
  for (const b of allBooks) {
    if (catSet.has(b.categoryId)) {
      bookSet.add(b.id);
    }
  }

  const deletedCategoryIds = Array.from(catSet);
  const deletedBookIds = Array.from(bookSet);

  const tx = db.transaction(['categories', 'books', 'files', 'bookmarks'], 'readwrite');
  for (const cid of deletedCategoryIds) await tx.objectStore('categories').delete(cid);
  for (const bid of deletedBookIds) {
    await tx.objectStore('books').delete(bid);
    await tx.objectStore('files').delete(bid);
  }
  for (const bm of allBookmarks) {
    if (bookSet.has(bm.bookId)) await tx.objectStore('bookmarks').delete(bm.id);
  }
  await tx.done;
  localStorage.setItem('zens-library-initialized', 'true');

  if (supabase && isSupabaseConfigured) {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const filePaths = allBooks
        .filter((b) => bookSet.has(b.id) && b.filePath)
        .map((b) => b.filePath as string);
      if (filePaths.length > 0) {
        await supabase.storage.from('books').remove(filePaths);
      }
      if (deletedBookIds.length > 0) {
        await supabase.from('bookmarks').delete().in('book_id', deletedBookIds);
        await supabase.from('books').delete().in('id', deletedBookIds);
      }
      if (deletedCategoryIds.length > 0) {
        await supabase.from('categories').delete().in('id', deletedCategoryIds);
      }
    }
  }

  return { deletedCategoryIds, deletedBookIds };
}

export async function toggleBookmark(bookmark: BookmarkItem, exists: boolean): Promise<void> {
  const db = await getDb();
  if (exists) {
    await db.delete('bookmarks', bookmark.id);
  } else {
    await db.put('bookmarks', bookmark);
  }

  if (supabase && isSupabaseConfigured) {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      if (exists) {
        await supabase.from('bookmarks').delete().eq('id', bookmark.id);
      } else {
        await supabase.from('bookmarks').upsert({
          id: bookmark.id,
          book_id: bookmark.bookId,
          user_id: data.user.id,
          location: bookmark.location,
          label: bookmark.label,
        });
      }
    }
  }
}
