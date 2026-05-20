-- Narrow the (production_entry_id, package_sequence) unique index so it only
-- applies to packages still sitting in inventory (shipment_id IS NULL).
--
-- Background: package_sequence is overloaded — it represents both the
-- output position within a production entry AND the position within a
-- shipment. Two partial unique indexes cover the column:
--   - idx_inventory_packages_production_seq on (production_entry_id, package_sequence)
--   - the shipment-level uniqueness on (shipment_id, package_sequence)
--
-- Before this change both indexes applied simultaneously to a package that
-- had been produced (production_entry_id NOT NULL) AND added to a shipment
-- (shipment_id NOT NULL). Adding a partial production-entry's outputs to a
-- new shipment then collided on the production index when the shipment's
-- target sequence (1..N starting from maxSeq+1) overlapped with the
-- sequences still held by un-moved siblings in the same production entry.
--
-- After this change the production-sequence index only enforces uniqueness
-- while the package is still in inventory. Once shipped, only the shipment
-- index applies. Removing a package from a shipment sets package_sequence
-- back to NULL (see removePackageFromShipment), so the row re-enters this
-- index with a NULL sequence — and partial unique indexes treat NULL as
-- distinct, so multiple un-sequenced packages within the same production
-- entry are fine.
DROP INDEX IF EXISTS idx_inventory_packages_production_seq;

CREATE UNIQUE INDEX idx_inventory_packages_production_seq
  ON inventory_packages(production_entry_id, package_sequence)
  WHERE production_entry_id IS NOT NULL AND shipment_id IS NULL;
