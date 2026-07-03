-- D1 (§8.2) · Quotation → Order specification: ONE document in two states.
--
-- `doc_state` is ORTHOGONAL to `order_documents.status` (draft|issued) and is only
-- meaningful for the `sales_spec` doc type: it starts as 'quotation' (non-binding)
-- and becomes 'firm' (the accepted order specification) via a regenerate-in-place
-- that keeps the SAME row + SAME doc_number and swaps the stored PDF. NULL = a
-- plain/legacy spec with no quotation lifecycle. Additive + idempotent.

ALTER TABLE public.order_documents
  ADD COLUMN IF NOT EXISTS doc_state TEXT
    CHECK (doc_state IS NULL OR doc_state IN ('quotation', 'firm'));

ALTER TABLE public.order_documents
  ADD COLUMN IF NOT EXISTS firmed_at TIMESTAMPTZ;

ALTER TABLE public.order_documents
  ADD COLUMN IF NOT EXISTS firmed_by UUID REFERENCES public.portal_users(id);
