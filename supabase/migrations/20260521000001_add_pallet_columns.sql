-- Pallet tracking for the Packing process.
--
-- The pallet cost is auxiliary to the per-unit work cost: Packing entries
-- sometimes use one or more pallets and we want to roll the pallet cost into
-- the entry's total.
--
-- Stored generically (per-process price, per-entry count) so the schema isn't
-- packing-specific, but the UI is gated to process.code = 'PC' (Packing) —
-- other processes don't show the pallet inputs.

-- Per-process pallet unit price. NULL means "this process doesn't track
-- pallets" (no UI shown). Configured in the Reference Data admin page;
-- in practice only Packing has a value.
ALTER TABLE ref_processes
ADD COLUMN pallet_price NUMERIC(10, 2) DEFAULT NULL;

COMMENT ON COLUMN ref_processes.pallet_price IS 'Auxiliary unit price for pallets used in this process. NULL = pallets not tracked.';

-- Per-entry pallet count. NULL means "not entered" (cell shows empty).
-- Only meaningful when the entry''s process has pallet_price configured.
ALTER TABLE portal_production_entries
ADD COLUMN pallet_count INTEGER DEFAULT NULL;

COMMENT ON COLUMN portal_production_entries.pallet_count IS 'Number of pallets used in this production entry (Packing only). NULL = not entered.';
