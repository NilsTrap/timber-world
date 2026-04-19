-- Marketing Specifications
-- Allows admin to manage product specification groups with downloadable files (PDFs, images)

-- Specification groups (e.g., "Oak Panels", "Stair Treads")
CREATE TABLE marketing_specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual files within a specification group
CREATE TABLE marketing_specification_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specification_id UUID NOT NULL REFERENCES marketing_specifications(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE marketing_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_specification_files ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (app-level admin checks)
CREATE POLICY "Authenticated users can manage specifications"
  ON marketing_specifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage specification files"
  ON marketing_specification_files FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow anonymous read for public website
CREATE POLICY "Anyone can read active specifications"
  ON marketing_specifications FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "Anyone can read specification files"
  ON marketing_specification_files FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM marketing_specifications s
    WHERE s.id = specification_id AND s.is_active = true
  ));

-- Index for ordering
CREATE INDEX idx_marketing_specifications_sort ON marketing_specifications (sort_order, created_at);
CREATE INDEX idx_marketing_spec_files_spec ON marketing_specification_files (specification_id, sort_order);
