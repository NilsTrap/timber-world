-- ============================================================================
-- R3 (3rqucq) · Payment terms as an admin-managed global field (Settings → Fields)
--
-- Seeds a `catalog_fields` "select" field `payment_terms` + a starter set of
-- options. The deal-terms editor reads these for its Payment terms dropdown (via
-- catalog getOptions), replacing the old free-text input. An admin can add/remove
-- terms forever after in Settings → Fields with zero deploy.
--
-- The deal DERIVES advance_pct from the chosen payment term server-side
-- (parseAdvanceFromPaymentTerm) — the % is encoded in / recoverable from the
-- option value, so `100% advance`→100, `50% advance / 50% before dispatch`→50,
-- `Payment after delivery`→0, `30% advance / balance before dispatch`→30,
-- `Prepayment 14 days`→100. value = label (readable on generated documents, which
-- render orders.payment_terms directly).
--
-- Idempotent (ON CONFLICT DO NOTHING) so it is safe to re-run on staging/prod.
-- catalog_fields/catalog_field_options RLS: authenticated read, admin write — so
-- a non-admin deal-terms editor can still READ the options.
-- ============================================================================

INSERT INTO public.catalog_fields (id, field_key, field_label, field_type, unit, ref_table)
VALUES ('f0000001-0014-0000-0000-000000000001', 'payment_terms', 'Payment terms', 'select', NULL, NULL)
ON CONFLICT (field_key) DO NOTHING;

INSERT INTO public.catalog_field_options (field_id, value, label, sort_order)
SELECT f.id, v.val, v.val, v.ord
FROM public.catalog_fields f
CROSS JOIN (VALUES
  ('100% advance', 1),
  ('50% advance / 50% before dispatch', 2),
  ('Payment after delivery', 3),
  ('30% advance / balance before dispatch', 4),
  ('Prepayment 14 days', 5)
) AS v(val, ord)
WHERE f.field_key = 'payment_terms'
ON CONFLICT (field_id, value) DO NOTHING;
