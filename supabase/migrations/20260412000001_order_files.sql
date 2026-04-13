-- Order Files: document attachments for orders
-- Two categories: 'customer' (visible to buyer) and 'production' (visible to producer)

-- 1. Create order_files table
CREATE TABLE order_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('customer', 'production')),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT,
  file_size_bytes INTEGER,
  uploaded_by UUID REFERENCES portal_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_files_order_id ON order_files(order_id);

-- 2. RLS on order_files (server actions enforce permission checks)
ALTER TABLE order_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage order files"
  ON order_files
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Create private storage bucket for order files
INSERT INTO storage.buckets (id, name, public)
VALUES ('orders', 'orders', false)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage RLS policies for the orders bucket
CREATE POLICY "Authenticated read for orders bucket"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'orders');

CREATE POLICY "Authenticated upload for orders bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'orders');

CREATE POLICY "Authenticated update for orders bucket"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'orders');

CREATE POLICY "Authenticated delete for orders bucket"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'orders');
