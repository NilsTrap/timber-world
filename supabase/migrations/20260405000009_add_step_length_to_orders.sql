-- Add step_length column to orders
ALTER TABLE orders
  ADD COLUMN step_length TEXT;

NOTIFY pgrst, 'reload schema';
