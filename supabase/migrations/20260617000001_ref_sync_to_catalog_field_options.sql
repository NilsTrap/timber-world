-- E1.3 (safe forward-sync) — kill ref_* ↔ catalog_field_options drift WITHOUT
-- dropping the ref_* tables. The literal "ref_* → views" inversion is impossible:
-- inventory_packages + portal_production_outputs hold 14 FKs onto ref_*.id, and
-- Postgres can't FK to a view. So instead we keep ref_* as the writable source
-- (ReferenceDataManager + all FKs unchanged) and forward-sync every change into
-- catalog_field_options, which the attribute service reads as the unified vocab.
--
-- Scope: the 6 catalog reference tables that map to a catalog_field via
-- catalog_fields.ref_table (wood_species/quality/humidity/processing/types/fsc).
-- EXCLUDED: ref_processes (a production table, not a catalog attribute) and
-- ref_product_names (no catalog_field maps to it yet).
--
-- catalog_field_options has no FK to ref_*, so DELETE ordering is safe. The
-- function is SECURITY DEFINER so it can write catalog_field_options regardless
-- of the caller's RLS. Matching: an option is the synced image of a ref row when
-- (field_id, ref_value_id = ref.id); the table's UNIQUE (field_id, value) is the
-- upsert conflict target.

CREATE OR REPLACE FUNCTION public.sync_ref_to_catalog_field_options()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fid uuid;
BEGIN
  -- A ref table can back more than one catalog field; sync to each.
  FOR fid IN SELECT id FROM public.catalog_fields WHERE ref_table = TG_TABLE_NAME LOOP
    IF TG_OP = 'DELETE' THEN
      DELETE FROM public.catalog_field_options
        WHERE field_id = fid AND ref_value_id = OLD.id;
    ELSIF TG_OP = 'UPDATE' THEN
      UPDATE public.catalog_field_options
        SET value = NEW.value, label = NEW.value,
            sort_order = COALESCE(NEW.sort_order, 0), is_active = COALESCE(NEW.is_active, true),
            updated_at = now()
        WHERE field_id = fid AND ref_value_id = OLD.id;
      IF NOT FOUND THEN
        INSERT INTO public.catalog_field_options (field_id, ref_value_id, value, label, sort_order, is_active)
        VALUES (fid, NEW.id, NEW.value, NEW.value, COALESCE(NEW.sort_order, 0), COALESCE(NEW.is_active, true))
        ON CONFLICT (field_id, value) DO UPDATE
          SET ref_value_id = EXCLUDED.ref_value_id, label = EXCLUDED.label,
              sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active, updated_at = now();
      END IF;
    ELSE -- INSERT
      INSERT INTO public.catalog_field_options (field_id, ref_value_id, value, label, sort_order, is_active)
      VALUES (fid, NEW.id, NEW.value, NEW.value, COALESCE(NEW.sort_order, 0), COALESCE(NEW.is_active, true))
      ON CONFLICT (field_id, value) DO UPDATE
        SET ref_value_id = EXCLUDED.ref_value_id, label = EXCLUDED.label,
            sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active, updated_at = now();
    END IF;
  END LOOP;
  RETURN NULL; -- AFTER trigger
END;
$$;

-- Attach the trigger to each catalog reference table (idempotent).
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['ref_wood_species','ref_quality','ref_humidity','ref_processing','ref_types','ref_fsc'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_sync_%1$s_to_options ON public.%1$I', tbl);
    EXECUTE format('CREATE TRIGGER trg_sync_%1$s_to_options AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.sync_ref_to_catalog_field_options()', tbl);
  END LOOP;
END $$;

-- One-time backfill: converge existing rows (every current ref row → an option),
-- using the live catalog_fields.ref_table mapping so it's robust to which fields exist.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id AS field_id, ref_table
    FROM public.catalog_fields
    WHERE ref_table IN ('ref_wood_species','ref_quality','ref_humidity','ref_processing','ref_types','ref_fsc')
  LOOP
    EXECUTE format(
      'INSERT INTO public.catalog_field_options (field_id, ref_value_id, value, label, sort_order, is_active)
       SELECT %L, t.id, t.value, t.value, COALESCE(t.sort_order,0), COALESCE(t.is_active,true)
       FROM public.%I t
       ON CONFLICT (field_id, value) DO UPDATE
         SET ref_value_id = EXCLUDED.ref_value_id, label = EXCLUDED.label,
             sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active, updated_at = now()',
      r.field_id, r.ref_table);
  END LOOP;
END $$;
