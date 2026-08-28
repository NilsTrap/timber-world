-- Leg references describe the current bilateral parties. Keep the stable numeric
-- suffix, but refresh both organisation prefixes whenever either party changes.
CREATE OR REPLACE FUNCTION public.refresh_project_leg_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_seller_code TEXT;
  v_buyer_code TEXT;
  v_suffix TEXT;
BEGIN
  IF NEW.seller_organisation_id IS NOT DISTINCT FROM OLD.seller_organisation_id
    AND NEW.buyer_organisation_id IS NOT DISTINCT FROM OLD.buyer_organisation_id
  THEN
    RETURN NEW;
  END IF;

  SELECT substr(regexp_replace(upper(coalesce(code, 'XXX')), '[^A-Z0-9]', '', 'g'), 1, 3)
    INTO v_seller_code FROM public.organisations WHERE id = NEW.seller_organisation_id;
  SELECT substr(regexp_replace(upper(coalesce(code, 'XXX')), '[^A-Z0-9]', '', 'g'), 1, 3)
    INTO v_buyer_code FROM public.organisations WHERE id = NEW.buyer_organisation_id;

  v_seller_code := coalesce(nullif(v_seller_code, ''), 'XXX');
  v_buyer_code := coalesce(nullif(v_buyer_code, ''), 'XXX');
  v_suffix := substring(coalesce(OLD.deal_code, '') from '([0-9]+)$');
  IF v_suffix IS NULL THEN
    v_suffix := lpad(public.next_counter('deal:' || v_seller_code || ':' || v_buyer_code)::text, 3, '0');
  END IF;

  NEW.deal_code := v_seller_code || '-' || v_buyer_code || '-' || v_suffix;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_project_leg_code ON public.orders;
CREATE TRIGGER trg_refresh_project_leg_code
BEFORE UPDATE OF buyer_organisation_id, seller_organisation_id
ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.refresh_project_leg_code();

-- Repair existing references without changing their stable numeric suffix.
WITH expected AS (
  SELECT
    o.id,
    coalesce(nullif(substr(regexp_replace(upper(coalesce(s.code, 'XXX')), '[^A-Z0-9]', '', 'g'), 1, 3), ''), 'XXX') AS seller_code,
    coalesce(nullif(substr(regexp_replace(upper(coalesce(b.code, 'XXX')), '[^A-Z0-9]', '', 'g'), 1, 3), ''), 'XXX') AS buyer_code,
    substring(coalesce(o.deal_code, '') from '([0-9]+)$') AS suffix
  FROM public.orders o
  LEFT JOIN public.organisations s ON s.id = o.seller_organisation_id
  LEFT JOIN public.organisations b ON b.id = o.buyer_organisation_id
  WHERE o.spine_id IS NOT NULL AND o.deal_code IS NOT NULL
)
UPDATE public.orders o
SET deal_code = e.seller_code || '-' || e.buyer_code || '-' || e.suffix
FROM expected e
WHERE o.id = e.id
  AND e.suffix IS NOT NULL
  AND o.deal_code IS DISTINCT FROM e.seller_code || '-' || e.buyer_code || '-' || e.suffix;

COMMENT ON FUNCTION public.refresh_project_leg_code() IS
  'Keeps bilateral leg references aligned with their current seller and buyer while preserving the numeric suffix.';

NOTIFY pgrst, 'reload schema';
