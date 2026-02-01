# Story 6.1: Database Schema for Multi-Tenancy

Status: done

## Story

As a developer,
I want the database schema updated with organisation_id columns,
So that all data can be properly scoped to organizations.

## Acceptance Criteria

### AC1: Organisations Table Migration
**Given** the existing `parties` table
**When** the migration is applied
**Then** the `parties` table is renamed to `organisations`
**And** existing data (TWP, INE) is preserved
**And** all foreign key references are updated

### AC2: Portal Users Organisation Link
**Given** the existing `portal_users` table with `party_id` column
**When** the migration is applied
**Then** the `party_id` column is renamed to `organisation_id`
**And** the existing Super Admin user has `organisation_id = NULL` (platform-level access)
**And** existing producer users retain their organisation links

### AC3: Inventory Packages Organisation Scope
**Given** the existing `inventory_packages` table
**When** the migration is applied
**Then** an `organisation_id` column is added (FK to organisations)
**And** existing packages are assigned to the TWP organisation
**And** the column is NOT NULL (all packages must belong to an organisation)

### AC4: Production Entries Organisation Scope
**Given** the existing `portal_production_entries` table
**When** the migration is applied
**Then** an `organisation_id` column is added (FK to organisations)
**And** existing entries are assigned to the TWP organisation
**And** the column is NOT NULL (all production entries must belong to an organisation)

### AC5: Shipments Table Update
**Given** the existing `shipments` table with `from_party_id` and `to_party_id`
**When** the migration is applied
**Then** the columns are renamed to `from_organisation_id` and `to_organisation_id`
**And** the foreign key references are updated to reference `organisations`
**And** existing shipment data is preserved

### AC6: Helper Functions Update
**Given** the existing `generate_shipment_code` and `generate_package_number` functions
**When** the migration is applied
**Then** functions are updated to use `organisations` table instead of `parties`
**And** existing functionality is preserved

## Tasks / Subtasks

- [x] Task 1: Create migration file for organisations table (AC: 1)
  - [x] Rename `parties` table to `organisations`
  - [x] Add `updated_at` trigger if not exists
  - [x] Update table comment

- [x] Task 2: Update portal_users table (AC: 2)
  - [x] Rename `party_id` column to `organisation_id`
  - [x] Update column comment
  - [x] Verify existing admin user has NULL organisation_id

- [x] Task 3: Add organisation_id to inventory_packages (AC: 3)
  - [x] Add `organisation_id` column (nullable initially)
  - [x] Populate existing packages with TWP organisation ID
  - [x] Alter column to NOT NULL
  - [x] Add foreign key constraint
  - [x] Add index on `organisation_id`

- [x] Task 4: Add organisation_id to portal_production_entries (AC: 4)
  - [x] Add `organisation_id` column (nullable initially)
  - [x] Populate existing entries with TWP organisation ID
  - [x] Alter column to NOT NULL
  - [x] Add foreign key constraint
  - [x] Add index on `organisation_id`

- [x] Task 5: Update shipments table references (AC: 5)
  - [x] Rename `from_party_id` to `from_organisation_id`
  - [x] Rename `to_party_id` to `to_organisation_id`
  - [x] Update foreign key references
  - [x] Update index names

- [x] Task 6: Update helper functions (AC: 6)
  - [x] Update `generate_shipment_code` to use organisations table
  - [x] Update `create_shipment_with_packages` function to use new column names
  - [x] Verify functions work correctly after migration

- [x] Task 7: Update TypeScript types (AC: all)
  - [x] Update SessionUser interface (partyId → organisationId, partyName → organisationName)
  - [x] Update Shipment, CreateShipmentInput, ShipmentDetail types
  - [x] Update shipment schemas (fromPartyId → fromOrganisationId)

- [x] Task 8: Update application code references (AC: all)
  - [x] Update getSession.ts (party_id → organisation_id, parties → organisations)
  - [x] Update organisations feature actions (parties → organisations table)
  - [x] Update shipments feature actions and components
  - [x] Update inventory and production actions
  - [x] Update dashboard actions
  - [x] Update SidebarWrapper component

