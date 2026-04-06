-- Add order tab sub-modules to features registry
INSERT INTO features (code, name, description, category, sort_order) VALUES
  ('orders.tab.list', 'Orders - List Tab', 'Access to the orders list tab', 'orders', 501),
  ('orders.tab.prices', 'Orders - Prices Tab', 'Access to the orders prices tab', 'orders', 502),
  ('orders.tab.sales', 'Orders - Sales Tab', 'Access to the orders sales tab', 'orders', 503),
  ('orders.tab.production', 'Orders - Production Tab', 'Access to the orders production tab', 'orders', 504),
  ('orders.tab.analytics', 'Orders - Analytics Tab', 'Access to the orders analytics tab', 'orders', 505)
ON CONFLICT (code) DO NOTHING;
