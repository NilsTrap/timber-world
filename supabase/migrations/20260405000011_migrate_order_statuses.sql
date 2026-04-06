-- Migrate existing order statuses to new values
UPDATE orders SET status = 'confirmed' WHERE status IN ('pending', 'in_progress');
UPDATE orders SET status = 'loaded' WHERE status IN ('shipped', 'completed');

NOTIFY pgrst, 'reload schema';