- [x] Task 9: Verification (AC: all)
  - [x] Build passes: `npx turbo build --filter=@timber/portal`
  - [x] Push migration to remote Supabase: `npx supabase db push`
  - [x] Verify all tables have correct structure on remote
  - [x] Verify existing data is preserved
  - [x] Application loads without errors

## Dev Notes

### Architecture: Multi-Tenancy Foundation

This story implements the database foundation for multi-tenancy as defined in the Architecture Addendum. The key principle is **context-driven data scoping** where all portal data is filtered by `organisation_id`.

**Entity Relationships After Migration:**

```
organisations (renamed from parties)
├── portal_users.organisation_id → organisations.id
├── inventory_packages.organisation_id → organisations.id
├── portal_production_entries.organisation_id → organisations.id
├── shipments.from_organisation_id → organisations.id
└── shipments.to_organisation_id → organisations.id
```

### Current Database Schema (Before Migration)

**parties table:**
```sql
CREATE TABLE parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code CHAR(3) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT parties_code_uppercase CHECK (code = UPPER(code))
);
-- Current data: TWP (Timber World Platform), INE (INERCE)
```

**portal_users table (relevant columns):**
```sql
CREATE TABLE portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'producer' CHECK (role IN ('admin', 'producer')),
  party_id UUID REFERENCES parties(id),  -- Current column to rename
  ...
);
-- COMMENT: 'Links producer users to their facility (party). NULL for admin users.'
```

**shipments table:**
```sql
CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_code TEXT NOT NULL UNIQUE,
  shipment_number INTEGER NOT NULL,
  from_party_id UUID REFERENCES parties(id) NOT NULL,
  to_party_id UUID REFERENCES parties(id) NOT NULL,
  ...
);
```

**inventory_packages table:** Currently has NO organisation_id column

**portal_production_entries table:** Currently has NO organisation_id column

### Migration Strategy

The migration must be **safe and reversible**. Key considerations:

1. **Rename `parties` → `organisations`**: Use `ALTER TABLE ... RENAME TO` which preserves all data, indexes, and triggers
2. **Rename columns**: Use `ALTER TABLE ... RENAME COLUMN` which preserves data and foreign key references
3. **Add new columns**: Use 3-step approach:
   - Add column as nullable
   - Populate with default value
   - Alter to NOT NULL
4. **Update functions**: Use `CREATE OR REPLACE FUNCTION`

### Migration File Template

Create file: `supabase/migrations/YYYYMMDD000001_multi_tenancy_schema.sql`

