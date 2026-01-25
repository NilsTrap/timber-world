-- =============================================
-- Multi-Tenancy Schema Migration
-- Migration: 20260126000002_multi_tenancy_schema.sql
-- Story: 6.1 - Database Schema for Multi-Tenancy
-- =============================================

-- =============================================
-- 1. RENAME parties TABLE TO organisations
-- =============================================

ALTER TABLE parties RENAME TO organisations;

-- Update constraint name
ALTER TABLE organisations
  RENAME CONSTRAINT parties_code_uppercase TO organisations_code_uppercase;

-- Update index names
ALTER INDEX idx_parties_code RENAME TO idx_organisations_code;
ALTER INDEX idx_parties_active RENAME TO idx_organisations_active;

-- Update trigger name
ALTER TRIGGER parties_updated_at ON organisations RENAME TO organisations_updated_at;

-- Update table comment
COMMENT ON TABLE organisations IS 'Organizations participating in the platform (may have 0+ users)';

-- =============================================
-- 2. UPDATE portal_users TABLE
-- =============================================

ALTER TABLE portal_users
  RENAME COLUMN party_id TO organisation_id;

-- Update column comment
COMMENT ON COLUMN portal_users.organisation_id IS
  'Links users to their organization. NULL for Super Admin (platform-level access).';

-- =============================================
-- 3. UPDATE shipments TABLE
-- =============================================

ALTER TABLE shipments
  RENAME COLUMN from_party_id TO from_organisation_id;

ALTER TABLE shipments
  RENAME COLUMN to_party_id TO to_organisation_id;

-- Update constraint name
ALTER TABLE shipments
  RENAME CONSTRAINT shipments_different_parties TO shipments_different_organisations;

-- Update index names
ALTER INDEX idx_shipments_from RENAME TO idx_shipments_from_organisation;
ALTER INDEX idx_shipments_to RENAME TO idx_shipments_to_organisation;

-- =============================================
-- 4. ADD organisation_id TO inventory_packages
-- =============================================

-- Step 1: Add column as nullable
ALTER TABLE inventory_packages
  ADD COLUMN organisation_id UUID REFERENCES organisations(id);

-- Step 2: Populate existing packages with TWP organisation
UPDATE inventory_packages
SET organisation_id = (SELECT id FROM organisations WHERE code = 'TWP')
WHERE organisation_id IS NULL;

-- Step 3: Make column NOT NULL
ALTER TABLE inventory_packages
  ALTER COLUMN organisation_id SET NOT NULL;

-- Step 4: Add index
CREATE INDEX idx_inventory_packages_organisation ON inventory_packages(organisation_id);

-- Add comment
COMMENT ON COLUMN inventory_packages.organisation_id IS
  'Organization that owns this inventory package';

-- =============================================
-- 5. ADD organisation_id TO portal_production_entries
-- =============================================

-- Step 1: Add column as nullable
ALTER TABLE portal_production_entries
  ADD COLUMN organisation_id UUID REFERENCES organisations(id);

-- Step 2: Populate existing entries with TWP organisation
UPDATE portal_production_entries
SET organisation_id = (SELECT id FROM organisations WHERE code = 'TWP')
WHERE organisation_id IS NULL;

-- Step 3: Make column NOT NULL
ALTER TABLE portal_production_entries
  ALTER COLUMN organisation_id SET NOT NULL;

-- Step 4: Add index
CREATE INDEX idx_production_entries_organisation ON portal_production_entries(organisation_id);

-- Add comment
COMMENT ON COLUMN portal_production_entries.organisation_id IS
  'Organization that owns this production entry';

-- =============================================
-- 6. UPDATE HELPER FUNCTIONS
-- =============================================

-- Drop existing functions (cannot rename parameters with CREATE OR REPLACE)
DROP FUNCTION IF EXISTS generate_shipment_code(UUID, UUID);
DROP FUNCTION IF EXISTS create_shipment_with_packages(UUID, UUID, DATE, NUMERIC, JSONB);

