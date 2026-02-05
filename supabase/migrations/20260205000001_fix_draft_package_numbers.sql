-- Fix incorrectly auto-generated package numbers in draft production entries.
-- A bug in the LIKE pattern caused getNextPackageNumbers to return no results,
-- making all draft outputs start numbering from 0001 regardless of existing
-- inventory packages.
--
-- This migration re-assigns correct sequential package numbers to all draft
-- outputs, starting from the actual next available number per org+process.

DO $$
DECLARE
  v_entry RECORD;
  v_output RECORD;
  v_next_num INTEGER;
  v_max_num INTEGER;
  v_effective_code TEXT;
  v_org_id UUID;
BEGIN
  -- Process each draft entry, ordered by creation time so earlier drafts
  -- get lower numbers when multiple drafts exist for the same org+process.
  FOR v_entry IN
    SELECT
      pe.id AS entry_id,
      pe.organisation_id,
      rp.code AS process_code,
      lower(rp.value) AS process_name
    FROM portal_production_entries pe
    JOIN ref_processes rp ON pe.process_id = rp.id
    WHERE pe.status = 'draft'
    ORDER BY pe.created_at ASC
  LOOP
    v_org_id := v_entry.organisation_id;
    v_effective_code := v_entry.process_code;

    -- For Sorting process, inherit process code from the first input package
    IF v_entry.process_name = 'sorting' THEN
      SELECT (regexp_match(ip.package_number, '^N-([A-Z]+)-\d+$'))[1]
      INTO v_effective_code
      FROM portal_production_inputs pi
      JOIN inventory_packages ip ON pi.package_id = ip.id
      WHERE pi.production_entry_id = v_entry.entry_id
        AND ip.package_number ~ '^N-[A-Z]+-\d+$'
      LIMIT 1;

      IF v_effective_code IS NULL THEN
        v_effective_code := v_entry.process_code;
      END IF;
    END IF;

    -- Skip entries with no outputs that have package numbers
    IF NOT EXISTS (
      SELECT 1 FROM portal_production_outputs
      WHERE production_entry_id = v_entry.entry_id
        AND package_number ~ '^N-[A-Z]+-\d+$'
    ) THEN
      CONTINUE;
    END IF;

    -- Find max existing number from both inventory and other entries' outputs.
    -- Other entries that were processed earlier in this loop will have their
    -- updated numbers visible here (same transaction).
    SELECT COALESCE(MAX(
      CAST((regexp_match(pn, '^N-' || v_effective_code || '-(\d+)$'))[1] AS INTEGER)
    ), 0) INTO v_max_num
    FROM (
      SELECT package_number AS pn FROM inventory_packages
      WHERE organisation_id = v_org_id
        AND package_number ~ ('^N-' || v_effective_code || '-\d+$')
      UNION ALL
      SELECT po.package_number AS pn
      FROM portal_production_outputs po
      JOIN portal_production_entries pe ON po.production_entry_id = pe.id
      WHERE pe.organisation_id = v_org_id
        AND po.production_entry_id != v_entry.entry_id
        AND po.package_number ~ ('^N-' || v_effective_code || '-\d+$')
    ) combined;

    v_next_num := v_max_num + 1;

    -- Renumber outputs for this entry sequentially
    FOR v_output IN
      SELECT id FROM portal_production_outputs
      WHERE production_entry_id = v_entry.entry_id
        AND package_number ~ '^N-[A-Z]+-\d+$'
      ORDER BY sort_order ASC, id ASC
    LOOP
      UPDATE portal_production_outputs
      SET package_number = 'N-' || v_effective_code || '-' || LPAD(v_next_num::TEXT, 4, '0')
      WHERE id = v_output.id;

      v_next_num := v_next_num + 1;
    END LOOP;

    RAISE NOTICE 'Fixed entry %: reassigned outputs starting from N-%-% (% outputs)',
      v_entry.entry_id, v_effective_code, LPAD((v_max_num + 1)::TEXT, 4, '0'),
      v_next_num - v_max_num - 1;
  END LOOP;
END $$;
