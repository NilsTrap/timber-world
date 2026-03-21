-- =============================================
-- Sync features registry with actual portal pages
-- Remove placeholder features for non-existent pages
-- Add features for pages that exist
-- =============================================

-- Remove features for pages/functionality that don't exist
DELETE FROM features WHERE code IN (
  'clients.view',
  'deliveries.view',
  'deliveries.create',
  'deliveries.edit',
  'documents.view',
  'invoices.view',
  'invoices.create',
  'reorder.view',
  'reorder.create',
  'suppliers.view',
  'tracking.view',
  'tracking.update',
  'analytics.view',
  'analytics.export',
  'products.view'
);

-- Add features for pages that exist but had no feature
INSERT INTO features (code, name, description, category, sort_order) VALUES
  -- CRM (admin)
  ('crm.view', 'View CRM', 'View CRM companies and contacts', 'CRM', 1000),
  ('crm.edit', 'Edit CRM', 'Edit CRM companies, contacts, and tags', 'CRM', 1001),

  -- Marketing / CMS (admin)
  ('marketing.view', 'View Marketing', 'View marketing and CMS dashboard', 'Marketing', 1100),

  -- Quotes (admin)
  ('quotes.view', 'View Quotes', 'View quote requests', 'Quotes', 1200),
  ('quotes.create', 'Create Quotes', 'Create new quotes', 'Quotes', 1201),
  ('quotes.edit', 'Edit Quotes', 'Edit quotes', 'Quotes', 1202),

  -- Roles (admin)
  ('roles.view', 'View Roles', 'View role definitions', 'Roles', 750),
  ('roles.manage', 'Manage Roles', 'Create and edit roles', 'Roles', 751)

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order;
