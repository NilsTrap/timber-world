-- Migration: Import MAS AS Inventory from Products Table
-- Creates inventory packages from the products table for MAS AS organization

DO $$
DECLARE
  v_mas_org_id UUID := '6d11e93b-02eb-41de-a6b1-f026a35c1cfb';
  v_shipment_id UUID;
  v_shipment_number INTEGER;
  v_sequence INTEGER := 0;
  v_product RECORD;
  v_package_number TEXT;
  v_species_id UUID;
  v_type_id UUID;
  v_quality_id UUID;
  -- Fixed reference IDs
  v_product_name_id UUID := '4f91e5ae-3b76-4932-9fee-64ce6fa60094'; -- Solid wood panels
  v_humidity_id UUID := 'aadc1d5c-96e7-4278-a536-61fab10f9a26'; -- KD 7-9%
  v_processing_id UUID := 'a5619dda-ab5f-4c2b-82ec-927164c663ec'; -- Sanded
  v_fsc_no_id UUID := 'bd8a1f01-1bf2-4a37-b1ee-96e5295780bd'; -- No
BEGIN
  -- Get next shipment number
  v_shipment_number := get_next_shipment_number();

  -- Create shipment for MAS AS inventory (admin-created, no source org)
  INSERT INTO shipments (
    shipment_code, shipment_number, from_organisation_id, to_organisation_id,
    shipment_date, status, completed_at
  ) VALUES (
    'MAS-INITIAL', v_shipment_number, NULL, v_mas_org_id,
    CURRENT_DATE, 'completed', NOW()
  )
  RETURNING id INTO v_shipment_id;

  RAISE NOTICE 'Created shipment: MAS-INITIAL (ID: %)', v_shipment_id;

  -- Insert packages from products table
  FOR v_product IN
    SELECT * FROM products ORDER BY sku
  LOOP
    v_sequence := v_sequence + 1;

    -- Generate package number
    v_package_number := 'MAS-' || LPAD(v_shipment_number::TEXT, 3, '0') || '-' || LPAD(v_sequence::TEXT, 3, '0');

    -- Map species to reference ID
    SELECT id INTO v_species_id FROM ref_wood_species WHERE LOWER(value) = LOWER(v_product.species);
    IF v_species_id IS NULL THEN
      RAISE WARNING 'Unknown species: %, skipping product %', v_product.species, v_product.sku;
      CONTINUE;
    END IF;

    -- Map type to reference ID (FJ or Full stave)
    IF v_product.type = 'FJ' THEN
      v_type_id := '42e0caa2-d00a-4bf5-85cd-8f2630eaa9ca';
    ELSIF v_product.type = 'FS' THEN
      v_type_id := '8e1b7831-9ab6-4e32-9755-6651607b63f9';
    ELSE
      RAISE WARNING 'Unknown type: %, skipping product %', v_product.type, v_product.sku;
      CONTINUE;
    END IF;

    -- Map quality to reference ID
    SELECT id INTO v_quality_id FROM ref_quality WHERE LOWER(value) = LOWER(v_product.quality_grade);
    IF v_quality_id IS NULL THEN
      RAISE WARNING 'Unknown quality: %, skipping product %', v_product.quality_grade, v_product.sku;
      CONTINUE;
    END IF;

    -- Calculate volume (dimensions in mm, convert to m)
    -- Volume = thickness * width * length * pieces / 1000000000 (mm3 to m3)

    INSERT INTO inventory_packages (
      shipment_id, package_number, package_sequence,
      product_name_id, wood_species_id, humidity_id, type_id,
      processing_id, fsc_id, quality_id,
      thickness, width, length, pieces, volume_m3, volume_is_calculated,
      organisation_id, notes
    ) VALUES (
      v_shipment_id, v_package_number, v_sequence,
      v_product_name_id, v_species_id, v_humidity_id, v_type_id,
      v_processing_id, v_fsc_no_id, v_quality_id,
      v_product.thickness::TEXT,
      v_product.width::TEXT,
      v_product.length::TEXT,
      v_product.stock_quantity::TEXT,
      -- Calculate volume: thickness(mm) * width(mm) * length(mm) * pieces / 10^9
      ROUND((v_product.thickness::NUMERIC * v_product.width::NUMERIC * v_product.length::NUMERIC * v_product.stock_quantity::NUMERIC) / 1000000000, 3),
      true, -- volume is calculated
      v_mas_org_id,
      'Imported from products table. Original SKU: ' || v_product.sku ||
      '. Prices: ' || (v_product.unit_price_m3 / 100.0)::TEXT || ' EUR/m3, ' ||
      (v_product.unit_price_piece / 100.0)::TEXT || ' EUR/piece, ' ||
      (v_product.unit_price_m2 / 100.0)::TEXT || ' EUR/m2'
    );
  END LOOP;

  RAISE NOTICE 'Imported % packages for MAS AS', v_sequence;
END $$;

-- Verify the import
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM inventory_packages
  WHERE organisation_id = '6d11e93b-02eb-41de-a6b1-f026a35c1cfb';

  RAISE NOTICE 'Total MAS AS inventory packages: %', v_count;
END $$;
