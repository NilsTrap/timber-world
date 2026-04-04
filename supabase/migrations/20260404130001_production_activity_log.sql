-- Production Activity Log
-- Records every action performed on production entries for full audit trail

CREATE TABLE production_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_entry_id UUID NOT NULL REFERENCES portal_production_entries(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prod_activity_log_entry ON production_activity_log(production_entry_id, created_at DESC);

-- RLS: authenticated users can read/write
ALTER TABLE production_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access to production_activity_log"
  ON production_activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
