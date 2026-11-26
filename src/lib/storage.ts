import { openDB, IDBPDatabase } from 'idb';
import { BookItem, BookmarkItem, CategoryRack } from '../types/library';
import { supabase, isSupabaseConfigured } from './supabase';
import { SEED_BOOKS, SEED_CATEGORIES } from '../data/seedLibrary';

const DB_NAME = 'zens-library-db';
const DB_VERSION = 1;
const CLOUD_CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB per chunk (under Supabase 6 MB standard upload limit)
const CHUNKED_PREFIX = 'chunked:';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(id: string | null | undefined): boolean {
  return Boolean(id && UUID_REGEX.test(id));
}

function parseChunkedFilePath(
  filePath: string
): { basePath: string; partCount: number } | null {
  if (!filePath.startsWith(CHUNKED_PREFIX)) return null;
  const rest = filePath.slice(CHUNKED_PREFIX.length);
  const sepIdx = rest.lastIndexOf(':');
  if (sepIdx <= 0) return null;
  const basePath = rest.slice(0, sepIdx);
  const partCount = Number(rest.slice(sepIdx + 1));
  if (!basePath || !Number.isInteger(partCount) || partCount <= 0) return null;
  return { basePath, partCount };
}

function getChunkPartPath(basePath: string, index: number): string {
  return `${basePath}.part${String(index).padStart(4, '0')}`;
}

function expandStoragePaths(filePaths: string[]): string[] {
  const expanded: string[] = [];
  for (const path of filePaths) {
    if (!path) continue;
    const chunked = parseChunkedFilePath(path);
    if (chunked) {
      for (let i = 0; i < chunked.partCount; i++) {
        expanded.push(getChunkPartPath(chunked.basePath, i));
      }
    } else {
      expanded.push(path);
    }
  }
  return expanded;
}

async function removeCloudPaths(filePaths: string[]): Promise<void> {
  if (!supabase || !isSupabaseConfigured) return;
  const expanded = expandStoragePaths(filePaths);
  for (let i = 0; i < expanded.length; i += 100) {
    const batch = expanded.slice(i, i + 100);
    await supabase.storage.from('books').remove(batch);
  }
}

async function uploadWithRetry(
  storagePath: string,
  data: Blob,
  contentType: string
): Promise<string | null> {
  if (!supabase) return 'Supabase is not configured.';
  const { error } = await supabase.storage
    .from('books')
    .upload(storagePath, data, { upsert: true, contentType });
  if (!error) return null;

  await new Promise((resolve) => setTimeout(resolve, 600));
  const retry = await supabase.storage
    .from('books')
    .upload(storagePath, data, { upsert: true, contentType });
  return retry.error ? retry.error.message : null;
}

async function uploadBlobToCloud(
  userId: string,
  bookId: string,
  format: BookItem['format'],
  blob: Blob,
  onChunkProgress?: (uploaded: number, total: number) => void
): Promise<{ filePath: string | null; error: string | null }> {
  const contentType =
    blob.type || (format === 'epub' ? 'application/epub+zip' : 'application/pdf');
  const basePath = `${userId}/${bookId}.${format}`;

  if (blob.size <= CLOUD_CHUNK_SIZE) {
    const err = await uploadWithRetry(basePath, blob, contentType);
    onChunkProgress?.(1, 1);
    return { filePath: err ? null : basePath, error: err };
  }

  const partCount = Math.ceil(blob.size / CLOUD_CHUNK_SIZE);
  const uploadedPartPaths: string[] = [];

  for (let i = 0; i < partCount; i++) {
    const start = i * CLOUD_CHUNK_SIZE;
    const end = Math.min(blob.size, start + CLOUD_CHUNK_SIZE);
    const partBlob = blob.slice(start, end, contentType);
    const partPath = getChunkPartPath(basePath, i);

    const err = await uploadWithRetry(partPath, partBlob, contentType);
    if (err) {
      if (uploadedPartPaths.length > 0) {
        await removeCloudPaths(uploadedPartPaths);
      }
      return { filePath: null, error: err };
    }

    uploadedPartPaths.push(partPath);
    onChunkProgress?.(i + 1, partCount);
  }

  return { filePath: `${CHUNKED_PREFIX}${basePath}:${partCount}`, error: null };
}

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

