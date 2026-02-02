-- Backfill notes from production outputs to inventory packages
-- For productions that were validated before notes sync was implemented

UPDATE inventory_packages ip
SET notes = po.notes
FROM portal_production_outputs po
WHERE ip.production_entry_id = po.production_entry_id
  AND ip.package_number = po.package_number
  AND po.notes IS NOT NULL
  AND po.notes != ''
  AND (ip.notes IS NULL OR ip.notes = '');
