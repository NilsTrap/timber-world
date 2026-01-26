-- Migration: Admin Inventory Support
-- Allows admin to add inventory directly to organizations without a source organization
-- The from_organisation_id becomes nullable for admin-added inventory (shipment_code = 'ADMIN')

-- 1. Make from_organisation_id nullable
ALTER TABLE shipments
  ALTER COLUMN from_organisation_id DROP NOT NULL;

-- 2. Drop the old constraint that requires from != to
ALTER TABLE shipments
  DROP CONSTRAINT IF EXISTS shipments_different_parties;

-- 3. Add new constraint: from != to OR from is NULL (for admin inventory)
ALTER TABLE shipments
  ADD CONSTRAINT shipments_valid_organisations
  CHECK (from_organisation_id IS NULL OR from_organisation_id != to_organisation_id);

-- 4. Drop the unique constraint on shipment_code and recreate as partial
--    (allows multiple 'ADMIN' entries, but other codes must still be unique)
ALTER TABLE shipments
  DROP CONSTRAINT IF EXISTS shipments_shipment_code_key;

CREATE UNIQUE INDEX shipments_shipment_code_unique
  ON shipments (shipment_code)
  WHERE shipment_code != 'ADMIN';

-- 5. Create function for admin inventory creation
CREATE OR REPLACE FUNCTION create_admin_inventory(
  p_to_organisation_id UUID,
  p_shipment_date DATE,
  p_shipment_code TEXT,
  p_packages JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_shipment_id UUID;
  v_shipment_number INTEGER;
  v_package JSONB;
  v_sequence INTEGER := 0;
  v_package_number TEXT;
BEGIN
  -- Get next shipment number (used for fallback package numbering)
  v_shipment_number := get_next_shipment_number();

  -- Insert shipment with custom code (from_organisation_id is NULL for admin inventory)
  INSERT INTO shipments (
    shipment_code, shipment_number, from_organisation_id, to_organisation_id,
    shipment_date, status, completed_at
  ) VALUES (
    COALESCE(NULLIF(TRIM(p_shipment_code), ''), 'ADMIN'), v_shipment_number, NULL, p_to_organisation_id,
    p_shipment_date, 'completed', NOW()
  )
  RETURNING id INTO v_shipment_id;

  -- Insert packages with custom or auto-generated numbers
  FOR v_package IN SELECT * FROM jsonb_array_elements(p_packages)
  LOOP
    v_sequence := v_sequence + 1;

    -- Use custom package number if provided, otherwise auto-generate
    v_package_number := NULLIF(TRIM(v_package->>'package_number'), '');
    IF v_package_number IS NULL THEN
      v_package_number := COALESCE(NULLIF(TRIM(p_shipment_code), ''), 'ADMIN') || '-' || LPAD(v_shipment_number::TEXT, 3, '0') || '-' || LPAD(v_sequence::TEXT, 3, '0');
    END IF;

    INSERT INTO inventory_packages (
      shipment_id, package_number, package_sequence,
      product_name_id, wood_species_id, humidity_id, type_id,
      processing_id, fsc_id, quality_id,
      thickness, width, length, pieces, volume_m3, volume_is_calculated,
      organisation_id
    ) VALUES (
      v_shipment_id, v_package_number, v_sequence,
      (v_package->>'product_name_id')::UUID,
      (v_package->>'wood_species_id')::UUID,
      (v_package->>'humidity_id')::UUID,
      (v_package->>'type_id')::UUID,
      (v_package->>'processing_id')::UUID,
      (v_package->>'fsc_id')::UUID,
      (v_package->>'quality_id')::UUID,
      v_package->>'thickness',
      v_package->>'width',
      v_package->>'length',
      v_package->>'pieces',
      (v_package->>'volume_m3')::NUMERIC,
      COALESCE((v_package->>'volume_is_calculated')::BOOLEAN, false),
      p_to_organisation_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'shipment_id', v_shipment_id,
    'shipment_code', COALESCE(NULLIF(TRIM(p_shipment_code), ''), 'ADMIN'),
    'package_count', v_sequence
  );
END;
$$ LANGUAGE plpgsql;
