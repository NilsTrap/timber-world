# Story 4.3: Add Production Outputs

Status: done

## Story

As a Producer,
I want to record the output packages from production,
so that I can track what was created from the inputs.

## Acceptance Criteria

### AC1: Outputs Section with DataEntryTable
**Given** I have added inputs to a production entry
**When** I move to the Outputs section
**Then** I see the standard `DataEntryTable` component with all 14 columns in the standard order
**And** sort/filter/collapse features are available on all columns
**And** I can add, copy, and delete output rows

### AC2: Auto-Generate from Inputs
**Given** I click "Auto-Generate from Inputs"
**When** the system processes
**Then** output lines are created with inherited attributes:
- Product Name, Species, Humidity from inputs
- Type and Processing may change based on process (e.g., after planing → "Planed")
- Dimensions may be modified (e.g., thickness reduced after planing)
**And** I can adjust all values as needed

### AC3: Manual Output Entry
**Given** I am adding output lines manually
**When** I click "+ Add Output" (or use the DataEntryTable's built-in "Add Row" button)
**Then** a new row is added following the standard 14-column layout with all attribute dropdowns and dimension inputs
**And** the package number is auto-generated (internal production number format: `OUT-001`, `OUT-002`, etc.)
**And** volume auto-calculates when all dimensions and pieces are single numbers

### AC4: Copy Row
**Given** I am editing output lines
**When** I need the same values for multiple outputs
**Then** I can use DataEntryTable's built-in "Copy Row" to duplicate with new package number

### AC5: Output Lines Display with Totals
**Given** I have added output lines
**When** I view the outputs section
**Then** I see all output lines in the standard 14-column table with sort/filter/collapse functionality
**And** I see a running total of output m³ and total packages count
**And** I can remove any output line by clicking delete

### AC6: Persist Outputs
**Given** I add, edit, or remove output lines
**When** changes occur
**Then** the production entry's outputs are persisted to the database
**And** when I return to the entry, my outputs are still there

### AC7: Keyboard Shortcut with Visible Hint
**Given** I am on a draft production entry page
**When** I view the outputs section
**Then** I see the shortcut hint "Ctrl+O" visibly displayed on or next to the "+ Add Output" button

**Given** I press Ctrl+O on the production entry page
**When** the entry is in draft status
**Then** a new output row is added to the table

## Tasks / Subtasks

- [x] Task 1: Database migration — create `portal_production_outputs` table (AC: 5, 6)
  - [x] Create table with columns: id (UUID PK), production_entry_id (FK → portal_production_entries ON DELETE CASCADE), package_number (TEXT NOT NULL), product_name_id (FK → ref_product_names), wood_species_id (FK → ref_wood_species), humidity_id (FK → ref_humidity), type_id (FK → ref_types), processing_id (FK → ref_processing), fsc_id (FK → ref_fsc), quality_id (FK → ref_quality), thickness (TEXT), width (TEXT), length (TEXT), pieces (TEXT), volume_m3 (DECIMAL NOT NULL), created_at (TIMESTAMPTZ DEFAULT now())
  - [x] Add index on production_entry_id
  - [x] Include NOTIFY pgrst at end
  - [x] Push migration to remote

- [x] Task 2: Create production output types and actions (AC: 3, 5, 6)
  - [x] Add `ProductionOutput` interface to `features/production/types.ts`:
    - id, productionEntryId, packageNumber, productNameId, woodSpeciesId, humidityId, typeId, processingId, fscId, qualityId, thickness, width, length, pieces, volumeM3, createdAt
  - [x] Add `OutputRow` interface (client-side form state, similar to `PackageRow` from shipments):
    - clientId, packageNumber, productNameId, woodSpeciesId, humidityId, typeId, processingId, fscId, qualityId, thickness, width, length, pieces, volumeM3, volumeIsCalculated, dbId (null for new, UUID for existing)
  - [x] Create `actions/getReferenceDropdownsForProducer.ts` — same as shipments getReferenceDropdowns but with `isProducer` check instead of `isAdmin`
  - [x] Create `actions/getProductionOutputs.ts` — fetch outputs for an entry
  - [x] Create `actions/saveProductionOutputs.ts` — batch save: compare client rows vs DB rows, insert new, update changed, delete removed (single action, atomic behavior)
  - [x] Update `actions/index.ts` barrel exports

- [x] Task 3: Create ProductionOutputsTable component (AC: 1, 3, 4, 5, 7)
  - [x] Create `components/ProductionOutputsTable.tsx` — thin wrapper around `DataEntryTable<OutputRow>`
  - [x] Follow exact same pattern as `PackageEntryTable.tsx` from shipments feature
  - [x] 14-column definition with same types/config as PackageEntryTable (dropdowns collapsible, dimensions text, pieces numeric, volume custom with auto-calc)
  - [x] Package number column as readonly + auto-generated (`OUT-001`, `OUT-002`, etc.)
  - [x] Volume auto-calculation: same `calculateVolume`, `shouldAutoCalculate`, `formatVolumeDisplay` helpers (extracted to shared `helpers/output-helpers.ts`)
  - [x] `collapseStorageKey="production-outputs-collapsed"`
  - [x] `idPrefix="out"`

- [x] Task 4: Create ProductionOutputsSection client component (AC: 1, 2, 6, 7)
  - [x] Create `components/ProductionOutputsSection.tsx` — client wrapper managing output state + save logic
  - [x] Props: `productionEntryId`, `initialOutputs: ProductionOutput[]`, `dropdowns: ReferenceDropdowns`, `inputs: ProductionInput[]` (for auto-generate)
  - [x] Convert DB outputs to `OutputRow[]` on mount
  - [x] "Auto-Generate from Inputs" button: creates output rows from input data (inherit attributes, adjustable)
  - [x] Debounced save via `saveProductionOutputs` action — triggered on row changes (800ms debounce)
  - [x] Ctrl+O keyboard shortcut: adds a new empty row to the table
  - [x] Visible `<kbd>Ctrl+O</kbd>` hint next to the section header
  - [x] Show total output m³ in section header

- [x] Task 5: Update production entry page (AC: 1, 6)
  - [x] Replace Outputs placeholder section in `/production/[id]/page.tsx`
  - [x] Fetch reference dropdowns, existing outputs, and current inputs server-side (parallel)
  - [x] Pass all data to ProductionOutputsSection
  - [x] Only show outputs section for draft entries

- [x] Task 6: Verification (AC: all)
  - [x] Build passes: `npx turbo build --filter=@timber/portal`
  - [ ] Can add output rows with all 14 columns editable
  - [ ] Volume auto-calculates from dimensions × pieces
  - [ ] Can copy rows (gets new package number)
  - [ ] Can delete rows
  - [ ] Auto-generate from inputs creates pre-filled rows
  - [ ] Outputs persist when navigating away and returning
  - [ ] Total m³ updates as outputs are added/modified
  - [ ] Sort/filter/collapse works on all columns
  - [ ] Ctrl+O adds new row, hint is visible

## Dev Notes

### Database Design: Production Outputs

**New table: `portal_production_outputs`**
```sql
CREATE TABLE portal_production_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_entry_id UUID REFERENCES portal_production_entries(id) ON DELETE CASCADE NOT NULL,
  package_number TEXT NOT NULL,
  product_name_id UUID REFERENCES ref_product_names(id),
  wood_species_id UUID REFERENCES ref_wood_species(id),
  humidity_id UUID REFERENCES ref_humidity(id),
  type_id UUID REFERENCES ref_types(id),
  processing_id UUID REFERENCES ref_processing(id),
  fsc_id UUID REFERENCES ref_fsc(id),
  quality_id UUID REFERENCES ref_quality(id),
  thickness TEXT,
  width TEXT,
  length TEXT,
  pieces TEXT,
  volume_m3 DECIMAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Why a new table?**
Unlike inputs (which reference existing `inventory_packages`), outputs are NEW packages being created during production. They store all attributes directly (not as FK joins to inventory). When validated in Story 4.5, these output rows become new `inventory_packages` records.

The existing `portal_production_lines` table is pre-Inventory Model v2 and lacks the 7 reference FK columns. It can be dropped or ignored.

### Critical: Use DataEntryTable — NOT Custom Table

**Unlike Story 4.2 (inputs)**, which used custom Table primitives because it needed checkboxes + mixed editable/readonly per row, the outputs table is a **standard editable DataEntryTable**. It follows the EXACT same pattern as `PackageEntryTable.tsx` in the shipments feature.

This means:
- Import `DataEntryTable` and `ColumnDef` from `@timber/ui`
- Define `OutputRow` type (same shape as `PackageRow`)
- Define columns array with same types
- Provide `createRow`, `copyRow`, `renumberRows`, `onCellChange`, `onRowsChange` callbacks
- Volume column uses `type: "custom"` with `renderCell` for auto-calc vs manual input

### OutputRow Type (Client-Side State)

```typescript
export interface OutputRow {
  clientId: string;        // Temporary client ID for React key
  dbId: string | null;     // null for new rows, UUID for persisted rows
  packageNumber: string;   // Auto-generated: OUT-001, OUT-002, etc.
  productNameId: string;
  woodSpeciesId: string;
  humidityId: string;
  typeId: string;
  processingId: string;
  fscId: string;
  qualityId: string;
  thickness: string;
  width: string;
  length: string;
  pieces: string;
  volumeM3: string;
  volumeIsCalculated: boolean;
}
```

### Save Strategy: Batch Diff Save

Since DataEntryTable manages rows as client-side state (add/copy/delete/edit all in-memory), we need a save strategy that syncs with the database:

```typescript
// saveProductionOutputs action:
// 1. Receive current OutputRow[] from client
// 2. Fetch existing DB rows for this entry
// 3. Compute diff:
//    - Rows with dbId=null → INSERT
//    - Rows with dbId that changed → UPDATE
//    - DB rows not in client list → DELETE
// 4. Execute all operations
// 5. Return updated rows with dbIds populated
```

**When to save:**
- On row add (via "+ Add Row" or Copy)
- On row delete
- On cell blur (after edit completes)
- Use `useTransition` for non-blocking saves
- Show subtle save indicator (e.g., small "Saving..." text or spinner)

### Auto-Generate from Inputs

When user clicks "Auto-Generate from Inputs":
1. Take all current `ProductionInput[]` as source
2. For each unique combination of product attributes (productName, species, humidity, type, processing, fsc, quality):
   - Create one output row inheriting those attributes
   - Copy dimensions from input
   - Set pieces = sum of input pieces for that attribute combination
   - Auto-calculate volume
3. User can then adjust any values (dimensions may change after processing)

**Important:** The process type (e.g., "Planing") could influence the generated output. For MVP, just copy attributes as-is and let the user adjust. Post-MVP: add process-specific transformation rules.

### Reference Dropdowns for Producer

The existing `getReferenceDropdowns` in shipments is admin-only. Create a producer-accessible version:
```typescript
// actions/getReferenceDropdownsForProducer.ts
export async function getReferenceDropdownsForProducer(): Promise<ActionResult<ReferenceDropdowns>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isProducer(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  // Same logic as shipments version: fetch all 7 ref_* tables with is_active=true
}
```

The `ReferenceDropdowns` and `ReferenceOption` types can be imported from shipments or duplicated in production types.

### Volume Helpers — Reuse Pattern

The volume calculation helpers (`calculateVolume`, `shouldAutoCalculate`, `formatVolumeDisplay`, `normalizeDecimalInput`, `formatVolumeInput`, `normalizeVolumePrecision`, `isRange`) are identical to those in `PackageEntryTable.tsx`.

**Options:**
1. Copy them into `ProductionOutputsTable.tsx` (simplest, follows existing pattern)
2. Extract to a shared utility in `packages/ui/src/lib/volume-helpers.ts` (cleaner but wider refactor)

**Recommendation:** Copy them (option 1) for consistency with existing code. If needed later, extract as a separate refactoring task.

### Keyboard Shortcut: Ctrl+O

Add a document-level `keydown` listener in `ProductionOutputsSection`:
```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "o") {
      e.preventDefault();
      handleAddRow();
    }
  };
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}, [handleAddRow]);
```

Display `<kbd>Ctrl+O</kbd>` visually on the section header near the "Add" area.

### Ownership Verification

All output mutation actions must verify the production entry's `created_by === session.id`, same pattern established in Story 4.2's code review fixes.

### Package Number Generation

Output package numbers follow format `OUT-001`, `OUT-002`, etc. (sequential per entry):
```typescript
function generateOutputNumber(index: number): string {
  return `OUT-${String(index + 1).padStart(3, "0")}`;
}
```

These are preview numbers. When validated in Story 4.5, final production package numbers may be generated differently.

### Existing Patterns to Follow

**DataEntryTable wrapper:** Exact same pattern as `features/shipments/components/PackageEntryTable.tsx`
**Server Actions:** Same pattern as Story 4-1/4-2: `createClient`, `getSession()`, return `ActionResult<T>`, UUID validation, ownership check
**Data fetching:** Server-side in page.tsx, pass as props to client component
**Hydration:** Initialize collapsed state with `useState(new Set())` + `useEffect` localStorage load (pattern from Story 4-2 hydration fixes)

### File Structure

```
apps/portal/src/features/production/
├── actions/
│   ├── getReferenceDropdownsForProducer.ts  ← NEW
│   ├── getProductionOutputs.ts              ← NEW
│   ├── saveProductionOutputs.ts             ← NEW
│   └── index.ts                             ← MODIFY (add exports)
├── components/
│   ├── ProductionOutputsTable.tsx           ← NEW
│   ├── ProductionOutputsSection.tsx         ← NEW
│   └── ...existing...
└── types.ts                                 ← MODIFY (add OutputRow, ProductionOutput)

