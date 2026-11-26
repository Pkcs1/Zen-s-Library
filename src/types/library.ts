export type BookFormat = 'pdf' | 'epub';
export type ReaderTheme = 'cream' | 'white' | 'sepia' | 'night';

export interface CategoryRack {
  id: string;
  parentId?: string | null; // null/undefined = top-level Rack; set = Binder inside a parent Rack
  name: string;
  description: string;
  accentColor: string;
  sortOrder: number;
  createdAt: string;
}

export interface DemoChapter {
  title: string;
  kicker: string;
  paragraphs: string[];
  highlightedQuote?: string;
}

export interface BookItem {
  id: string;
  categoryId: string;
  title: string;
  author: string;
  format: BookFormat;
  fileName: string;
  filePath?: string; // Supabase storage path when cloud synced
  fileSizeBytes: number;
  pageCount: number;
  spineColor: string;
  spineTextColor: string;
  spineHeight: number; // px (196 - 246)
  spineThickness: number; // px (44 - 72)
  tiltDeg: number; // -8 to 8
  isStacked?: boolean;
  currentLocation: string; // page number string for PDF/demo, CFI for EPUB
  progressPercent: number;
  lastReadAt?: string;
  createdAt: string;
  hasLocalBlob?: boolean;
  demoChapters?: DemoChapter[];
}

export interface BookmarkItem {
  id: string;
  bookId: string;
  location: string;
  label: string;
  createdAt: string;
}

export interface SpinePaletteOption {
  name: string;
  color: string;
  textColor: string;
  finish: string;
}

export const SPINE_PALETTE: SpinePaletteOption[] = [
  { name: 'Forest Linen', color: '#2B463C', textColor: '#EBD8B7', finish: 'Forest Linen' },
  { name: 'Terracotta', color: '#D46F4D', textColor: '#FAF6EE', finish: 'Matte Terracotta' },
  { name: 'Dusty Slate', color: '#6E879E', textColor: '#FAF7F2', finish: 'Slate Cloth' },
  { name: 'Warm Ochre', color: '#D9A74E', textColor: '#2C2621', finish: 'Ochre Buckram' },
  { name: 'Blush Clay', color: '#DFA89B', textColor: '#2C2621', finish: 'Soft Clay' },
  { name: 'Crimson Brick', color: '#B4433C', textColor: '#FAF6EE', finish: 'Crimson Cloth' },
  { name: 'Warm Linen', color: '#EAE1D3', textColor: '#3B2D26', finish: 'Natural Linen' },
  { name: 'Muted Sage', color: '#7F9C8E', textColor: '#FAF6EE', finish: 'Sage Matte' },
  { name: 'Espresso', color: '#3B2D26', textColor: '#F4EAD5', finish: 'Dark Leather' },
  { name: 'Soft Lavender', color: '#9A92A8', textColor: '#FAF7F2', finish: 'Muted Plum' },
];
