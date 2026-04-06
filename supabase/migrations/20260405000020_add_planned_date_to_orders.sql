-- Add planned date column to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS planned_date date;
