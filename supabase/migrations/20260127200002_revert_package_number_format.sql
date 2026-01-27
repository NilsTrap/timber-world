-- Revert package number format back to: N-{code}-{0001}

CREATE OR REPLACE FUNCTION generate_production_package_number(
  p_organisation_id UUID,
  p_process_code TEXT
) RETURNS TEXT AS $$
DECLARE
  v_next_number INTEGER;
  v_counter_exists BOOLEAN;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT EXISTS(
    SELECT 1 FROM production_package_counters
    WHERE organisation_id = p_organisation_id AND process_code = p_process_code
    FOR UPDATE
  ) INTO v_counter_exists;

  IF v_counter_exists THEN
    -- Increment and get next number (wrap from 9999 to 1)
    UPDATE production_package_counters
    SET last_number = CASE
      WHEN last_number >= 9999 THEN 1
      ELSE last_number + 1
    END,
    updated_at = NOW()
    WHERE organisation_id = p_organisation_id AND process_code = p_process_code
    RETURNING last_number INTO v_next_number;
  ELSE
    -- Create new counter starting at 1
    INSERT INTO production_package_counters (organisation_id, process_code, last_number)
    VALUES (p_organisation_id, p_process_code, 1)
    RETURNING last_number INTO v_next_number;
  END IF;

  -- Return formatted package number: N-{code}-{0001}
  RETURN 'N-' || p_process_code || '-' || LPAD(v_next_number::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
