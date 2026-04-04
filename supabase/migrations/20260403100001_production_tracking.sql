-- Production Tracking tables
-- Allows grouping inventory packages into named tracking sets per organisation

CREATE TABLE IF NOT EXISTS production_tracking_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  created_by UUID NOT NULL REFERENCES portal_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_tracking_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_set_id UUID NOT NULL REFERENCES production_tracking_sets(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES inventory_packages(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tracking_set_id, package_id)
);

CREATE INDEX idx_tracking_sets_org ON production_tracking_sets(organisation_id);
CREATE INDEX idx_tracking_packages_set ON production_tracking_packages(tracking_set_id);
CREATE INDEX idx_tracking_packages_pkg ON production_tracking_packages(package_id);

-- Enable RLS
ALTER TABLE production_tracking_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_tracking_packages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (admin enforcement at app level)
CREATE POLICY "Allow authenticated access to production_tracking_sets"
  ON production_tracking_sets FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated access to production_tracking_packages"
  ON production_tracking_packages FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
