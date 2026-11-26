# Zen's Library

A warm, minimalist **3D bookshelf and full-screen web reader** for storing, organizing, and reading your personal **PDF** and **EPUB** ebooks on the web.

## Features

- **Category Rack Landing**: Browse your library by custom category racks, each rendered as a miniature floating oak shelf with book spine silhouettes. Clicking any rack triggers a **seamless camera zoom-in** directly into that shelf.
- **Tactile 3D Bookshelf**: Floating natural oak shelves populated with varied-height, varied-thickness 3D book spines, subtle leans, and horizontal book stacks with crisp readable spine titles.
- **Halfway 3D Hover Pull-Out**: Hovering over any book slides it halfway out toward you in 3D perspective, exposing its cream page block, front cover edge, deepened shadow, and a floating metadata card with format badge (`PDF` / `EPUB`) and reading progress.
- **Full-Screen PDF & EPUB Web Reader**: Clicking a book pops it open in 3D into a distraction-free reading canvas powered by `pdfjs-dist` and `epubjs`, featuring:
  - Cream, Pure White, Sepia, and Night paper themes
  - Zoom & font scaling (`-` / `+`)
  - Keyboard navigation (`←`, `→`, `Esc`)
  - Bookmarks & automatic reading progress persistence
- **Upload & Live 3D Spine Customizer**: Drag-and-drop `.pdf` or `.epub` files, assign a category rack, and customize spine color, finish, thickness, and height with a live 3D shelf preview.
- **Hybrid Storage (Local-First + Cloud Sync)**: Works out of the box offline using browser **IndexedDB**, and syncs privately across devices when connected to **Supabase** (PostgreSQL + Private Storage Bucket + Auth).

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Animations & 3D**: Framer Motion + CSS 3D Perspective
- **Document Engines**: `pdfjs-dist` (PDF), `epubjs` (EPUB)
- **Icons**: `lucide-react`
- **Storage & Sync**: IndexedDB (`idb`) + Supabase (`@supabase/supabase-js`)
- **UI/UX Source Design**: Figcraft ([`design/zens-library.figcraft`](design/zens-library.figcraft))

## Getting Started Locally

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev
```

Open `http://localhost:5173` in your browser. All uploaded books and reading progress are saved locally in IndexedDB by default.

## Optional: Supabase Cloud Sync Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in Supabase, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
3. Copy `.env.example` to `.env` and fill in your credentials from **Project Settings → API**:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
4. Restart the dev server (`npm run dev`), click **Sign In to Sync** in the header, and create an account.

## Deploying to Vercel

1. Push this repository to GitHub (`.env`, `node_modules/`, and `dist/` are already excluded in `.gitignore`).
2. Import the repository at [vercel.com/new](https://vercel.com/new) (Vite is detected automatically).
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Project Settings → Environment Variables**.
4. Deploy, then add your live Vercel URL to **Supabase → Authentication → URL Configuration → Site URL**.

## Project Structure

```text
ZensLibrary/
├── design/
│   └── zens-library.figcraft     # Figcraft UI/UX design & interactive prototype
├── supabase/
│   └── schema.sql                # PostgreSQL tables, RLS policies & private storage bucket
├── src/
│   ├── components/
│   │   ├── Header.tsx            # Top navigation, search, sync status & upload CTA
│   │   ├── CategoryRackGrid.tsx  # Category rack entrance with zoom-in origin tracking
│   │   ├── Bookshelf3D.tsx       # Two-tier floating oak shelves & format filters
│   │   ├── BookSpine3D.tsx       # 3D spine geometry, hover pull-out & preview card
│   │   ├── ReaderOverlay.tsx     # Full-screen reader shell, themes, zoom & bookmarks
│   │   ├── PdfReader.tsx         # PDF.js high-DPI page renderer
│   │   ├── EpubReader.tsx        # EPUB.js reflowable reader
│   │   ├── UploadBookModal.tsx   # Drag-and-drop uploader & live 3D spine customizer
│   │   ├── NewCategoryModal.tsx  # Create custom category racks
│   │   └── AuthModal.tsx         # Supabase sign-in / sign-up & sync status modal
│   ├── data/
│   │   └── seedLibrary.ts        # Preloaded sample categories & readable demo books
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client initialization
│   │   └── storage.ts            # Hybrid IndexedDB + Supabase sync adapter
│   ├── styles/
│   │   └── theme.css             # Zen Warm Minimalist design tokens & 3D styles
│   └── types/
│       └── library.ts            # TypeScript models & spine color palette
├── .env.example
├── .gitignore
├── index.html
├── package.json
└── vite.config.ts
```
