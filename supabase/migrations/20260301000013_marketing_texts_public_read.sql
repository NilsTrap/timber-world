-- Marketing Texts Public Read Policy
-- Created: 2026-03-01
-- Allow public (anonymous) read access to marketing_texts table
-- This is required for the marketing website to fetch product titles/descriptions

-- Allow anonymous SELECT on marketing_texts
CREATE POLICY "Public read access for marketing_texts"
ON marketing_texts FOR SELECT
TO anon
USING (true);
