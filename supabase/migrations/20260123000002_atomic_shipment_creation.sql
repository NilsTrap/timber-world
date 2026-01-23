-- Atomic shipment + packages creation function
-- Wraps all inserts in a single transaction to prevent partial writes

CREATE OR REPLACE FUNCTION create_shipment_with_packages(
  p_from_party_id UUID,
  p_to_party_id UUID,
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
BEGIN
  -- 1. Get next shipment number
  v_shipment_number := nextval('shipment_number_seq');

  -- 2. Generate shipment code
  v_shipment_code := generate_shipment_code(p_from_party_id, p_to_party_id);

  -- 3. Insert shipment
  INSERT INTO shipments (
    shipment_code, shipment_number, from_party_id, to_party_id,
    shipment_date, transport_cost_eur
  ) VALUES (
    v_shipment_code, v_shipment_number, p_from_party_id, p_to_party_id,
    p_shipment_date, p_transport_cost_eur
  ) RETURNING id INTO v_shipment_id;

  -- 4. Insert all packages
  FOR v_package IN SELECT * FROM jsonb_array_elements(p_packages)
  LOOP
    v_sequence := v_sequence + 1;
    v_package_number := 'TWP-' || LPAD(v_shipment_number::TEXT, 3, '0') || '-' || LPAD(v_sequence::TEXT, 3, '0');

    INSERT INTO inventory_packages (
      shipment_id, package_number, package_sequence,
      product_name_id, wood_species_id, humidity_id,
      type_id, processing_id, fsc_id, quality_id,
      thickness, width, length, pieces,
      volume_m3, volume_is_calculated
    ) VALUES (
      v_shipment_id,
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

  -- Return result
  RETURN jsonb_build_object(
    'shipment_id', v_shipment_id,
    'shipment_code', v_shipment_code,
    'package_count', v_sequence
  );
END;
$$ LANGUAGE plpgsql;