```sql
-- =============================================
-- Multi-Tenancy Schema Migration
-- Migration: YYYYMMDD000001_multi_tenancy_schema.sql
-- Story: 6.1 - Database Schema for Multi-Tenancy
-- =============================================

-- =============================================
-- 1. RENAME parties TABLE TO organisations
-- =============================================

ALTER TABLE parties RENAME TO organisations;

-- Update constraint name
ALTER TABLE organisations
  RENAME CONSTRAINT parties_code_uppercase TO organisations_code_uppercase;

-- Update index names
ALTER INDEX idx_parties_code RENAME TO idx_organisations_code;
ALTER INDEX idx_parties_active RENAME TO idx_organisations_active;

-- Update trigger name
ALTER TRIGGER parties_updated_at ON organisations RENAME TO organisations_updated_at;

-- Update table comment
COMMENT ON TABLE organisations IS 'Organizations participating in the platform (may have 0+ users)';

-- =============================================
-- 2. UPDATE portal_users TABLE
-- =============================================

ALTER TABLE portal_users
  RENAME COLUMN party_id TO organisation_id;

-- The FK constraint auto-follows the table rename, but update the comment
COMMENT ON COLUMN portal_users.organisation_id IS
  'Links users to their organization. NULL for Super Admin (platform-level access).';

-- =============================================
-- 3. UPDATE shipments TABLE
-- =============================================

ALTER TABLE shipments
  RENAME COLUMN from_party_id TO from_organisation_id;

ALTER TABLE shipments
  RENAME COLUMN to_party_id TO to_organisation_id;

-- Update constraint name
ALTER TABLE shipments
  RENAME CONSTRAINT shipments_different_parties TO shipments_different_organisations;

-- Update index names
ALTER INDEX idx_shipments_from RENAME TO idx_shipments_from_organisation;
ALTER INDEX idx_shipments_to RENAME TO idx_shipments_to_organisation;

-- =============================================
-- 4. ADD organisation_id TO inventory_packages
-- =============================================

-- Step 1: Add column as nullable
ALTER TABLE inventory_packages
  ADD COLUMN organisation_id UUID REFERENCES organisations(id);

-- Step 2: Populate existing packages with TWP organisation
UPDATE inventory_packages
SET organisation_id = (SELECT id FROM organisations WHERE code = 'TWP')
WHERE organisation_id IS NULL;

-- Step 3: Make column NOT NULL
ALTER TABLE inventory_packages
  ALTER COLUMN organisation_id SET NOT NULL;

-- Step 4: Add index
CREATE INDEX idx_inventory_packages_organisation ON inventory_packages(organisation_id);

-- Add comment
COMMENT ON COLUMN inventory_packages.organisation_id IS
  'Organization that owns this inventory package';

-- =============================================
-- 5. ADD organisation_id TO portal_production_entries
-- =============================================

-- Step 1: Add column as nullable
ALTER TABLE portal_production_entries
  ADD COLUMN organisation_id UUID REFERENCES organisations(id);

-- Step 2: Populate existing entries with TWP organisation
UPDATE portal_production_entries
SET organisation_id = (SELECT id FROM organisations WHERE code = 'TWP')
WHERE organisation_id IS NULL;

-- Step 3: Make column NOT NULL
ALTER TABLE portal_production_entries
  ALTER COLUMN organisation_id SET NOT NULL;

-- Step 4: Add index
CREATE INDEX idx_production_entries_organisation ON portal_production_entries(organisation_id);

-- Add comment
COMMENT ON COLUMN portal_production_entries.organisation_id IS
  'Organization that owns this production entry';

-- =============================================
-- 6. UPDATE HELPER FUNCTIONS
-- =============================================

-- Update generate_shipment_code to use organisations
CREATE OR REPLACE FUNCTION generate_shipment_code(
  p_from_organisation_id UUID,
  p_to_organisation_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_from_code CHAR(3);
  v_to_code CHAR(3);
  v_count INTEGER;
BEGIN
  -- Get organisation codes
  SELECT code INTO v_from_code FROM organisations WHERE id = p_from_organisation_id;
  SELECT code INTO v_to_code FROM organisations WHERE id = p_to_organisation_id;

  -- Count existing shipments between these organisations
  SELECT COUNT(*) + 1 INTO v_count
  FROM shipments
  WHERE from_organisation_id = p_from_organisation_id
    AND to_organisation_id = p_to_organisation_id;

  -- Return formatted code
  RETURN v_from_code || '-' || v_to_code || '-' || LPAD(v_count::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Note: generate_package_number doesn't reference parties/organisations directly

-- =============================================
-- 7. VERIFICATION QUERIES (for manual testing)
-- =============================================

-- Run after migration to verify:
-- SELECT * FROM organisations;
-- SELECT id, email, role, organisation_id FROM portal_users;
-- SELECT id, shipment_code, from_organisation_id, to_organisation_id FROM shipments;
-- SELECT id, package_number, organisation_id FROM inventory_packages LIMIT 5;
-- SELECT id, organisation_id FROM portal_production_entries LIMIT 5;
```

### TypeScript Code Changes Required

After migration, search and replace in codebase:

