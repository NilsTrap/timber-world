-- Production Inputs Table
-- Story 4.2: Links production entries to inventory packages consumed as inputs

CREATE TABLE portal_production_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_entry_id UUID REFERENCES portal_production_entries(id) ON DELETE CASCADE NOT NULL,
  package_id UUID REFERENCES inventory_packages(id) NOT NULL,
  pieces_used INTEGER CHECK (pieces_used > 0),  -- NULL when package has no countable pieces
  volume_m3 DECIMAL NOT NULL,                    -- Always required (calculated or manual)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_production_inputs_entry_id ON portal_production_inputs(production_entry_id);
CREATE INDEX idx_production_inputs_package_id ON portal_production_inputs(package_id);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
