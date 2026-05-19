-- Add the orders.tab.production.edit module to the modules registry.
-- Grants the right to edit production-tab fields (date loaded, planned date,
-- tread/winder/quarter m³, used material, production material/finishing/total +
-- invoice/payment, wood art / wood art CNC + invoice/payment) WITHOUT also
-- granting orders.create. Used to let finishing-workshop orgs (e.g. Wood ART)
-- record their production numbers and payment info on orders they participate
-- in, without exposing the rest of the order edit surface (pricing, customer
-- info, etc.).
INSERT INTO modules (code, name, description, category, sort_order) VALUES
  (
    'orders.tab.production.edit',
    'Orders - Production Tab Edit',
    'Edit production-only fields on the orders production tab (production m³, costs, invoice/payment dates). Does not grant access to pricing or customer info.',
    'orders',
    506
  )
ON CONFLICT (code) DO NOTHING;
