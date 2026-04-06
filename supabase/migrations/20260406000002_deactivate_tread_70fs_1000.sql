-- Deactivate Tread 70FS 1000 — no longer in UK staircase pricing
UPDATE uk_staircase_pricing
SET is_active = false
WHERE code LIKE '%70FS%' AND length_mm = 1000;
