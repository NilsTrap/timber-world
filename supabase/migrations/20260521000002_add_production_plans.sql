-- Production Plans
--
-- A "plan" is a purely informational grouping of inventory packages used for
-- planning what to produce next. Plans don't lock or move packages — the same
-- package can appear on multiple plans, in active production drafts, and in
-- outgoing shipments simultaneously. Plans belong to a single organisation.

CREATE TABLE production_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_production_plans_org_created ON production_plans(organisation_id, created_at DESC);

-- Bump updated_at on row update.
CREATE TRIGGER production_plans_updated_at
  BEFORE UPDATE ON production_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Junction: plan ↔ package. PK = (plan_id, inventory_package_id) so the same
-- package can't be added to the same plan twice, but can still appear across
-- multiple plans. ON DELETE CASCADE means deleting a plan or removing the
-- underlying package cleans up the junction row automatically.
CREATE TABLE production_plan_packages (
  plan_id UUID NOT NULL REFERENCES production_plans(id) ON DELETE CASCADE,
  inventory_package_id UUID NOT NULL REFERENCES inventory_packages(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, inventory_package_id)
);

CREATE INDEX idx_production_plan_packages_pkg ON production_plan_packages(inventory_package_id);

-- RLS: leave open to authenticated. Multi-tenant isolation is enforced in
-- server actions (filter by session.organisationId), matching the rest of the
-- production feature's pattern (no PostgreSQL-level org isolation today).
ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access to production_plans"
  ON production_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE production_plan_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access to production_plan_packages"
  ON production_plan_packages FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
