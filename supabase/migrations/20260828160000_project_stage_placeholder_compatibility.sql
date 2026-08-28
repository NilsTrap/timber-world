-- RFP legs legitimately have no seller until a quotation is awarded. Status is
-- independently governed by configurable project stages, so party completeness
-- must not force these legs to remain Draft.

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_bilateral_or_draft_placeholder_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_bilateral_or_draft_placeholder_check
  CHECK (
    seller_organisation_id IS DISTINCT FROM buyer_organisation_id
    AND num_nonnulls(seller_organisation_id, buyer_organisation_id) BETWEEN 1 AND 2
  ) NOT VALID;