/** Upsert a category to Supabase, gracefully falling back if parent_id column isn't migrated yet */
async function upsertCategoryToCloud(userId: string, cat: CategoryRack): Promise<string | null> {
  if (!supabase) return null;
  const payload = {
    id: cat.id,
    user_id: userId,
    parent_id: cat.parentId ?? null,
    name: cat.name,
    description: cat.description,
    accent_color: cat.accentColor,
    sort_order: cat.sortOrder,
  };
  const { error } = await supabase.from('categories').upsert(payload);
  if (error && error.message.toLowerCase().includes('parent_id')) {
    const { parent_id: _omit, ...fallbackPayload } = payload;
    const retry = await supabase.from('categories').upsert(fallbackPayload);
    return retry.error ? retry.error.message : null;
  }
  return error ? error.message : null;
}

/** Ensure all local categories & books have valid UUIDs and push them to Supabase */
export async function syncLocalToCloud(
  onProgress?: (status: string) => void
): Promise<{
  syncedCategories: number;
  syncedBooks: number;
  error: string | null;
}> {
  if (!supabase || !isSupabaseConfigured) {
    return { syncedCategories: 0, syncedBooks: 0, error: 'Supabase is not configured.' };
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { syncedCategories: 0, syncedBooks: 0, error: 'Not signed in.' };
  }
  const userId = userData.user.id;
  const db = await getDb();

  const localCats = await db.getAll('categories');
  const localBooks = await db.getAll('books');
  const localFiles = await db.getAll('files');
  const fileMap = new Map(localFiles.map((f) => [f.id, f.blob]));

  // Map any non-UUID legacy seed IDs to valid UUIDs so Supabase accepts them
  const catIdMap = new Map<string, string>();
  for (const c of localCats) {
    catIdMap.set(c.id, isUuid(c.id) ? c.id : crypto.randomUUID());
  }

  const migratedCats: CategoryRack[] = localCats.map((c) => ({
    ...c,
    id: catIdMap.get(c.id)!,
    parentId: c.parentId ? catIdMap.get(c.parentId) ?? null : null,
  }));

  // Sort so top-level racks upsert BEFORE child binders (satisfies parent_id FK)
  migratedCats.sort((a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0));

  let firstError: string | null = null;
  for (const c of migratedCats) {
    const err = await upsertCategoryToCloud(userId, c);
    if (err && !firstError) firstError = err;
  }

  const migratedBooks: BookItem[] = [];
  for (const b of localBooks) {
    const newBookId = isUuid(b.id) ? b.id : crypto.randomUUID();
    const newCatId = catIdMap.get(b.categoryId) ?? b.categoryId;
    if (!isUuid(newCatId)) continue;

    const blob = fileMap.get(b.id);
    let storagePath = b.filePath ?? `${userId}/${newBookId}.${b.format}`;
    let uploadFailed = false;
    if (blob) {
      onProgress?.(`Uploading "${b.title}"...`);
      const uploadRes = await uploadBlobToCloud(
        userId,
        newBookId,
        b.format,
        blob,
        (done, total) => {
          onProgress?.(
            total > 1
              ? `Uploading "${b.title}" (part ${done}/${total})...`
              : `Uploading "${b.title}"...`
          );
        }
      );
      if (uploadRes.error) {
        if (!firstError) firstError = `${b.title}: ${uploadRes.error}`;
        uploadFailed = true;
      } else if (uploadRes.filePath) {
        storagePath = uploadRes.filePath;
      }
    }

    const updatedBook: BookItem = {
      ...b,
      id: newBookId,
      categoryId: newCatId,
      filePath: uploadFailed
        ? b.filePath
        : blob || b.filePath
          ? storagePath
          : b.filePath,
    };

    if (!uploadFailed) {
      const { error: bookErr } = await supabase.from('books').upsert({
        id: updatedBook.id,
        user_id: userId,
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
      if (bookErr && !firstError) firstError = bookErr.message;
    }
    migratedBooks.push(updatedBook);
  }

  // Update local IndexedDB with migrated UUIDs so future edits match cloud IDs
  const tx = db.transaction(['categories', 'books', 'files'], 'readwrite');
  await tx.objectStore('categories').clear();
  await tx.objectStore('books').clear();
  for (const c of migratedCats) await tx.objectStore('categories').put(c);
  for (const b of migratedBooks) {
    await tx.objectStore('books').put(b);
  }
  // Re-key blobs if book ID changed
  for (const oldBook of localBooks) {
    const blob = fileMap.get(oldBook.id);
    const matched = migratedBooks.find(
      (mb) => mb.fileName === oldBook.fileName && mb.title === oldBook.title
    );
    if (blob && matched && matched.id !== oldBook.id) {
      await tx.objectStore('files').put({
        id: matched.id,
        blob,
        updatedAt: new Date().toISOString(),
      });
      await tx.objectStore('files').delete(oldBook.id);
    }
  }
  await tx.done;

  return {
    syncedCategories: migratedCats.length,
    syncedBooks: migratedBooks.length,
    error: firstError,
  };
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
        const [{ data: cloudCats, error: catErr }, { data: cloudBooks }, { data: cloudBms }] =
          await Promise.all([
            supabase.from('categories').select('*').order('sort_order', { ascending: true }),
            supabase.from('books').select('*').order('created_at', { ascending: true }),
            supabase.from('bookmarks').select('*').order('created_at', { ascending: false }),
          ]);

        if (!catErr && cloudCats) {
          // If cloud is completely empty on first sign-in, push any local user library up to cloud!
          if (cloudCats.length === 0) {
            const localCats = await db.getAll('categories');
            const localBooks = await db.getAll('books');
            const hasUserUploadedBooks = localBooks.some((b) => b.hasLocalBlob);
            if (localCats.length > 0 && (hasUserUploadedBooks || localCats.some((c) => isUuid(c.id)))) {
              await syncLocalToCloud();
              const [{ data: reCats }, { data: reBooks }] = await Promise.all([
                supabase.from('categories').select('*').order('sort_order', { ascending: true }),
                supabase.from('books').select('*').order('created_at', { ascending: true }),
              ]);
              if (reCats && reCats.length > 0) {
                return mapCloudResponse(db, reCats, reBooks ?? [], cloudBms ?? [], cloudUserEmail);
              }
            }
          }

          // Cloud is the source of truth when signed in
          return mapCloudResponse(db, cloudCats, cloudBooks ?? [], cloudBms ?? [], cloudUserEmail);
        }
      } catch (err) {
        console.warn('Cloud fetch fell back to local IndexedDB:', err);
      }
    }
  }

  // Local-first IndexedDB state (when signed out or offline)
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

