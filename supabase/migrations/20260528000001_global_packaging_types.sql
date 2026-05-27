-- ============================================================================
-- Restructure packaging: global types + variant assignments
-- Replaces per-variant catalog_variant_packages with reusable packaging types.
-- ============================================================================

-- Drop old per-variant table
DROP TABLE IF EXISTS public.catalog_variant_packages CASCADE;

-- Global packaging type registry
CREATE TABLE public.catalog_packaging_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  pieces_per_package INTEGER NOT NULL CHECK (pieces_per_package > 0),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalog_packaging_types_active
  ON public.catalog_packaging_types (is_active, sort_order);

-- Link table: assign packaging types to variants
CREATE TABLE public.catalog_variant_packaging_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES public.catalog_variants(id) ON DELETE CASCADE,
  packaging_type_id UUID NOT NULL REFERENCES public.catalog_packaging_types(id) ON DELETE CASCADE,
  price_override_cents INTEGER,
  is_default BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (variant_id, packaging_type_id)
);

CREATE INDEX idx_catalog_vpa_variant
  ON public.catalog_variant_packaging_assignments (variant_id);

-- RLS
ALTER TABLE public.catalog_packaging_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_packaging_types_select ON public.catalog_packaging_types FOR SELECT TO authenticated USING (true);
CREATE POLICY catalog_packaging_types_anon_read ON public.catalog_packaging_types FOR SELECT TO anon USING (true);
CREATE POLICY catalog_packaging_types_admin_write ON public.catalog_packaging_types FOR ALL TO authenticated
  USING (public.is_current_user_platform_admin()) WITH CHECK (public.is_current_user_platform_admin());

ALTER TABLE public.catalog_variant_packaging_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_vpa_select ON public.catalog_variant_packaging_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY catalog_vpa_anon_read ON public.catalog_variant_packaging_assignments FOR SELECT TO anon USING (true);
CREATE POLICY catalog_vpa_admin_write ON public.catalog_variant_packaging_assignments FOR ALL TO authenticated
  USING (public.is_current_user_platform_admin()) WITH CHECK (public.is_current_user_platform_admin());

-- Triggers
CREATE TRIGGER catalog_packaging_types_updated_at
  BEFORE UPDATE ON public.catalog_packaging_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed common packaging types
INSERT INTO public.catalog_packaging_types (name, pieces_per_package, description, sort_order) VALUES
  ('Standard Pallet', 10, 'Standard pallet with 10 pieces', 1),
  ('Half Pallet', 5, 'Half pallet with 5 pieces', 2),
  ('Large Pallet', 20, 'Large pallet with 20 pieces', 3),
  ('Small Bundle', 3, 'Small bundle of 3 pieces', 4),
  ('Single Piece', 1, 'Individual piece, no bundling', 5);

-- ============================================================================
-- Agent users table for the agent-facing app
-- ============================================================================

CREATE TABLE public.agent_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  region TEXT,
  commission_tier TEXT DEFAULT 'standard',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_users_auth ON public.agent_users (auth_user_id);
CREATE INDEX idx_agent_users_active ON public.agent_users (is_active);

ALTER TABLE public.agent_users ENABLE ROW LEVEL SECURITY;

-- Agents can read their own profile
CREATE POLICY agent_users_self_read ON public.agent_users
  FOR SELECT TO authenticated
  USING (auth.uid() = auth_user_id OR public.is_current_user_platform_admin());

-- Agents can update their own profile
CREATE POLICY agent_users_self_update ON public.agent_users
  FOR UPDATE TO authenticated
  USING (auth.uid() = auth_user_id OR public.is_current_user_platform_admin())
  WITH CHECK (auth.uid() = auth_user_id OR public.is_current_user_platform_admin());

-- Platform admin can do everything
CREATE POLICY agent_users_admin_write ON public.agent_users
  FOR ALL TO authenticated
  USING (public.is_current_user_platform_admin())
  WITH CHECK (public.is_current_user_platform_admin());

-- Trigger
CREATE TRIGGER agent_users_updated_at
  BEFORE UPDATE ON public.agent_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
