-- Marketing Storage Policies
-- Created: 2026-03-01
-- Add RLS policies for marketing storage bucket

-- Allow public read access to marketing bucket
CREATE POLICY "Public read access for marketing bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'marketing');

-- Allow authenticated users to upload to marketing bucket
CREATE POLICY "Authenticated upload for marketing bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'marketing');

-- Allow authenticated users to update in marketing bucket
CREATE POLICY "Authenticated update for marketing bucket"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'marketing');

-- Allow authenticated users to delete from marketing bucket
CREATE POLICY "Authenticated delete for marketing bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'marketing');
