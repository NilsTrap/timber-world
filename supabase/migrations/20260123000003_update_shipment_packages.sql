-- Update shipment packages function
-- Atomically updates transport cost and replaces all packages for a shipment

CREATE OR REPLACE FUNCTION update_shipment_packages(
  p_shipment_id UUID,
  p_transport_cost_eur NUMERIC(10, 2),
  p_packages JSONB
) RETURNS JSONB AS $$
DECLARE
  v_shipment_number INTEGER;
  v_package JSONB;
  v_package_number TEXT;
  v_sequence INTEGER := 0;
BEGIN
  -- Get shipment number for package numbering
  SELECT shipment_number INTO v_shipment_number
  FROM shipments WHERE id = p_shipment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shipment not found: %', p_shipment_id;
  END IF;

  -- Update transport cost
  UPDATE shipments SET
    transport_cost_eur = p_transport_cost_eur,
    updated_at = now()
  WHERE id = p_shipment_id;

  -- Delete existing packages
  DELETE FROM inventory_packages WHERE shipment_id = p_shipment_id;

  -- Re-insert all packages
  FOR v_package IN SELECT * FROM jsonb_array_elements(p_packages)
  LOOP
    v_sequence := v_sequence + 1;
    v_package_number := 'TWP-' || LPAD(v_shipment_number::TEXT, 3, '0')
      || '-' || LPAD(v_sequence::TEXT, 3, '0');

    INSERT INTO inventory_packages (
      shipment_id, package_number, package_sequence,
      product_name_id, wood_species_id, humidity_id,
      type_id, processing_id, fsc_id, quality_id,
      thickness, width, length, pieces,
      volume_m3, volume_is_calculated
    ) VALUES (
      p_shipment_id,
      v_package_number,
      v_sequence,
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

  RETURN jsonb_build_object(
    'shipment_id', p_shipment_id,
    'package_count', v_sequence
  );
END;
$$ LANGUAGE plpgsql;
