-- Module Presets and Order Sub-modules
-- 1. Create module_presets table for storing named presets
-- 2. Add granular order sub-modules to features table

-- 1. Module presets table
CREATE TABLE module_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  module_codes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_module_presets_name ON module_presets(name);
COMMENT ON TABLE module_presets IS 'Named presets of module codes for quick org configuration';

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_module_presets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_module_presets_updated_at
  BEFORE UPDATE ON module_presets
  FOR EACH ROW EXECUTE FUNCTION update_module_presets_updated_at();

-- 2. Granular order sub-modules
INSERT INTO features (code, name, description, category, sort_order) VALUES
  ('orders.create',            'Create Orders',     'Create new orders',                    'Orders', 601),
  ('orders.customer-select',   'Customer Select',   'Select customer when creating orders', 'Orders', 602),
  ('orders.pricing',           'Order Pricing',     'View and manage order pricing',        'Orders', 603),
  ('orders.production-status', 'Production Status', 'View production status on orders',     'Orders', 604)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order;
