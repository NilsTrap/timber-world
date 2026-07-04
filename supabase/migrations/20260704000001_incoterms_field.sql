-- ============================================================================
-- H2 · Incoterms as an admin-managed global field (Settings → Fields)
--
-- Seeds a `catalog_fields` "select" field `incoterms` + the 11 Incoterms 2020
-- codes as options. The deal-terms editor reads these options for its Incoterms
-- dropdown (via catalog getOptions), and an admin can add/remove codes forever
-- after in Settings → Fields with zero deploy — no new admin UI needed.
--
-- Idempotent (ON CONFLICT DO NOTHING) so it is safe to re-run on staging/prod.
-- catalog_fields/catalog_field_options RLS: authenticated read, admin write —
-- so a non-admin deal-terms editor can still READ the options.
-- ============================================================================

INSERT INTO public.catalog_fields (id, field_key, field_label, field_type, unit, ref_table)
VALUES ('f0000001-0013-0000-0000-000000000001', 'incoterms', 'Incoterms', 'select', NULL, NULL)
ON CONFLICT (field_key) DO NOTHING;

-- The 11 Incoterms 2020 rules, in the canonical order. value = label = the code
-- (stored on the deal as free text; deleting a code never breaks a stored value).
INSERT INTO public.catalog_field_options (field_id, value, label, sort_order)
SELECT f.id, v.code, v.code, v.ord
FROM public.catalog_fields f
CROSS JOIN (VALUES
  ('EXW', 1),
  ('FCA', 2),
  ('CPT', 3),
  ('CIP', 4),
  ('DAP', 5),
  ('DPU', 6),
  ('DDP', 7),
  ('FAS', 8),
  ('FOB', 9),
  ('CFR', 10),
  ('CIF', 11)
) AS v(code, ord)
WHERE f.field_key = 'incoterms'
ON CONFLICT (field_id, value) DO NOTHING;
