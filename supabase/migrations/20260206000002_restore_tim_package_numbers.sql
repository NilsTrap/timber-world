-- Restore original package numbers for packages in Timber International draft shipment
-- The packages were incorrectly renamed when added to the shipment

-- Update packages in the draft shipment from Timber International
-- Restore to TIM005, TIM006, TIM007 based on package_sequence order
WITH shipment_packages AS (
  SELECT
    ip.id,
    ip.package_sequence,
    ROW_NUMBER() OVER (ORDER BY ip.package_sequence) as row_num
  FROM inventory_packages ip
  JOIN shipments s ON ip.shipment_id = s.id
  JOIN organisations o ON s.from_organisation_id = o.id
  WHERE s.status = 'draft'
    AND o.code = 'TIM'
)
UPDATE inventory_packages
SET package_number = 'TIM' || LPAD((sp.row_num + 4)::text, 3, '0')
FROM shipment_packages sp
WHERE inventory_packages.id = sp.id;
