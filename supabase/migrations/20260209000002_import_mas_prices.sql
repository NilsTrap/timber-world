-- Migration: Import MAS prices from products table to inventory_packages
-- Matches inventory_packages to products via the original SKU stored in notes field

UPDATE inventory_packages ip
SET
  unit_price_piece = p.unit_price_piece,
  unit_price_m3 = p.unit_price_m3,
  unit_price_m2 = p.unit_price_m2
FROM products p
WHERE ip.notes LIKE '%Original SKU: ' || p.sku || '%'
  AND ip.organisation_id = '6d11e93b-02eb-41de-a6b1-f026a35c1cfb'; -- MAS AS organisation

-- Verify the update
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM inventory_packages
  WHERE organisation_id = '6d11e93b-02eb-41de-a6b1-f026a35c1cfb'
    AND unit_price_m3 IS NOT NULL;

  RAISE NOTICE 'Updated % MAS inventory packages with prices', v_count;
END $$;
