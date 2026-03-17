-- Add marketing_enabled flag to organisations
-- Controls which organisations' inventory is shown on the marketing website stock page
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS marketing_enabled BOOLEAN NOT NULL DEFAULT FALSE;
