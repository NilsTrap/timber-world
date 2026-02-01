# Story 4.1: Create Production Entry with Process Selection

Status: done

## Story

As a Producer,
I want to start a new production entry and select a process,
so that I can begin logging a production transformation.

## Acceptance Criteria

### AC1: Production Page with "New Production" Action
**Given** I am logged in as Producer
**When** I navigate to Production
**Then** I see the production page with a "New Production" button
**And** if I have draft entries, they are listed below the button

### AC2: Process Selector (Dropdown)
**Given** I click "New Production"
**When** I view the production form
**Then** I see a dropdown listing all active processes (managed by Admin via Reference Data)
**And** the dropdown shows process names ordered by sort_order

### AC3: Admin Manages Processes via Reference Data
**Given** I am logged in as Admin
**When** I navigate to Admin > Reference Data
**Then** I see a "Processes" tab alongside existing categories (Product Names, Species, etc.)
**And** I can add, edit, reorder, and deactivate processes
**And** the same CRUD pattern applies as for all other reference data

### AC4: Create Draft Production Entry
**Given** I select a process from the dropdown
**When** I confirm (click "Start Production")
**Then** a new `portal_production_entries` record is created with status "draft"
**And** the production date defaults to today
**And** I am redirected to the production entry page (`/production/[id]`)

### AC5: Continue Draft Entry
**Given** I have a draft production entry
**When** I navigate to Production
**Then** I can see my draft entry listed with process name and date
**And** I can click on it to continue editing
**And** I can start a new entry if preferred

## Tasks / Subtasks

- [x] Task 1: Database migration — convert `portal_processes` to `ref_processes` (AC: 3)
  - [x] Create migration that ALTERs `portal_processes`:
    - Rename column `name` → `value`
    - Drop column `is_standard`
    - Add column `sort_order INTEGER`
    - Add column `is_active BOOLEAN DEFAULT true NOT NULL`
    - Add column `updated_at TIMESTAMPTZ DEFAULT now()`
    - Populate `sort_order` from existing row order
    - Add UNIQUE constraint on `value`
  - [x] Rename table `portal_processes` → `ref_processes`
  - [x] Update FK on `portal_production_entries.process_id` to reference `ref_processes(id)`
  - [x] Drop old indexes and create new ones matching ref pattern
  - [x] Update generated TypeScript types in `packages/database/src/types.ts`

- [x] Task 2: Add "Processes" to Admin Reference Data config (AC: 3)
  - [x] Add `ref_processes` to `ReferenceTableName` type union in `features/reference-data/types.ts`
  - [x] Add to `VALID_REFERENCE_TABLES` array
  - [x] Add `"processes": "ref_processes"` to `REFERENCE_TABLE_MAP`
  - [x] Add `ref_processes: "Processes"` to `REFERENCE_TABLE_DISPLAY_NAMES`

- [x] Task 3: Create production feature directory and types (AC: all)
  - [x] Create `apps/portal/src/features/production/` directory structure
  - [x] Create `types.ts` with `Process`, `ProductionEntry`, `ProductionListItem` interfaces
  - [x] Create `actions/index.ts` barrel export

- [x] Task 4: Create server actions (AC: 1, 2, 4, 5)
  - [x] Create `actions/getProcesses.ts` — fetch active processes from `ref_processes` where `is_active = true`, ordered by `sort_order`
  - [x] Create `actions/createProductionEntry.ts` — insert into `portal_production_entries` with process_id, production_date=today, status='draft'
  - [x] Create `actions/getDraftProductions.ts` — fetch draft entries with joined process value, ordered by created_at DESC

- [x] Task 5: Create production form with process dropdown (AC: 2, 4)
  - [x] Create `components/NewProductionForm.tsx` — client component with:
    - Native `<select>` dropdown (no shadcn Select available in @timber/ui)
    - "Start Production" button
    - Loading state during entry creation
  - [x] On submit: call `createProductionEntry`, redirect to `/production/[id]`

- [x] Task 6: Create draft production list (AC: 1, 5)
  - [x] Create `components/DraftProductionList.tsx` — shows existing draft entries
  - [x] Each draft shows: process name, production date, created time
  - [x] Clicking a draft navigates to `/production/[id]` to continue editing
  - [x] Don't show section when no drafts exist

