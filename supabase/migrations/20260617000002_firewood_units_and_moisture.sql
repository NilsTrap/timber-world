-- E5 follow-up (from the live Oscar AI-intake testing): the firewood trade needs
-- two controlled-vocab values the AI kept flagging.
--
-- 1. Line-item units: add 'crate' and 'loose_m3' (bulk firewood) to the
--    order_line_items.unit CHECK. The inline column CHECK is auto-named
--    public.order_line_items_unit_check; drop + re-add with the wider set.
-- 2. Moisture: add a firewood-friendly "KD <20%" option to ref_humidity. The
--    E1.3 forward-sync trigger propagates it into catalog_field_options for the
--    `humidity` attribute automatically. Idempotent (skip if the value exists).

ALTER TABLE public.order_line_items DROP CONSTRAINT IF EXISTS order_line_items_unit_check;
ALTER TABLE public.order_line_items
  ADD CONSTRAINT order_line_items_unit_check
  CHECK (unit IN ('m3','m2','piece','linear_m','package','crate','loose_m3'));

INSERT INTO public.ref_humidity (value, sort_order, is_active)
SELECT 'KD <20%', 100, true
WHERE NOT EXISTS (SELECT 1 FROM public.ref_humidity WHERE value = 'KD <20%');
