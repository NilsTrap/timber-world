-- Migration: Import MAS prices from products table to inventory_packages
-- Matches inventory_packages to products via the original SKU stored in notes field

-- Skip entirely on DBs that don't have the MAS AS org seeded (fresh staging /
-- branch DBs). On production both the org and the products table are present
-- and this runs through normally.
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organisations WHERE id = '6d11e93b-02eb-41de-a6b1-f026a35c1cfb') THEN
    RAISE NOTICE 'MAS AS org not present; skipping MAS price import.';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='products') THEN
    RAISE NOTICE 'products table not present; skipping MAS price import.';
    RETURN;
  END IF;

  UPDATE inventory_packages ip
  SET
    unit_price_piece = p.unit_price_piece,
    unit_price_m3 = p.unit_price_m3,
    unit_price_m2 = p.unit_price_m2
  FROM products p
  WHERE ip.notes LIKE '%Original SKU: ' || p.sku || '%'
    AND ip.organisation_id = '6d11e93b-02eb-41de-a6b1-f026a35c1cfb';

  SELECT COUNT(*) INTO v_count
  FROM inventory_packages
  WHERE organisation_id = '6d11e93b-02eb-41de-a6b1-f026a35c1cfb'
    AND unit_price_m3 IS NOT NULL;

  RAISE NOTICE 'Updated % MAS inventory packages with prices', v_count;
END $$;
