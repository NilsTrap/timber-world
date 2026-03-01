-- Marketing Media Public Read Policy
-- Created: 2026-03-01
-- Allow public (anonymous) read access to marketing_media table
-- This is required for the marketing website to fetch product/journey images

-- Allow anonymous SELECT on marketing_media
CREATE POLICY "Public read access for marketing_media"
ON marketing_media FOR SELECT
TO anon
USING (true);
