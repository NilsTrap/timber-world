-- =============================================
-- Add order_id to inventory_packages
-- Migration: 20260404150001_add_order_id_to_inventory_packages.sql
-- Description: Link inventory packages to orders, drop separate order items tables
-- =============================================

-- 1. Drop the order_items and order_staircases tables (no longer needed)
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS order_staircases;

-- 2. Add order_id column to inventory_packages
ALTER TABLE inventory_packages
  ADD COLUMN order_id UUID REFERENCES orders(id);

CREATE INDEX idx_inventory_packages_order ON inventory_packages(order_id)
  WHERE order_id IS NOT NULL;

-- 3. Reload PostgREST cache
NOTIFY pgrst, 'reload schema';
