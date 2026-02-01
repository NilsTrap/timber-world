-- =============================================
-- Epic 10: Platform Foundation v2 - Seed Features Registry
-- Migration: 20260201000003_epic10_seed_features.sql
-- Story: 10.3 - Seed Features Registry
-- =============================================

-- =============================================
-- FEATURES REGISTRY
-- All platform features organized by category
-- =============================================

INSERT INTO features (code, name, description, category, sort_order) VALUES
  -- Dashboard
  ('dashboard.view', 'View Dashboard', 'View dashboard metrics and overview', 'Dashboard', 100),

  -- Inventory
  ('inventory.view', 'View Inventory', 'View inventory packages', 'Inventory', 200),
  ('inventory.create', 'Create Inventory', 'Create inventory entries', 'Inventory', 201),
  ('inventory.edit', 'Edit Inventory', 'Edit inventory packages', 'Inventory', 202),
  ('inventory.delete', 'Delete Inventory', 'Delete inventory packages', 'Inventory', 203),

  -- Production
  ('production.view', 'View Production', 'View production entries', 'Production', 300),
  ('production.create', 'Create Production', 'Create production entries', 'Production', 301),
  ('production.edit', 'Edit Production', 'Edit draft production entries', 'Production', 302),
  ('production.validate', 'Validate Production', 'Validate and commit production entries', 'Production', 303),
  ('production.delete', 'Delete Production', 'Delete production entries', 'Production', 304),
  ('production.corrections', 'Production Corrections', 'Create correction entries', 'Production', 305),

  -- Shipments
  ('shipments.view', 'View Shipments', 'View shipments', 'Shipments', 400),
  ('shipments.create', 'Create Shipments', 'Create shipments', 'Shipments', 401),
  ('shipments.edit', 'Edit Shipments', 'Edit draft shipments', 'Shipments', 402),
  ('shipments.delete', 'Delete Shipments', 'Delete shipments', 'Shipments', 403),
  ('shipments.submit', 'Submit Shipments', 'Submit shipments for acceptance', 'Shipments', 404),
  ('shipments.accept', 'Accept Shipments', 'Accept incoming shipments', 'Shipments', 405),
  ('shipments.reject', 'Reject Shipments', 'Reject incoming shipments', 'Shipments', 406),

  -- Reference Data
  ('reference.view', 'View Reference Data', 'View reference data options', 'Reference Data', 500),
  ('reference.manage', 'Manage Reference Data', 'Add, edit, delete reference data options', 'Reference Data', 501),

  -- Organizations
  ('organizations.view', 'View Organizations', 'View organizations list', 'Organizations', 600),
  ('organizations.create', 'Create Organizations', 'Create new organizations', 'Organizations', 601),
  ('organizations.edit', 'Edit Organizations', 'Edit organization details', 'Organizations', 602),
  ('organizations.delete', 'Delete Organizations', 'Delete organizations', 'Organizations', 603),

  -- Users
  ('users.view', 'View Users', 'View users in organization', 'Users', 700),
  ('users.invite', 'Invite Users', 'Invite new users to organization', 'Users', 701),
  ('users.edit', 'Edit Users', 'Edit user details', 'Users', 702),
  ('users.remove', 'Remove Users', 'Remove users from organization', 'Users', 703),
  ('users.credentials', 'Manage Credentials', 'Send and reset user credentials', 'Users', 704),

  -- Analytics
  ('analytics.view', 'View Analytics', 'View efficiency reports and analytics', 'Analytics', 800),
  ('analytics.export', 'Export Analytics', 'Export analytics data', 'Analytics', 801),

  -- Orders (future)
  ('orders.view', 'View Orders', 'View orders', 'Orders', 900),
  ('orders.create', 'Create Orders', 'Create new orders', 'Orders', 901),
  ('orders.edit', 'Edit Orders', 'Edit orders', 'Orders', 902),

  -- Deliveries (future)
  ('deliveries.view', 'View Deliveries', 'View deliveries', 'Deliveries', 1000),
  ('deliveries.create', 'Create Deliveries', 'Create delivery records', 'Deliveries', 1001),
  ('deliveries.edit', 'Edit Deliveries', 'Edit delivery records', 'Deliveries', 1002),

  -- Invoices (future)
  ('invoices.view', 'View Invoices', 'View invoices', 'Invoices', 1100),
  ('invoices.create', 'Create Invoices', 'Create invoices', 'Invoices', 1101),

  -- Tracking (future)
  ('tracking.view', 'View Tracking', 'View shipment tracking', 'Tracking', 1200),
  ('tracking.update', 'Update Tracking', 'Update tracking status', 'Tracking', 1201),

  -- Reorder (future)
  ('reorder.view', 'View Reorder', 'View reorder options', 'Reorder', 1300),
  ('reorder.create', 'Create Reorder', 'Create reorder requests', 'Reorder', 1301),

  -- Suppliers (future)
  ('suppliers.view', 'View Suppliers', 'View supplier list', 'Suppliers', 1400),

  -- Clients (future)
  ('clients.view', 'View Clients', 'View client list', 'Clients', 1500),

  -- Documents (future)
  ('documents.view', 'View Documents', 'View documents', 'Documents', 1600)

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order;
