-- N3 (Wave 2, docs stream): party order numbers as first-class labeled external
-- refs. Nils: "klientam un ražotājam ir savs order number, kuram jāparādās
-- darījumā obligāti — gan dokumentos, gan sarakstos."
--
-- Widen order_external_refs.ref_type to add the two canonical party-order-number
-- types plus a generic 'custom' type for free extra refs. Additive & idempotent.
ALTER TABLE public.order_external_refs DROP CONSTRAINT IF EXISTS order_external_refs_ref_type_check;
ALTER TABLE public.order_external_refs
  ADD CONSTRAINT order_external_refs_ref_type_check
  CHECK (ref_type IN (
    'client_project', 'client_job', 'client_po', 'other',
    'customer_order_no', 'supplier_order_no', 'custom'
  ));
