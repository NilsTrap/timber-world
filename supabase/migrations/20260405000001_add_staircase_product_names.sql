-- Add staircase-related product names and exclude them from all organisations
-- except "The Wood and Good SIA" (c1bed4cb-4cfb-4827-84e0-432929fb59b2).

-- 1. Insert new product names (sort_order continues from 4)
INSERT INTO ref_product_names (value, sort_order) VALUES
  ('Step', 5),
  ('Winder', 6),
  ('Quarter', 7);

-- 2. Exclude these three values from every organisation except The Wood and Good SIA
INSERT INTO organisation_ref_exclusions (organisation_id, ref_table, ref_value_id)
SELECT o.id, 'ref_product_names', rpn.id
FROM organisations o
CROSS JOIN ref_product_names rpn
WHERE rpn.value IN ('Step', 'Winder', 'Quarter')
  AND o.id != 'c1bed4cb-4cfb-4827-84e0-432929fb59b2';
