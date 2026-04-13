-- Add is_thumbnail flag to order_files
-- Only one file per order should be the thumbnail (enforced in application code)
ALTER TABLE order_files ADD COLUMN is_thumbnail BOOLEAN NOT NULL DEFAULT false;