async function mapCloudResponse(
  db: IDBPDatabase<ZenDB>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cloudCats: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cloudBooks: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cloudBms: any[],
  cloudUserEmail: string
) {
  const categories: CategoryRack[] = cloudCats.map((c) => ({
    id: c.id,
    parentId: c.parent_id ?? null,
    name: c.name,
    description: c.description ?? '',
    accentColor: c.accent_color ?? '#C86D51',
    sortOrder: c.sort_order ?? 0,
    createdAt: c.created_at,
  }));
  const books: BookItem[] = cloudBooks.map((b) => ({
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
  const bookmarks: BookmarkItem[] = cloudBms.map((bm) => ({
    id: bm.id,
    bookId: bm.book_id,
    location: bm.location,
    label: bm.label ?? 'Bookmark',
    createdAt: bm.created_at,
  }));

  // Mirror cloud metadata into local IndexedDB for instant offline access
  const tx = db.transaction(['categories', 'books', 'bookmarks'], 'readwrite');
  await tx.objectStore('categories').clear();
  await tx.objectStore('books').clear();
  await tx.objectStore('bookmarks').clear();
  for (const c of categories) await tx.objectStore('categories').put(c);
  for (const b of books) await tx.objectStore('books').put(b);
  for (const bm of bookmarks) await tx.objectStore('bookmarks').put(bm);
  await tx.done;
  localStorage.setItem('zens-library-initialized', 'true');

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
        await removeCloudPaths(filePaths);
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
  const safeCat: CategoryRack = {
    ...category,
    id: isUuid(category.id) ? category.id : crypto.randomUUID(),
  };
  await db.put('categories', safeCat);

  if (supabase && isSupabaseConfigured) {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const err = await upsertCategoryToCloud(data.user.id, safeCat);
      if (err) console.error('Supabase category save error:', err);
    }
  }
}

export async function saveBookWithFile(
  book: BookItem,
  fileBlob?: Blob,
  options?: {
    onChunkProgress?: (uploaded: number, total: number) => void;
    onCloudError?: (message: string) => void;
  }
): Promise<BookItem> {
  const db = await getDb();
  let updatedBook: BookItem = {
    ...book,
    id: isUuid(book.id) ? book.id : crypto.randomUUID(),
    hasLocalBlob: Boolean(fileBlob || book.hasLocalBlob),
  };

  if (fileBlob) {
    await db.put('files', { id: updatedBook.id, blob: fileBlob, updatedAt: new Date().toISOString() });
  }

  if (supabase && isSupabaseConfigured) {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const userId = data.user.id;

      // Ensure the target category (and parent if binder) exists in Supabase with a valid UUID
      let targetCat = await db.get('categories', updatedBook.categoryId);
      if (targetCat && !isUuid(targetCat.id)) {
        const oldId = targetCat.id;
        targetCat = { ...targetCat, id: crypto.randomUUID() };
        await db.put('categories', targetCat);
        await db.delete('categories', oldId);
        updatedBook = { ...updatedBook, categoryId: targetCat.id };
      }
      if (targetCat) {
        if (targetCat.parentId) {
          const parentCat = await db.get('categories', targetCat.parentId);
          if (parentCat && isUuid(parentCat.id)) {
            await upsertCategoryToCloud(userId, parentCat);
          }
        }
        await upsertCategoryToCloud(userId, targetCat);
      }

      let uploadFailed = false;
      if (fileBlob) {
        const uploadRes = await uploadBlobToCloud(
          userId,
          updatedBook.id,
          updatedBook.format,
          fileBlob,
          options?.onChunkProgress
        );
        if (uploadRes.error) {
          console.error('Supabase file upload error:', uploadRes.error);
          options?.onCloudError?.(uploadRes.error);
          uploadFailed = true;
        } else if (uploadRes.filePath) {
          updatedBook.filePath = uploadRes.filePath;
        }
      }

      if (!uploadFailed) {
        const storagePath =
          updatedBook.filePath ?? `${userId}/${updatedBook.id}.${updatedBook.format}`;
        const { error: bookErr } = await supabase.from('books').upsert({
          id: updatedBook.id,
          user_id: userId,
          category_id: updatedBook.categoryId,
          title: updatedBook.title,
          author: updatedBook.author,
          format: updatedBook.format,
          file_name: updatedBook.fileName,
          file_path: storagePath,
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
        if (bookErr) {
          console.error('Supabase book save error:', bookErr.message);
          options?.onCloudError?.(bookErr.message);
        }
      }
    }
  }

  await db.put('books', updatedBook);
  return updatedBook;
}

export interface BatchSaveResult {
  saved: BookItem[];
  failed: Array<{ bookId: string; title: string; error: string }>;
  cloudWarnings: Array<{ bookId: string; title: string; error: string }>;
  categoryRemap: Record<string, string>;
}

export async function saveBooksWithFiles(
  entries: Array<{ book: BookItem; file?: Blob }>,
  onProgress?: (
    completed: number,
    total: number,
    chunkProgress?: { uploaded: number; total: number }
  ) => void
): Promise<BatchSaveResult> {
  const saved: BookItem[] = [];
  const failed: Array<{ bookId: string; title: string; error: string }> = [];
  const cloudWarnings: Array<{ bookId: string; title: string; error: string }> = [];
  const categoryRemap: Record<string, string> = {};

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const mappedCategoryId = categoryRemap[entry.book.categoryId] ?? entry.book.categoryId;
    const bookToSave: BookItem =
      mappedCategoryId !== entry.book.categoryId
        ? { ...entry.book, categoryId: mappedCategoryId }
        : entry.book;

    try {
      const savedBook = await saveBookWithFile(bookToSave, entry.file, {
        onChunkProgress: (uploaded, total) => {
          onProgress?.(i, entries.length, { uploaded, total });
        },
        onCloudError: (msg) => {
          cloudWarnings.push({
            bookId: bookToSave.id,
            title: bookToSave.title,
            error: msg,
          });
        },
      });
      if (savedBook.categoryId !== bookToSave.categoryId) {
        categoryRemap[entry.book.categoryId] = savedBook.categoryId;
      }
      saved.push(savedBook);
    } catch (err) {
      failed.push({
        bookId: entry.book.id,
        title: entry.book.title,
        error: err instanceof Error ? err.message : 'Failed to save book.',
      });
    }

    onProgress?.(i + 1, entries.length);
  }

  return { saved, failed, cloudWarnings, categoryRemap };
}

export async function getBookFileBlob(book: BookItem): Promise<Blob | null> {
  const db = await getDb();
  const cached = await db.get('files', book.id);
  if (cached?.blob) return cached.blob;

  if (supabase && isSupabaseConfigured && book.filePath) {
    const chunked = parseChunkedFilePath(book.filePath);
    if (chunked) {
      const parts: Blob[] = new Array(chunked.partCount);
      for (let start = 0; start < chunked.partCount; start += 3) {
        const batchIndices = Array.from(
          { length: Math.min(3, chunked.partCount - start) },
          (_, offset) => start + offset
        );
        const results = await Promise.all(
          batchIndices.map(async (idx) => {
            const { data, error } = await supabase!.storage
              .from('books')
              .download(getChunkPartPath(chunked.basePath, idx));
            return { idx, data, error };
          })
        );
        for (const res of results) {
          if (res.error || !res.data) {
            console.error('Supabase chunk download error:', res.error?.message);
            return null;
          }
          parts[res.idx] = res.data;
        }
      }
      const mime = book.format === 'epub' ? 'application/epub+zip' : 'application/pdf';
      const fullBlob = new Blob(parts, { type: mime });
      await db.put('files', { id: book.id, blob: fullBlob, updatedAt: new Date().toISOString() });
      return fullBlob;
    }

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

  if (supabase && isSupabaseConfigured && isUuid(updated.id)) {
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

  if (supabase && isSupabaseConfigured && isUuid(bookId)) {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from('books').delete().eq('id', bookId);
      if (filePath) {
        await removeCloudPaths([filePath]);
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
        await removeCloudPaths(filePaths);
      }
      const validBookUuids = deletedBookIds.filter(isUuid);
      const validCatUuids = deletedCategoryIds.filter(isUuid);
      if (validBookUuids.length > 0) {
        await supabase.from('bookmarks').delete().in('book_id', validBookUuids);
        await supabase.from('books').delete().in('id', validBookUuids);
      }
      if (validCatUuids.length > 0) {
        await supabase.from('categories').delete().in('id', validCatUuids);
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

  if (supabase && isSupabaseConfigured && isUuid(bookmark.bookId)) {
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
