-- Marketing Bucket Public Access
-- Created: 2026-03-01
-- Ensure the marketing bucket is set to public for image access

-- Update the marketing bucket to be public
-- This allows getPublicUrl() to return working URLs without authentication
UPDATE storage.buckets
SET public = true
WHERE id = 'marketing';
