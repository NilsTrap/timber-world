-- Allow orders to be created without a customer (organisation_id nullable)
ALTER TABLE orders ALTER COLUMN organisation_id DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
