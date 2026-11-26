-- Zen's Library — Supabase PostgreSQL Schema & Storage RLS Policies
-- Run this in your Supabase Dashboard -> SQL Editor

-- 1. Categories (Racks)
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text default '',
  accent_color text default '#C86D51',
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- 2. Books (PDF & EPUB metadata + 3D spine styling + reading progress)
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete cascade not null,
  title text not null,
  author text default 'Unknown Author',
  format text check (format in ('pdf', 'epub')) not null,
  file_name text not null,
  file_path text not null,
  file_size_bytes bigint default 0,
  page_count integer default 0,
  spine_color text default '#2B463C',
  spine_text_color text default '#FAF6EE',
  spine_height integer default 224,
  spine_thickness integer default 56,
  tilt_deg numeric default 0,
  is_stacked boolean default false,
  current_location text default '1',
  progress_percent integer default 0,
  last_read_at timestamptz,
  created_at timestamptz default now()
);

-- 3. Bookmarks
create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.books(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  location text not null,
  label text default 'Bookmark',
  created_at timestamptz default now()
);

-- Enable Row-Level Security
alter table public.categories enable row level security;
alter table public.books enable row level security;
alter table public.bookmarks enable row level security;

-- RLS Policies: Users can only manage their own library
create policy "Users manage own categories"
  on public.categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own books"
  on public.books for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own bookmarks"
  on public.bookmarks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. Private Storage Bucket for PDF & EPUB files
insert into storage.buckets (id, name, public)
values ('books', 'books', false)
on conflict (id) do nothing;

-- Storage RLS: files are stored under `{user_id}/{book_id}.{ext}`
create policy "Users upload own book files"
  on storage.objects for insert
  with check (
    bucket_id = 'books'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users read own book files"
  on storage.objects for select
  using (
    bucket_id = 'books'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users delete own book files"
  on storage.objects for delete
  using (
    bucket_id = 'books'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
