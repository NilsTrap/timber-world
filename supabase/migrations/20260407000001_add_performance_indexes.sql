-- Performance optimization: compound indexes for the most common query patterns
-- These are additive-only (no schema changes, no drops)

-- getSession() queries portal_users by auth_user_id
-- Existing idx_portal_users_auth_id is a regular index; ensure it exists
CREATE INDEX IF NOT EXISTS idx_portal_users_auth_user_id
  ON portal_users(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- getSession() queries organization_memberships by (user_id, is_active)
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_active
  ON organization_memberships(user_id, is_active)
  WHERE is_active = true;

-- getUserEnabledModules() queries organization_modules by (organization_id, enabled)
CREATE INDEX IF NOT EXISTS idx_org_modules_org_enabled
  ON organization_modules(organization_id)
  WHERE enabled = true;

-- getUserEnabledModules() queries user_modules by (user_id, organization_id, enabled)
CREATE INDEX IF NOT EXISTS idx_user_modules_user_org_enabled
  ON user_modules(user_id, organization_id)
  WHERE enabled = true;

-- Shipment queries filter by (from_organisation_id, status) and (to_organisation_id, status)
CREATE INDEX IF NOT EXISTS idx_shipments_from_org_status
  ON shipments(from_organisation_id, status);

CREATE INDEX IF NOT EXISTS idx_shipments_to_org_status
  ON shipments(to_organisation_id, status);

-- Inventory package queries filter by shipment_id + status
CREATE INDEX IF NOT EXISTS idx_inventory_packages_shipment_status
  ON inventory_packages(shipment_id, status)
  WHERE shipment_id IS NOT NULL;

-- Inventory package queries filter by production_entry_id + status
CREATE INDEX IF NOT EXISTS idx_inventory_packages_production_status
  ON inventory_packages(production_entry_id, status)
  WHERE production_entry_id IS NOT NULL;

-- Inventory package queries filter by source_shipment_id
CREATE INDEX IF NOT EXISTS idx_inventory_packages_source_shipment
  ON inventory_packages(source_shipment_id)
  WHERE source_shipment_id IS NOT NULL;

-- Orders queries filter by seller/producer/customer org
CREATE INDEX IF NOT EXISTS idx_orders_customer_org
  ON orders(customer_organisation_id)
  WHERE customer_organisation_id IS NOT NULL;

-- Production entries filter by organisation_id + status
CREATE INDEX IF NOT EXISTS idx_production_entries_org_status
  ON portal_production_entries(organisation_id, status);

-- Production inputs filter by production_entry_id
CREATE INDEX IF NOT EXISTS idx_production_inputs_entry
  ON portal_production_inputs(production_entry_id);

-- Production outputs filter by production_entry_id
CREATE INDEX IF NOT EXISTS idx_production_outputs_entry
  ON portal_production_outputs(production_entry_id);
