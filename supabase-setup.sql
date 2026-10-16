-- ========================================================
-- AMAR LIBRARY: SUPABASE STORAGE SETUP
-- Run this script in your Supabase Dashboard:
-- 1. Open https://supabase.com/dashboard
-- 2. Select your project ("Amar Library")
-- 3. Click "SQL Editor" in the left sidebar
-- 4. Click "New query", paste this code, and click "Run"
-- ========================================================

-- Step 1: Create 'book-pdfs' bucket for private PDF storage (up to 60 MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'book-pdfs',
  'book-pdfs',
  false,
  62914560,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 62914560,
  allowed_mime_types = ARRAY['application/pdf'];

-- Step 2: Create 'book-covers' bucket for cover images (Public, up to 10 MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'book-covers',
  'book-covers',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Step 3: Remove old storage policies if any existed
DROP POLICY IF EXISTS "Authenticated users can upload PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read their own PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their own PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their own PDFs" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can upload covers" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their own covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their own covers" ON storage.objects;

-- Step 4: Ensure Row Level Security is active on storage objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 5: Policies for 'book-pdfs' (Strict User Isolation)
-- Users can only upload, read, update, or delete files inside their own user folder (userId/...)
CREATE POLICY "Authenticated users can upload PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'book-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Authenticated users can read their own PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'book-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Authenticated users can update their own PDFs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'book-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Authenticated users can delete their own PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'book-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Step 6: Policies for 'book-covers'
CREATE POLICY "Authenticated users can upload covers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'book-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Anyone can view covers"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'book-covers');

CREATE POLICY "Authenticated users can update their own covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'book-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Authenticated users can delete their own covers"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'book-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
