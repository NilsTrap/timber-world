-- Add tab column to activity log so entries are scoped to specific views
ALTER TABLE order_activity_log ADD COLUMN tab TEXT NOT NULL DEFAULT 'list';
