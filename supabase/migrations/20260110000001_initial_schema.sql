-- =============================================
-- Timber International Initial Schema
-- Migration: 20260110000001_initial_schema.sql
-- Description: Create core tables for products, quotes, and admin users
-- =============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUMS
-- =============================================

-- Quote type enum
CREATE TYPE quote_type AS ENUM ('stock', 'custom');

-- Quote status enum
CREATE TYPE quote_status AS ENUM (
  'pending',
  'acknowledged',
  'responded',
  'followed_up',
  'converted',
  'closed'
);

-- Stock status enum
CREATE TYPE stock_status AS ENUM (
  'in_stock',
  'low_stock',
  'out_of_stock'
);

-- Product type enum (finger-jointed vs full-stave)
CREATE TYPE product_type AS ENUM ('FJ', 'FS');

-- =============================================
-- PRODUCTS TABLE (AC: #3)
-- =============================================

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(50) UNIQUE NOT NULL,
  species VARCHAR(50) NOT NULL,
  width INTEGER NOT NULL CHECK (width > 0),
  length INTEGER NOT NULL CHECK (length > 0),
  thickness INTEGER NOT NULL CHECK (thickness > 0),
  quality_grade VARCHAR(20) NOT NULL,
  type product_type NOT NULL,
  moisture_content DECIMAL(4,1) NOT NULL CHECK (moisture_content >= 0 AND moisture_content <= 100),
  finish VARCHAR(50),
  fsc_certified BOOLEAN DEFAULT false,
  -- Prices stored in cents (EUR) for precision
  unit_price_m3 INTEGER NOT NULL CHECK (unit_price_m3 >= 0),
  unit_price_piece INTEGER NOT NULL CHECK (unit_price_piece >= 0),
  unit_price_m2 INTEGER NOT NULL CHECK (unit_price_m2 >= 0),
  stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
  stock_status stock_status DEFAULT 'out_of_stock',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_species ON products(species);
CREATE INDEX idx_products_stock_status ON products(stock_status);
CREATE INDEX idx_products_type ON products(type);
CREATE INDEX idx_products_quality_grade ON products(quality_grade);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- QUOTE REQUESTS TABLE (AC: #4)
-- =============================================

-- Function to generate reference number
CREATE OR REPLACE FUNCTION generate_quote_reference()
RETURNS VARCHAR(20) AS $$
DECLARE
  year_part VARCHAR(4);
  sequence_num INTEGER;
  ref_number VARCHAR(20);
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');

  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(reference_number FROM 4 FOR 6) AS INTEGER)
  ), 0) + 1
  INTO sequence_num
  FROM quote_requests
  WHERE reference_number LIKE 'QR-' || year_part || '-%';

  ref_number := 'QR-' || year_part || '-' || LPAD(sequence_num::TEXT, 6, '0');
  RETURN ref_number;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number VARCHAR(20) UNIQUE NOT NULL DEFAULT generate_quote_reference(),
  type quote_type NOT NULL,
  status quote_status DEFAULT 'pending',
  contact_name VARCHAR(100) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50),
  company_name VARCHAR(200),
  delivery_location VARCHAR(100),
  -- JSONB for flexible product list
  -- Structure: [{ product_id, sku, name, quantity, unit, specifications }]
  products JSONB,
  -- JSONB for custom specifications
  -- Structure: { dimensions, finish, cnc_requirements, notes }
  custom_specs JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_quotes_status ON quote_requests(status);
CREATE INDEX idx_quotes_email ON quote_requests(contact_email);
CREATE INDEX idx_quotes_reference ON quote_requests(reference_number);
CREATE INDEX idx_quotes_created ON quote_requests(created_at DESC);

-- Update trigger
CREATE TRIGGER update_quote_requests_updated_at
  BEFORE UPDATE ON quote_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ADMIN USERS TABLE (AC: #5)
-- =============================================

CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Foreign key to Supabase Auth users
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one admin record per auth user
  CONSTRAINT unique_admin_user_id UNIQUE (user_id)
);

-- Indexes
CREATE INDEX idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX idx_admin_users_email ON admin_users(email);

-- Update trigger
CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY (AC: #6)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- PRODUCTS RLS POLICIES
-- Public read access, admin write access
-- =============================================

-- Anyone can read products (public catalog)
CREATE POLICY "Products are viewable by everyone"
  ON products FOR SELECT
  USING (true);

-- Only admins can insert products
CREATE POLICY "Admins can insert products"
  ON products FOR INSERT
  WITH CHECK (is_admin());

-- Only admins can update products
CREATE POLICY "Admins can update products"
  ON products FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- Only admins can delete products
CREATE POLICY "Admins can delete products"
  ON products FOR DELETE
  USING (is_admin());

-- =============================================
-- QUOTE REQUESTS RLS POLICIES
-- Public insert (anyone can submit), admin full access
-- =============================================

-- Anyone can create a quote request
CREATE POLICY "Anyone can create quote requests"
  ON quote_requests FOR INSERT
  WITH CHECK (true);

-- Only admins can view quote requests
CREATE POLICY "Admins can view all quote requests"
  ON quote_requests FOR SELECT
  USING (is_admin());

-- Only admins can update quote requests
CREATE POLICY "Admins can update quote requests"
  ON quote_requests FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- Only admins can delete quote requests
CREATE POLICY "Admins can delete quote requests"
  ON quote_requests FOR DELETE
  USING (is_admin());

-- =============================================
-- ADMIN USERS RLS POLICIES
-- Admin only access
-- =============================================

-- Only admins can view admin users
CREATE POLICY "Admins can view admin users"
  ON admin_users FOR SELECT
  USING (is_admin());

-- Only admins can insert admin users
CREATE POLICY "Admins can insert admin users"
  ON admin_users FOR INSERT
  WITH CHECK (is_admin());

-- Only admins can update admin users
CREATE POLICY "Admins can update admin users"
  ON admin_users FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- Only admins can delete admin users
CREATE POLICY "Admins can delete admin users"
  ON admin_users FOR DELETE
  USING (is_admin());

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE products IS 'Product catalog for timber products';
COMMENT ON TABLE quote_requests IS 'Customer quote requests for stock or custom orders';
COMMENT ON TABLE admin_users IS 'Admin users linked to Supabase Auth';
COMMENT ON FUNCTION is_admin() IS 'Helper function to check if current user is an admin';
COMMENT ON FUNCTION generate_quote_reference() IS 'Generates unique reference numbers like QR-2026-000001';