| Find | Replace | Files |
|------|---------|-------|
| `party_id` | `organisation_id` | All TS files |
| `parties` | `organisations` | All TS files |
| `from_party_id` | `from_organisation_id` | All TS files |
| `to_party_id` | `to_organisation_id` | All TS files |
| `Party` (type) | `Organisation` (type) | Type definitions |

**Key files to update:**
- `packages/database/src/types/supabase.ts` - Regenerate or manually update
- `apps/portal/src/lib/supabase/queries.ts` - Any party references
- `apps/portal/src/features/inventory/` - Shipment-related components
- `apps/portal/src/features/production/` - Production entry queries

### Session Extension (Future Story 6-2)

This story only updates the database schema. Story 6-2 will update the session to include:
- `organisation_id: string | null` (null for Super Admin)
- `organisation_code: string | null`

### Existing Reference Data

**Organisations (formerly parties) after migration:**
| code | name |
|------|------|
| TWP | Timber World Platform |
| INE | INERCE |

All existing inventory and production data will be assigned to TWP.

### Testing Strategy

1. **Push migration to remote Supabase:**
   ```bash
   npx supabase db push
   ```
   This will apply the migration to your cloud Supabase instance.

2. **Data verification (via Supabase Dashboard or SQL Editor):**
   - Check organisations table has TWP and INE
   - Check portal_users.organisation_id column exists
   - Check inventory_packages.organisation_id is populated
   - Check portal_production_entries.organisation_id is populated

3. **Function verification:**
   - Test `generate_shipment_code()` with new parameter names

4. **Build verification:**
   ```bash
   npx turbo build --filter=@timber/portal
   ```

### Rollback Strategy

If migration fails, the inverse operations are:
1. Rename `organisations` back to `parties`
2. Rename `organisation_id` columns back to `party_id`
3. Drop new `organisation_id` columns from inventory_packages and portal_production_entries

### Previous Story Intelligence

From project-context.md coding standards:
- Database: snake_case column names (e.g., `organisation_id`, not `organisationId`)
- TypeScript: camelCase field names (e.g., `organisationId`)
- Migrations must be reversible where possible
- Always run `npx turbo build` after database changes to verify types

### Scope Boundaries

**In scope (Story 6.1):**
- Rename parties → organisations
- Rename party_id columns → organisation_id
- Add organisation_id to inventory_packages and portal_production_entries
- Update helper functions
- Update TypeScript types and code references

**Out of scope:**
- Session extension (Story 6-2)
- Query filtering by organisation_id (Story 6-3, 6-4)
- RLS policies (deferred to later stories)
- UI changes

### References

- [Source: _bmad-output/planning-artifacts/platform/architecture.md - Multi-Tenancy Addendum]
- [Source: _bmad-output/planning-artifacts/platform/epics.md - Story 6.1]
- [Source: supabase/migrations/20260122000002_inventory_model_v2.sql - parties table]
- [Source: supabase/migrations/20260124000001_add_party_id_to_users.sql - party_id column]
- [Source: _bmad-output/project-context.md - coding standards]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- **AC1 verified:** Migration file creates `organisations` table by renaming `parties`, updating constraints, indexes, and triggers
- **AC2 verified:** Migration renames `party_id` → `organisation_id` in `portal_users` with updated comment
- **AC3 verified:** Migration adds `organisation_id` to `inventory_packages` with 3-step approach (nullable → populate → NOT NULL)
- **AC4 verified:** Migration adds `organisation_id` to `portal_production_entries` with same 3-step approach
- **AC5 verified:** Migration renames shipment columns and constraints to use `organisation` terminology
- **AC6 verified:** Helper functions `generate_shipment_code` and `create_shipment_with_packages` updated
- **Build passes:** `npx turbo build --filter=@timber/portal` completes successfully with no errors
- **Note:** Docker not available locally for migration testing; migration should be tested on remote environment

### File List