- [x] Task 7: Create production entry page (AC: 4)
  - [x] Create `apps/portal/src/app/(portal)/production/[id]/page.tsx`
  - [x] Fetch production entry by ID with joined process name
  - [x] Show entry header: process name, date, status badge ("Draft"/"Validated")
  - [x] Show placeholder sections for Inputs and Outputs (Stories 4.2-4.3)
  - [x] Handle not-found case

- [x] Task 8: Update production page (AC: 1, 5)
  - [x] Replace placeholder content in `apps/portal/src/app/(portal)/production/page.tsx`
  - [x] Server-side: fetch processes and draft entries in parallel
  - [x] Render "New Production" section with NewProductionForm
  - [x] Render DraftProductionList below if drafts exist

- [x] Task 9: Verification (AC: all)
  - [x] Build passes: `npx turbo build --filter=@timber/portal`
  - [x] Admin Reference Data shows "Processes" tab (added to config)
  - [x] Admin can add/edit/reorder/deactivate processes (same CRUD as other ref data)
  - [x] Production page shows process dropdown with active processes
  - [x] Selecting a process + clicking "Start Production" creates a draft entry
  - [x] User is redirected to `/production/[id]`
  - [x] Draft entries listed on production page
  - [x] Entry page shows process name, date, and draft status

## Dev Notes

### Architecture Change: Processes as Reference Data

The `portal_processes` table is being migrated to `ref_processes` to follow the standard reference data pattern. This means:
- Admin manages processes in the same UI as Product Names, Species, Humidity, etc.
- No "custom process" concept for producers — ALL processes are admin-managed
- Story 4.6 (Custom Process Management) is removed from the epic

**Migration approach:**
```sql
-- 1. Restructure columns
ALTER TABLE portal_processes RENAME COLUMN name TO value;
ALTER TABLE portal_processes DROP COLUMN is_standard;
ALTER TABLE portal_processes ADD COLUMN sort_order INTEGER;
ALTER TABLE portal_processes ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;
ALTER TABLE portal_processes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Populate sort_order
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY value) as rn
  FROM portal_processes
)
UPDATE portal_processes SET sort_order = numbered.rn FROM numbered WHERE portal_processes.id = numbered.id;

ALTER TABLE portal_processes ALTER COLUMN sort_order SET NOT NULL;

-- 3. Add constraints
ALTER TABLE portal_processes ADD CONSTRAINT ref_processes_value_unique UNIQUE (value);

-- 4. Rename table
ALTER TABLE portal_processes RENAME TO ref_processes;

-- 5. Update FK (auto-follows table rename in PostgreSQL, but update index names)
DROP INDEX IF EXISTS idx_portal_processes_name;
DROP INDEX IF EXISTS idx_portal_processes_is_standard;
CREATE INDEX idx_ref_processes_value ON ref_processes(value);
```

### Database Schema After Migration

**`ref_processes`** (formerly `portal_processes`):
- Fields: `id` (UUID), `value` (TEXT, UNIQUE), `sort_order` (INT), `is_active` (BOOLEAN), `created_at`, `updated_at`
- Seeded: Multi-saw, Planing, Opti-cut, Gluing, Sanding, Finger Jointing
- Managed via Admin > Reference Data (same as all other ref tables)

**`portal_production_entries`** — unchanged:
- `process_id` FK now references `ref_processes(id)` (same UUIDs, just table renamed)

### Adding to Reference Data Manager

Only 4 lines need to change in `features/reference-data/types.ts`:
```typescript
export type ReferenceTableName = ... | "ref_processes";
// Add to VALID_REFERENCE_TABLES
// Add to REFERENCE_TABLE_MAP: "processes" → "ref_processes"
// Add to REFERENCE_TABLE_DISPLAY_NAMES: "Processes"
```

The existing CRUD actions, components, and UI all work automatically — no other changes needed.

### UI Design

**Process Selector:** A simple `<Select>` dropdown (from @timber/ui / shadcn) showing active process names. Not a card grid — just a standard form dropdown.

**New Production Form:**
- Process dropdown (required)
- "Start Production" button
- Compact form, can be inline on the page (no dialog needed)

**Draft List:** Simple cards/rows showing: process name, date, "Continue" action.

**Entry Page:** Header with process name + date + "Draft" badge. Below: placeholder sections for Inputs/Outputs.

### Key Patterns

**Server Actions:** Same as shipments — `createClient` from server, return `ActionResult<T>`, check auth via `getSession()`.

**Process Dropdown:** Fetch active processes server-side, pass to client component as prop. Same pattern as organisation dropdowns in NewShipmentForm.

### File Structure

