-- Organization-specific notes for production processes
-- Allows each organization to add their own descriptions/explanations for processes

CREATE TABLE organization_process_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  process_id UUID NOT NULL REFERENCES ref_processes(id) ON DELETE CASCADE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, process_id)
);

-- Index for faster lookups by organization
CREATE INDEX idx_org_process_notes_org_id ON organization_process_notes(organization_id);

-- RLS policies
ALTER TABLE organization_process_notes ENABLE ROW LEVEL SECURITY;

-- Users can view notes for their organization
CREATE POLICY "Users can view their organization's process notes"
  ON organization_process_notes
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organisation_id FROM portal_users WHERE auth_user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM portal_users WHERE auth_user_id = auth.uid() AND is_platform_admin = true)
  );

-- Users can insert notes for their organization
CREATE POLICY "Users can insert process notes for their organization"
  ON organization_process_notes
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organisation_id FROM portal_users WHERE auth_user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM portal_users WHERE auth_user_id = auth.uid() AND is_platform_admin = true)
  );

-- Users can update notes for their organization
CREATE POLICY "Users can update their organization's process notes"
  ON organization_process_notes
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organisation_id FROM portal_users WHERE auth_user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM portal_users WHERE auth_user_id = auth.uid() AND is_platform_admin = true)
  );

-- Users can delete notes for their organization
CREATE POLICY "Users can delete their organization's process notes"
  ON organization_process_notes
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organisation_id FROM portal_users WHERE auth_user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM portal_users WHERE auth_user_id = auth.uid() AND is_platform_admin = true)
  );

-- Trigger for updated_at
CREATE TRIGGER update_org_process_notes_updated_at
  BEFORE UPDATE ON organization_process_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