- `supabase/migrations/20260126000002_multi_tenancy_schema.sql` (NEW)
- `apps/portal/src/lib/auth/getSession.ts` (MODIFIED - SessionUser type and query)
- `apps/portal/src/features/organisations/actions/getOrganisations.ts` (MODIFIED)
- `apps/portal/src/features/organisations/actions/createOrganisation.ts` (MODIFIED)
- `apps/portal/src/features/organisations/actions/updateOrganisation.ts` (MODIFIED)
- `apps/portal/src/features/organisations/actions/toggleOrganisation.ts` (MODIFIED)
- `apps/portal/src/features/organisations/actions/deleteOrganisation.ts` (MODIFIED)
- `apps/portal/src/features/organisations/actions/getOrgShipmentCount.ts` (MODIFIED)
- `apps/portal/src/features/shipments/types.ts` (MODIFIED)
- `apps/portal/src/features/shipments/schemas/shipment.ts` (MODIFIED)
- `apps/portal/src/features/shipments/actions/getShipments.ts` (MODIFIED)
- `apps/portal/src/features/shipments/actions/getShipmentDetail.ts` (MODIFIED)
- `apps/portal/src/features/shipments/actions/createShipment.ts` (MODIFIED)
- `apps/portal/src/features/shipments/actions/getShipmentCodePreview.ts` (MODIFIED)
- `apps/portal/src/features/shipments/actions/getActiveOrganisations.ts` (MODIFIED)
- `apps/portal/src/features/shipments/components/NewShipmentForm.tsx` (MODIFIED)
- `apps/portal/src/features/shipments/components/ShipmentHeader.tsx` (MODIFIED)
- `apps/portal/src/features/shipments/components/ShipmentDetailView.tsx` (MODIFIED)
- `apps/portal/src/features/inventory/actions/getProducerPackages.ts` (MODIFIED)
- `apps/portal/src/features/production/actions/getAvailablePackages.ts` (MODIFIED)
- `apps/portal/src/features/dashboard/actions/getProducerMetrics.ts` (MODIFIED)
- `apps/portal/src/components/layout/SidebarWrapper.tsx` (MODIFIED)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFIED)

### Change Log

- 2026-01-25: Story 6.1 implementation complete - all acceptance criteria met, build passes
- 2026-01-25: Migration pushed to remote Supabase successfully (fixed DROP before CREATE for function parameter rename)
- 2026-01-25: Updated documentation to reflect cloud-only Supabase usage (CLAUDE.md, supabase/config.toml)
- 2026-01-25: Code review fixes applied (see Senior Developer Review below)

---

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5 (Adversarial Code Review)
**Date:** 2026-01-25
**Outcome:** APPROVED (after fixes)

### Issues Found & Fixed

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| 1 | HIGH | `ShipmentListItem` type still used `Party` naming | Fixed: renamed to `fromOrganisationName/Code`, `toOrganisationName/Code` |
| 2 | HIGH | `getShipments.ts` mapped to old `Party` field names | Fixed: updated field mapping |
| 3 | HIGH | Orphaned `features/parties/` directory with dead code | Fixed: deleted entire directory |
| 4 | MEDIUM | `ShipmentsTab.tsx` used `fromPartyCode`/`toPartyCode` | Fixed: renamed to organisation |
| 5 | MEDIUM | Orphaned `/admin/parties` page importing deleted feature | Fixed: deleted page directory |
| 6 | LOW | British vs American spelling inconsistency in docs | Noted: no action (British "organisation" is consistent in code) |

### Files Modified During Review

- `apps/portal/src/features/shipments/types.ts` (renamed Party→Organisation fields)
- `apps/portal/src/features/shipments/actions/getShipments.ts` (renamed field mapping)
- `apps/portal/src/features/shipments/components/ShipmentsTab.tsx` (renamed Party→Organisation)
- `apps/portal/src/features/parties/` (DELETED - entire directory)
- `apps/portal/src/app/(portal)/admin/parties/` (DELETED - orphaned page)

### Verification

- Build passes: `npx turbo build --filter=@timber/portal` ✅
- No remaining `party`/`partyId`/`partyName` references in portal codebase ✅
