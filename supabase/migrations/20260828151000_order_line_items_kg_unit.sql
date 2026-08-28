-- Metal catalogue specifications use kilograms as a first-class quantity unit.
ALTER TABLE public.order_line_items
  DROP CONSTRAINT IF EXISTS order_line_items_unit_check;

ALTER TABLE public.order_line_items
  ADD CONSTRAINT order_line_items_unit_check
  CHECK (unit IN ('kg', 'm3', 'm2', 'piece', 'linear_m', 'package', 'crate', 'loose_m3'));
