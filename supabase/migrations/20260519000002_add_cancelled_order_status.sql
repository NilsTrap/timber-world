-- Add 'cancelled' to the order_status enum so users can mark orders as
-- cancelled (separate from draft/confirmed/loaded). Editable from the
-- List and Sales tabs; read-only on the Production tab.
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'cancelled';
