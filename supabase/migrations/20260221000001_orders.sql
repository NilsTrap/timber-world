-- =============================================
-- Orders Management
-- Migration: 20260221000001_orders.sql
-- Description: Orders table with customer organisation links and shipment associations
-- =============================================

-- =============================================
-- 1. ORDER STATUS TYPE
-- =============================================

CREATE TYPE order_status AS ENUM (
  'draft',
  'pending',
  'confirmed',
  'in_progress',
  'shipped',
  'completed'
);

-- =============================================
-- 2. ORDERS TABLE
-- =============================================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  volume_m3 DECIMAL(12, 4),
  value_cents INTEGER,
  currency TEXT DEFAULT 'EUR' CHECK (currency IN ('EUR', 'GBP', 'USD')),
  status order_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID REFERENCES portal_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_orders_code ON orders(code);
CREATE INDEX idx_orders_organisation ON orders(organisation_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_date ON orders(order_date DESC);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Sequence for order numbering
CREATE SEQUENCE order_number_seq START 1;

-- =============================================
-- 3. ORDER-SHIPMENT LINK TABLE
-- =============================================

CREATE TABLE order_shipments (
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (order_id, shipment_id)
);

CREATE INDEX idx_order_shipments_order ON order_shipments(order_id);
CREATE INDEX idx_order_shipments_shipment ON order_shipments(shipment_id);

-- =============================================
-- 4. UPDATED_AT TRIGGER
-- =============================================

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