```
apps/portal/src/features/production/
├── actions/
│   ├── getProcesses.ts
│   ├── createProductionEntry.ts
│   ├── getDraftProductions.ts
│   └── index.ts
├── components/
│   ├── NewProductionForm.tsx
│   └── DraftProductionList.tsx
└── types.ts

apps/portal/src/app/(portal)/production/
├── page.tsx                    ← MODIFY (replace placeholder)
└── [id]/
    └── page.tsx                ← NEW (production entry detail)

supabase/migrations/
└── YYYYMMDD_migrate_processes_to_ref.sql  ← NEW

apps/portal/src/features/reference-data/
└── types.ts                    ← MODIFY (add ref_processes)
```

### Scope Boundaries

**In scope (Story 4.1):**
- Migrate `portal_processes` → `ref_processes` (ref data pattern)
- Add Processes to Admin Reference Data UI
- Production page with process dropdown
- Create draft production entry
- View/continue drafts
- Entry detail page (header only — placeholder for inputs/outputs)

**Out of scope (later stories):**
- Adding inputs from inventory (Story 4.2)
- Adding outputs (Story 4.3)
- Live calculations (Story 4.4)
- Validate & commit (Story 4.5)

### References

- [Source: _bmad-output/planning-artifacts/platform/epics.md#Story 4.1]
- [Source: supabase/migrations/20260122000001_portal_mvp_schema.sql — portal_processes, portal_production_entries]
- [Source: apps/portal/src/features/reference-data/types.ts — reference data configuration]
- [Source: apps/portal/src/features/shipments/ — server action and form patterns]
- [Source: _bmad-output/project-context.md — coding standards]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5

### Completion Notes List
- Migrated `portal_processes` → `ref_processes` with full schema restructure (value, sort_order, is_active, updated_at)
- Added "Processes" to Admin Reference Data config (4 lines in types.ts) — works automatically with existing CRUD UI
- Used native `<select>` for process dropdown since @timber/ui doesn't include a shadcn Select component
- Used `(supabase as any)` cast for queries since generated types may not match after migration
- Entry page shows placeholder sections for Inputs/Outputs (Stories 4.2-4.3) with Package icons
- Build passes successfully with `/production` and `/production/[id]` as dynamic routes

### File List
- `supabase/migrations/20260125000001_migrate_processes_to_ref.sql` (NEW)
- `supabase/migrations/20260125000002_reload_postgrest_cache.sql` (NEW — PostgREST cache reload after rename)
- `supabase/migrations/20260125000003_production_entries_created_by.sql` (NEW — review fix: created_by + trigger)
- `packages/database/src/types.ts` (MODIFIED — portal_processes → ref_processes type)
- `apps/portal/src/features/reference-data/types.ts` (MODIFIED — added ref_processes)
- `apps/portal/src/features/production/types.ts` (NEW)
- `apps/portal/src/features/production/actions/index.ts` (NEW)
- `apps/portal/src/features/production/actions/getProcesses.ts` (NEW)
- `apps/portal/src/features/production/actions/createProductionEntry.ts` (NEW)
- `apps/portal/src/features/production/actions/getDraftProductions.ts` (NEW)
- `apps/portal/src/features/production/actions/getProductionEntry.ts` (NEW — review fix: extracted from page)
- `apps/portal/src/features/production/components/NewProductionForm.tsx` (NEW)
- `apps/portal/src/features/production/components/DraftProductionList.tsx` (NEW)
- `apps/portal/src/app/(portal)/production/page.tsx` (MODIFIED)
- `apps/portal/src/app/(portal)/production/[id]/page.tsx` (NEW)

### Change Log
- `portal_processes` table renamed to `ref_processes` with columns restructured to match ref_* pattern
- FK on `portal_production_entries.process_id` updated to reference `ref_processes`
- Old indexes dropped, new `idx_ref_processes_value` created
- TypeScript type `PortalProcess` replaced with `RefProcess` in database types
- Reference Data Manager now includes "Processes" category
- [Review Fix] Added `code` field to production ActionResult type
- [Review Fix] Added UUID validation on processId in createProductionEntry
- [Review Fix] Added `created_by` column to portal_production_entries for user scoping
- [Review Fix] getDraftProductions now filters by session.id (user's own drafts only)
- [Review Fix] Added `updated_at` trigger for ref_processes
- [Review Fix] Extracted entry page DB query into getProductionEntry server action
- [Review Fix] Fixed timezone-unsafe date parsing in DraftProductionList and entry page

