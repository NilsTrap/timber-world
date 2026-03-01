-- Marketing Media CMS Tables
-- Created: 2026-03-01
-- Manages marketing images/videos for the website (journey images, hero, logos)

-- Marketing Media table
CREATE TABLE marketing_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('journey', 'hero', 'logo')),
  slot_key TEXT NOT NULL,           -- e.g., 'forest-maturing', 'hero-video'
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,       -- Supabase Storage path
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  alt_text TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (category, slot_key)
);

-- Indexes
CREATE INDEX idx_marketing_media_category ON marketing_media(category);
CREATE INDEX idx_marketing_media_slot_key ON marketing_media(slot_key);
CREATE INDEX idx_marketing_media_active ON marketing_media(is_active);

-- Updated_at trigger
CREATE TRIGGER update_marketing_media_updated_at
  BEFORE UPDATE ON marketing_media
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies (admin-only access enforced at application level)
ALTER TABLE marketing_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access to marketing_media"
  ON marketing_media
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create Supabase Storage bucket for marketing assets
-- Note: This is done via Supabase dashboard or CLI, not SQL
-- Bucket name: 'marketing'
-- Structure: marketing/{category}/{slot_key}/{filename}

-- Seed with slot definitions (no actual files yet - those will be uploaded via admin UI)
-- Journey stages (33 total)
INSERT INTO marketing_media (category, slot_key, file_name, storage_path, mime_type, alt_text, sort_order) VALUES
-- Forest (3)
('journey', 'forest-maturing', 'forest-maturing.jpg', 'journey/forest-maturing/forest-maturing.jpg', 'image/jpeg', 'Forest maturing', 1),
('journey', 'forest-harvesting', 'forest-harvesting.jpg', 'journey/forest-harvesting/forest-harvesting.jpg', 'image/jpeg', 'Forest harvesting', 2),
('journey', 'forest-renewing', 'forest-renewing.jpg', 'journey/forest-renewing/forest-renewing.jpg', 'image/jpeg', 'Forest renewing', 3),
-- Sawmill (3)
('journey', 'sawmill-grading', 'sawmill-grading.jpg', 'journey/sawmill-grading/sawmill-grading.jpg', 'image/jpeg', 'Sawmill grading', 4),
('journey', 'sawmill-sawing', 'sawmill-sawing.jpg', 'journey/sawmill-sawing/sawmill-sawing.jpg', 'image/jpeg', 'Sawmill sawing', 5),
('journey', 'sawmill-stacking', 'sawmill-stacking.jpg', 'journey/sawmill-stacking/sawmill-stacking.jpg', 'image/jpeg', 'Sawmill stacking', 6),
-- Kiln (3)
('journey', 'kiln-arranging', 'kiln-arranging.jpg', 'journey/kiln-arranging/kiln-arranging.jpg', 'image/jpeg', 'Kiln arranging', 7),
('journey', 'kiln-drying', 'kiln-drying.jpg', 'journey/kiln-drying/kiln-drying.jpg', 'image/jpeg', 'Kiln drying', 8),
('journey', 'kiln-protecting', 'kiln-protecting.jpg', 'journey/kiln-protecting/kiln-protecting.jpg', 'image/jpeg', 'Kiln protecting', 9),
-- Factory (6)
('journey', 'factory-multisaw', 'factory-multisaw.jpg', 'journey/factory-multisaw/factory-multisaw.jpg', 'image/jpeg', 'Factory multisaw', 10),
('journey', 'factory-opticut', 'factory-opticut.jpg', 'journey/factory-opticut/factory-opticut.jpg', 'image/jpeg', 'Factory opticut', 11),
('journey', 'factory-planing', 'factory-planing.jpg', 'journey/factory-planing/factory-planing.jpg', 'image/jpeg', 'Factory planing', 12),
('journey', 'factory-fingerjointing', 'factory-fingerjointing.jpg', 'journey/factory-fingerjointing/factory-fingerjointing.jpg', 'image/jpeg', 'Factory finger jointing', 13),
('journey', 'factory-gluing', 'factory-gluing.jpg', 'journey/factory-gluing/factory-gluing.jpg', 'image/jpeg', 'Factory gluing', 14),
('journey', 'factory-calibrating', 'factory-calibrating.jpg', 'journey/factory-calibrating/factory-calibrating.jpg', 'image/jpeg', 'Factory calibrating', 15),
-- Workshop (5)
('journey', 'workshop-cnc', 'workshop-cnc.jpg', 'journey/workshop-cnc/workshop-cnc.jpg', 'image/jpeg', 'Workshop CNC', 16),
('journey', 'workshop-bonding', 'workshop-bonding.jpg', 'journey/workshop-bonding/workshop-bonding.jpg', 'image/jpeg', 'Workshop bonding', 17),
('journey', 'workshop-sanding', 'workshop-sanding.jpg', 'journey/workshop-sanding/workshop-sanding.jpg', 'image/jpeg', 'Workshop sanding', 18),
('journey', 'workshop-finishing', 'workshop-finishing.jpg', 'journey/workshop-finishing/workshop-finishing.jpg', 'image/jpeg', 'Workshop finishing', 19),
('journey', 'workshop-packaging', 'workshop-packaging.jpg', 'journey/workshop-packaging/workshop-packaging.jpg', 'image/jpeg', 'Workshop packaging', 20),
-- Warehouse (4)
('journey', 'warehouse-controlling', 'warehouse-controlling.jpg', 'journey/warehouse-controlling/warehouse-controlling.jpg', 'image/jpeg', 'Warehouse controlling', 21),
('journey', 'warehouse-storing', 'warehouse-storing.jpg', 'journey/warehouse-storing/warehouse-storing.jpg', 'image/jpeg', 'Warehouse storing', 22),
('journey', 'warehouse-delivering', 'warehouse-delivering.jpg', 'journey/warehouse-delivering/warehouse-delivering.jpg', 'image/jpeg', 'Warehouse delivering', 23),
('journey', 'warehouse-feedback', 'warehouse-feedback.jpg', 'journey/warehouse-feedback/warehouse-feedback.jpg', 'image/jpeg', 'Warehouse feedback', 24),
-- Stage backgrounds (6)
('journey', 'forest', 'forest.jpg', 'journey/forest/forest.jpg', 'image/jpeg', 'Forest stage background', 25),
('journey', 'sawmill', 'sawmill.jpg', 'journey/sawmill/sawmill.jpg', 'image/jpeg', 'Sawmill stage background', 26),
('journey', 'kiln', 'kiln.jpg', 'journey/kiln/kiln.jpg', 'image/jpeg', 'Kiln stage background', 27),
('journey', 'factory', 'factory.jpg', 'journey/factory/factory.jpg', 'image/jpeg', 'Factory stage background', 28),
('journey', 'workshop', 'workshop.jpg', 'journey/workshop/workshop.jpg', 'image/jpeg', 'Workshop stage background', 29),
('journey', 'warehouse', 'warehouse.jpg', 'journey/warehouse/warehouse.jpg', 'image/jpeg', 'Warehouse stage background', 30);

-- Hero section (2)
INSERT INTO marketing_media (category, slot_key, file_name, storage_path, mime_type, alt_text, sort_order) VALUES
('hero', 'hero-video', 'hero-video.mp4', 'hero/hero-video/hero-video.mp4', 'video/mp4', 'Hero background video', 1),
('hero', 'hero-poster', 'hero-poster.jpg', 'hero/hero-poster/hero-poster.jpg', 'image/jpeg', 'Hero video poster', 2);

-- Logos (placeholder - add specific logos as needed)
INSERT INTO marketing_media (category, slot_key, file_name, storage_path, mime_type, alt_text, sort_order) VALUES
('logo', 'logo-main', 'logo-main.svg', 'logo/logo-main/logo-main.svg', 'image/svg+xml', 'Timber World main logo', 1),
('logo', 'logo-white', 'logo-white.svg', 'logo/logo-white/logo-white.svg', 'image/svg+xml', 'Timber World white logo', 2);