-- Recreate generate_shipment_code with new parameter names
CREATE FUNCTION generate_shipment_code(
  p_from_organisation_id UUID,
  p_to_organisation_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_from_code CHAR(3);
  v_to_code CHAR(3);
  v_count INTEGER;
BEGIN
  -- Get organisation codes
  SELECT code INTO v_from_code FROM organisations WHERE id = p_from_organisation_id;
  SELECT code INTO v_to_code FROM organisations WHERE id = p_to_organisation_id;

  -- Count existing shipments between these organisations
  SELECT COUNT(*) + 1 INTO v_count
  FROM shipments
  WHERE from_organisation_id = p_from_organisation_id
    AND to_organisation_id = p_to_organisation_id;

  -- Return formatted code
  RETURN v_from_code || '-' || v_to_code || '-' || LPAD(v_count::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Note: generate_package_number doesn't reference parties/organisations directly
-- No update needed for that function

-- Recreate create_shipment_with_packages with new parameter names
CREATE FUNCTION create_shipment_with_packages(
  p_from_organisation_id UUID,
  p_to_organisation_id UUID,
  p_shipment_date DATE,
  p_transport_cost_eur NUMERIC(10, 2),
  p_packages JSONB
) RETURNS JSONB AS $$
DECLARE
  v_shipment_number INTEGER;
  v_shipment_code TEXT;
  v_shipment_id UUID;
  v_package JSONB;
  v_package_number TEXT;
  v_sequence INTEGER := 0;
  v_twp_org_id UUID;
BEGIN
  -- Get TWP organisation ID for package ownership
  SELECT id INTO v_twp_org_id FROM organisations WHERE code = 'TWP';

  -- 1. Get next shipment number
  v_shipment_number := nextval('shipment_number_seq');

  -- 2. Generate shipment code
  v_shipment_code := generate_shipment_code(p_from_organisation_id, p_to_organisation_id);

  -- 3. Insert shipment
  INSERT INTO shipments (
    shipment_code, shipment_number, from_organisation_id, to_organisation_id,
    shipment_date, transport_cost_eur
  ) VALUES (
    v_shipment_code, v_shipment_number, p_from_organisation_id, p_to_organisation_id,
    p_shipment_date, p_transport_cost_eur
  ) RETURNING id INTO v_shipment_id;

  -- 4. Insert all packages (owned by TWP by default for admin-created shipments)
  FOR v_package IN SELECT * FROM jsonb_array_elements(p_packages)
  LOOP
    v_sequence := v_sequence + 1;
    v_package_number := 'TWP-' || LPAD(v_shipment_number::TEXT, 3, '0') || '-' || LPAD(v_sequence::TEXT, 3, '0');

    INSERT INTO inventory_packages (
      shipment_id, package_number, package_sequence,
      organisation_id,
      product_name_id, wood_species_id, humidity_id,
      type_id, processing_id, fsc_id, quality_id,
      thickness, width, length, pieces,
      volume_m3, volume_is_calculated
    ) VALUES (
      v_shipment_id,
      v_package_number,
      v_sequence,
      v_twp_org_id,
      NULLIF(v_package->>'product_name_id', '')::UUID,
      NULLIF(v_package->>'wood_species_id', '')::UUID,
      NULLIF(v_package->>'humidity_id', '')::UUID,
      NULLIF(v_package->>'type_id', '')::UUID,
      NULLIF(v_package->>'processing_id', '')::UUID,
      NULLIF(v_package->>'fsc_id', '')::UUID,
      NULLIF(v_package->>'quality_id', '')::UUID,
      NULLIF(v_package->>'thickness', ''),
      NULLIF(v_package->>'width', ''),
      NULLIF(v_package->>'length', ''),
      NULLIF(v_package->>'pieces', ''),
      (v_package->>'volume_m3')::DECIMAL,
      COALESCE((v_package->>'volume_is_calculated')::BOOLEAN, false)
    );
  END LOOP;

  -- Return result
  RETURN jsonb_build_object(
    'shipment_id', v_shipment_id,
    'shipment_code', v_shipment_code,
    'package_count', v_sequence
  );
END;
$$ LANGUAGE plpgsql;
