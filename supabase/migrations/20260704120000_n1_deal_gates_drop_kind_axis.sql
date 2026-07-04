-- N1 · Gates: drop the deal-kind axis.
-- Nils (2026-07-04): "all deals are the same — buy/sell kinds in gates are legacy."
-- Gates now have ONE set per from_stage. We keep the `deal_kind` column and the
-- (deal_kind, from_stage) unique constraint intact (reversible / additive-friendly);
-- the app now stores & reads every gate under the single universal kind 'buy_sell',
-- and this migration collapses the data by keeping the buy_sell rows as the universal
-- set and removing any other-kind rows.
--
-- Idempotent: re-running deletes nothing new once collapsed. Snapshot the current
-- deal_gates rows before applying (done in the N1 report) so the delete is reversible.

DELETE FROM public.deal_gates WHERE deal_kind <> 'buy_sell';
