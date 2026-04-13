-- Order Activity Log: tracks all changes made to orders
CREATE TABLE order_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES portal_users(id),
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_activity_log_order_id ON order_activity_log(order_id);
CREATE INDEX idx_order_activity_log_created_at ON order_activity_log(created_at);

-- RLS
ALTER TABLE order_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read order activity log"
  ON order_activity_log
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert order activity log"
  ON order_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