apps/portal/src/app/(portal)/production/
└── [id]/
    └── page.tsx                             ← MODIFY (replace outputs placeholder)

supabase/migrations/
└── 20260125000005_production_outputs.sql    ← NEW
```

### Scope Boundaries

**In scope (Story 4.3):**
- Create production outputs table
- Full editable DataEntryTable with 14 columns
- Auto-generate from inputs (inherit attributes)
- Copy row with new package number
- Persist outputs to database (batch diff save)
- Running total of output m³
- Add/delete output rows
- Keyboard shortcut Ctrl+O with visible hint
- Volume auto-calculation

**Out of scope (later stories):**
- Live calculation summary comparing inputs vs outputs (Story 4.4)
- Validate & commit / creating inventory records from outputs (Story 4.5)
- "Apply to All" for specific attributes (simplification for MVP — use Copy Row instead)

### Previous Story Intelligence (4-2)

Key learnings from Story 4-2 implementation:
1. **Hydration fixes:** Always use `useState(new Set())` + `useEffect` for localStorage reads
2. **Ownership verification:** All mutations must check `entry.created_by === session.id`
3. **`(supabase as any)` cast:** Still needed — generated types don't include new tables
4. **PackageSelector was custom:** Outputs table does NOT need checkboxes, so use standard DataEntryTable
5. **Volume formatting:** Latvian locale (comma separator), 3 decimal places, `formatVolumeDisplay` helper
6. **Table height stability:** Use consistent cell heights to prevent layout shift
7. **Auto-calculate read-only:** When volume is auto-calculated, render as span not input
8. **Keyboard navigation:** DataEntryTable already has built-in keyboard navigation (Enter, arrows)

### References

- [Source: _bmad-output/planning-artifacts/platform/epics.md#Story 4.3]
- [Source: apps/portal/src/features/shipments/components/PackageEntryTable.tsx — DataEntryTable wrapper pattern]
- [Source: apps/portal/src/features/shipments/types.ts — PackageRow, ReferenceDropdowns types]
- [Source: apps/portal/src/features/shipments/actions/getReferenceDropdowns.ts — reference data fetching]
- [Source: apps/portal/src/features/production/components/ProductionInputsSection.tsx — client wrapper pattern]
- [Source: packages/ui/src/components/data-entry-table.tsx — DataEntryTable component API]
- [Source: _bmad-output/project-context.md — Standard Column Order, coding standards]
- [Source: _bmad-output/implementation-artifacts/platform/4-2-add-production-inputs-from-inventory.md — previous story learnings]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5

### Completion Notes List
- Created `portal_production_outputs` table with all 7 reference FKs, dimensions, pieces, volume_m3
- Migration pushed to remote with PostgREST cache reload
- Added `ProductionOutput`, `OutputRow`, `ReferenceOption`, `ReferenceDropdowns` interfaces to types.ts
- 3 server actions created: getReferenceDropdownsForProducer, getProductionOutputs, saveProductionOutputs
- getReferenceDropdownsForProducer uses `isProducer` check (not admin-only like shipments version)
- saveProductionOutputs implements batch diff: INSERT new (single batch), skip unchanged UPDATEs, DELETE removed — with ownership verification
- ProductionOutputsTable follows exact same pattern as PackageEntryTable: DataEntryTable wrapper with 14 columns, volume auto-calc, copy/add/delete
- ProductionOutputsSection manages state with debounced save (800ms), auto-generate from inputs, Ctrl+O shortcut
- Auto-generate groups inputs by attribute combination, inherits all 7 reference values + dimensions, sums pieces, auto-calculates volume
- Page fetches dropdowns, inputs, and outputs in parallel for draft entries
- `(supabase as any)` cast used for queries (generated types may not include new table)
- Code review: extracted duplicated volume/row helpers to shared `helpers/output-helpers.ts`
- Code review: saveProductionOutputs uses single batch INSERT + field-level diff to skip unnecessary UPDATEs
- Build passes with 0 TypeScript errors

### File List
- `supabase/migrations/20260125000005_production_outputs.sql` (NEW)
- `apps/portal/src/features/production/types.ts` (MODIFIED — added ProductionOutput, OutputRow, ReferenceOption, ReferenceDropdowns)
- `apps/portal/src/features/production/actions/index.ts` (MODIFIED — added 3 new exports)
- `apps/portal/src/features/production/actions/getReferenceDropdownsForProducer.ts` (NEW)
- `apps/portal/src/features/production/actions/getProductionOutputs.ts` (NEW)
- `apps/portal/src/features/production/actions/saveProductionOutputs.ts` (NEW)
- `apps/portal/src/features/production/helpers/output-helpers.ts` (NEW — shared volume/row helpers extracted from Table+Section)
- `apps/portal/src/features/production/components/ProductionOutputsTable.tsx` (NEW)
- `apps/portal/src/features/production/components/ProductionOutputsSection.tsx` (NEW)
- `apps/portal/src/app/(portal)/production/[id]/page.tsx` (MODIFIED — replaced outputs placeholder, added data fetching)

### Change Log
- Created `portal_production_outputs` database table with FK to production entries and all 7 reference tables
- Added ProductionOutput + OutputRow + ReferenceDropdowns types
- Implemented 3 server actions: getReferenceDropdownsForProducer, getProductionOutputs, saveProductionOutputs (batch diff)
- Created ProductionOutputsTable as thin DataEntryTable wrapper with 14-column layout, volume auto-calc, collapsible dropdowns
- Created ProductionOutputsSection client wrapper with debounced save, auto-generate from inputs, Ctrl+O shortcut, total m³ display
- Updated production entry page to fetch and display outputs for draft entries
- **Code Review Fix:** saveProductionOutputs now uses single batch INSERT instead of per-row inserts
- **Code Review Fix:** Added field-level diff comparison — only sends UPDATE for rows that actually changed
- **Code Review Fix:** Extracted duplicated helpers (generateClientId, generateOutputNumber, isRange, shouldAutoCalculate, calculateVolume, createEmptyOutputRow) to shared `helpers/output-helpers.ts`
- **Code Review Fix:** Removed false "Shipment column" subtask from Task 3
