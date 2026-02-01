# Story 4.2: Add Production Inputs from Inventory

Status: done

## Story

As a Producer,
I want to select packages from inventory as production inputs,
so that I can record what materials were consumed in the process.

## Acceptance Criteria

### AC1: Add Input Action
**Given** I am on a draft production entry page (`/production/[id]`)
**When** I click "+ Add Input"
**Then** I see a large package selector dialog (near full-screen) showing available inventory packages
**And** the dialog is scrollable both vertically and horizontally
**And** packages are displayed in the full standard 14-column table format (same as Producer Inventory view)
**And** I can use the same sort/filter/collapse features to find packages

### AC2: Multi-Select Packages with Amounts
**Given** the package selector is open
**When** I check a package row (via checkbox)
**Then** the package is marked as selected with editable Pieces and Volume fields appearing for that row
**And** I can check multiple packages and enter amounts for each
**And** pieces cannot exceed the package's available pieces
**And** volume cannot exceed the package's total volume

**Given** I have selected one or more packages with amounts entered
**When** I click "Add Selected"
**Then** all selected packages are added as inputs with their entered amounts
**And** the selector closes and the inputs table refreshes

### AC3: Input Lines Display
**Given** I have added input lines
**When** I view the inputs section
**Then** I see all input lines in the standard 14-column table format with full sort/filter/collapse functionality
**And** I see a running total of input m³
**And** I can remove any input line by clicking delete

### AC4: Input Quantity Validation
**Given** I try to enter pieces greater than available in a package
**When** I blur the pieces field
**Then** I see a validation error "Pieces exceeds available inventory"

**Given** a package has countable pieces and I enter pieces
**When** dimensions are all single numbers
**Then** volume m³ is auto-calculated from pieces × dimensions

**Given** a package has no countable pieces (pieces = "-")
**When** I enter volume m³ directly
**Then** volume m³ cannot exceed the package's total volume

**Given** I try to enter volume m³ greater than available in a package
**When** I blur the volume field
**Then** I see a validation error "Volume exceeds available inventory"

### AC5: Persist Inputs
**Given** I add, edit, or remove input lines
**When** the changes are saved
**Then** the production entry's inputs are persisted to the database
**And** when I return to the entry, my inputs are still there

### AC6: Keyboard Shortcut with Visible Hint
**Given** I am on a draft production entry page
**When** I view the inputs section
**Then** I see the shortcut hint "Ctrl+I" visibly displayed on or next to the "+ Add Input" button

**Given** I press Ctrl+I on the production entry page
**When** the entry is in draft status
**Then** the package selector opens

## Tasks / Subtasks

- [x] Task 1: Database migration — create `portal_production_inputs` table (AC: 2, 5)
  - [x] Create table with columns: id (UUID PK), production_entry_id (FK → portal_production_entries ON DELETE CASCADE), package_id (FK → inventory_packages), pieces_used (INTEGER NULL), volume_m3 (DECIMAL NOT NULL), created_at
  - [x] Add indexes on production_entry_id and package_id
  - [x] Add CHECK constraint: pieces_used > 0
  - [x] Include NOTIFY pgrst at end
  - [x] Push migration to remote

- [x] Task 2: Create production input types and actions (AC: 1, 2, 3, 5)
  - [x] Add `ProductionInput` interface to `features/production/types.ts`:
    - id, productionEntryId, packageId, packageNumber, piecesUsed, volumeM3
    - Plus all display fields: productName, woodSpecies, humidity, typeName, processing, fsc, quality, thickness, width, length, availablePieces, totalVolumeM3
  - [x] Create `actions/getAvailablePackages.ts` — fetch packages at producer's facility not fully consumed, with all ref joins
  - [x] Create `actions/getProductionInputs.ts` — fetch inputs for an entry with joined package data
  - [x] Create `actions/addProductionInput.ts` — insert input line (validate pieces ≤ available, volume ≤ package total)
  - [x] Create `actions/removeProductionInput.ts` — delete input line by ID
  - [x] Create `actions/updateProductionInput.ts` — update pieces_used/volume_m3 (with validation: pieces ≤ available, volume ≤ package total)
  - [x] Update `actions/index.ts` barrel exports

- [x] Task 3: Create PackageSelector component — multi-select dialog (AC: 1, 2)
  - [x] Create `components/PackageSelector.tsx` — near full-screen dialog (98vw × 92vh) with horizontal/vertical scrolling
  - [x] Custom table using Table primitives + ColumnHeaderMenu (not DataEntryTable) for checkbox + editable columns
  - [x] Sticky checkbox column (left) for multi-select, 14 standard display columns, "Use Pcs" + "Use m³" editable columns
  - [x] Sort/filter/collapse features via ColumnHeaderMenu with localStorage persistence
  - [x] Multi-select state via `Map<string, SelectedPackage>` — pre-fills pieces/volume from package values on check
  - [x] Client-side validation (pieces ≤ available, volume ≤ total) before submission
  - [x] Footer with selection counter + "Add Selected (N)" confirm button
  - [x] Sequential addProductionInput calls for all selected, then close + refresh
  - [x] Reset selection state on dialog close
  - [x] Show empty state if no packages available

- [x] Task 4: Create ProductionInputsTable component (AC: 2, 3, 4)
  - [x] Create `components/ProductionInputsTable.tsx` — custom table with Table primitives + ColumnHeaderMenu
  - [x] Standard 14-column layout (see project-context.md Standard Column Order)
  - [x] Shipment column shows source shipment code
  - [x] Pieces column shows `pieces_used` (editable inline)
  - [x] Volume column shows volume_m3 (editable inline)
  - [x] Show totals footer: count of lines, sum of pieces_used, sum of volume_m3
  - [x] Add delete button per row (removes input)
  - [x] Validate pieces_used on blur: cannot exceed package's available pieces
  - [x] Validate volume_m3 on blur: cannot exceed package's total volume
  - [x] Show validation error toast if pieces or volume exceed available

- [x] Task 5: Update production entry page (AC: 1, 3, 5, 6)
  - [x] Replace Inputs placeholder section in `/production/[id]/page.tsx`
  - [x] Fetch available packages and existing inputs server-side
  - [x] Render "+ Add Input" button that opens PackageSelector
  - [x] Render ProductionInputsTable with current inputs
  - [x] Show running total of input m³ in section header
  - [x] Only show inputs section for draft entries
  - [x] Add Ctrl+I keyboard shortcut to open package selector
  - [x] Display visible "Ctrl+I" hint on the Add Input button

- [x] Task 6: Verification (AC: all)
  - [x] Build passes: `npx turbo build --filter=@timber/portal`
  - [ ] Can click "+ Add Input" and see available packages
  - [ ] Selecting a package adds it as input with pre-filled attributes
  - [ ] Can edit pieces_used, validation prevents exceeding available pieces
  - [ ] Can edit volume_m3 directly for non-countable packages, validation prevents exceeding package total
  - [ ] Can remove an input line
  - [ ] Inputs persist when navigating away and returning
  - [ ] Total m³ updates as inputs are added/modified

## Dev Notes

### Database Design: Production Inputs

**New table: `portal_production_inputs`**
```sql
CREATE TABLE portal_production_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_entry_id UUID REFERENCES portal_production_entries(id) ON DELETE CASCADE NOT NULL,
  package_id UUID REFERENCES inventory_packages(id) NOT NULL,
  pieces_used INTEGER CHECK (pieces_used > 0),  -- NULL when package has no countable pieces
  volume_m3 DECIMAL NOT NULL,                    -- Always required (calculated or manual)
  created_at TIMESTAMPTZ DEFAULT now()
);
```

- `pieces_used`: nullable — NULL for packages where pieces = "-"
- `volume_m3`: NOT NULL — always stored (either auto-calculated from pieces×dims or entered manually)

**Why a new table instead of `portal_production_lines`?**
The existing `portal_production_lines` table was designed pre-Inventory Model v2. It lacks the 7 reference FK columns and the link to `inventory_packages`. Rather than migrating it, we create `portal_production_inputs` that directly references the source package. All display attributes are fetched via FK joins to `inventory_packages` and its reference tables.

The existing `portal_production_lines` table can be dropped or repurposed for outputs in Story 4.3.

### Querying Input Data with Package Attributes

Use the same FK join pattern as `getProducerPackages`:
```typescript
const { data } = await supabase
  .from("portal_production_inputs")
  .select(`
    id, pieces_used, volume_m3, created_at,
    inventory_packages!portal_production_inputs_package_id_fkey(
      id, package_number, thickness, width, length, pieces, volume_m3,
      shipments!inventory_packages_shipment_id_fkey(shipment_code),
      ref_product_names!inventory_packages_product_name_id_fkey(value),
      ref_wood_species!inventory_packages_wood_species_id_fkey(value),
      ref_humidity!inventory_packages_humidity_id_fkey(value),
      ref_types!inventory_packages_type_id_fkey(value),
      ref_processing!inventory_packages_processing_id_fkey(value),
      ref_fsc!inventory_packages_fsc_id_fkey(value),
      ref_quality!inventory_packages_quality_id_fkey(value)
    )
  `)
  .eq("production_entry_id", entryId)
  .order("created_at", { ascending: true });
```

### Package Selector UI

The selector opens as a **near full-screen dialog (98vw × 92vh)** with a custom table using Table primitives + ColumnHeaderMenu. It provides multi-select capability with:
- Sticky checkbox column (left) for selecting multiple packages
- 14 standard display columns with sort/filter/collapse (same as Producer Inventory)
- "Use Pcs" and "Use m³" editable columns that appear when a row is checked
- Pre-fills pieces/volume from the package's values when checked
- Footer with selection count + "Add Selected (N)" confirm button
- Client-side validation before sequential addProductionInput calls
- Packages already added as inputs to this entry are filtered out by the server action

### Available Packages Query

To find packages available for input selection, query `inventory_packages` where:
- Package belongs to a shipment received at the producer's facility (`shipments.to_party_id = session.partyId`)
- Package has available pieces (pieces > 0 and status = 'available')
- Package is NOT already added as input to this production entry

```typescript
// Get packages at producer's facility
const packages = await getProducerPackages(); // existing action

// Filter out packages already used in this entry
const existingInputPackageIds = inputs.map(i => i.packageId);
const available = packages.filter(p => !existingInputPackageIds.includes(p.id));
```

### Pieces Validation

Available pieces for a package = total pieces on package MINUS pieces already used in OTHER validated/draft production inputs:
- For MVP: Simply check `pieces_used ≤ package.pieces` (total on package)
- This doesn't account for the same package being used in multiple draft entries simultaneously
- Post-MVP: Track consumed pieces across all entries

### Volume Calculation for Input Lines

When `pieces_used` is set, calculate volume:
```typescript
// If all dimensions are single numbers (not ranges):
const volume = (thickness * width * length * piecesUsed) / 1_000_000_000;
// Otherwise: proportional from package's total
const volume = (piecesUsed / totalPieces) * packageVolumeM3;
```

### DataEntryTable Usage for Inputs

The inputs table uses `DataEntryTable` in `readOnly` mode for display. The Pieces column needs special handling since it's editable. Options:
1. Use a non-readOnly DataEntryTable with most columns as `type: "readonly"` and only Pieces as editable
2. Use readOnly mode + custom action buttons per row for editing pieces

**Recommended approach:** Use readOnly DataEntryTable for display + an inline edit pattern for the Pieces field. When user clicks the pieces cell, show an input. On blur, save via server action.

### Column Collapse Persistence

Use the `collapseStorageKey` prop on DataEntryTable to persist collapsed column preferences via localStorage. Use a dedicated key for production inputs so the preference is consistent across all production entries:
- Inputs table: `collapseStorageKey="production-inputs-collapsed"`
- Package selector table: `collapseStorageKey="production-input-selector-collapsed"`

This ensures when a producer collapses columns while adding inputs, the same layout is preserved next time they open any production entry or the package selector.

### Standard Column Order for Inputs Table

Per project-context.md, the 14-column order is:
| # | Column | For Inputs |
|---|--------|-----------|
| 1 | Shipment | Source shipment code (readonly) |
| 2 | Package | Source package number (readonly, totalType: "count") |
| 3-9 | Product, Species, Humidity, Type, Processing, FSC, Quality | From package (readonly, collapsible) |
| 10-12 | Thickness, Width, Length | From package (readonly) |
| 13 | Pieces | **pieces_used (EDITABLE)** — totalType: "sum" |
| 14 | Vol m³ | **EDITABLE** — auto-calculated when possible, manual entry when pieces="-" — totalType: "sum" |

### Editable Fields Logic

Two columns are editable in the inputs table: **Pieces** and **Volume m³**.

**When package has countable pieces (pieces ≠ "-"):**
- User enters `pieces_used` (validated: cannot exceed available)
- If dimensions are all single numbers → volume auto-calculates
- If dimensions contain ranges → user enters volume manually

**When package has no countable pieces (pieces = "-"):**
- Pieces field stays as "-" (not editable)
- User enters `volume_m3` directly (validated: cannot exceed package's total volume)

### Existing Patterns to Follow

**Server Actions:** Same pattern as Story 4-1: `createClient`, `getSession()`, return `ActionResult<T>`, UUID validation.

**Data fetching:** Use same FK join pattern as `getProducerPackages.ts` and `getShipmentDetail.ts`.

**Volume calculation:** Use same logic as `PackageEntryTable.tsx` (`calculateVolume` function).

### File Structure

```
apps/portal/src/features/production/
├── actions/
│   ├── getAvailablePackages.ts    ← NEW
│   ├── getProductionInputs.ts     ← NEW
│   ├── addProductionInput.ts      ← NEW
│   ├── removeProductionInput.ts   ← NEW
│   ├── updateProductionInput.ts   ← NEW
│   └── index.ts                   ← MODIFY (add exports)
├── components/
│   ├── PackageSelector.tsx        ← NEW
│   ├── ProductionInputsTable.tsx  ← NEW
│   └── ...existing...
└── types.ts                       ← MODIFY (add ProductionInput interface)

apps/portal/src/app/(portal)/production/
└── [id]/
    └── page.tsx                   ← MODIFY (replace inputs placeholder)

supabase/migrations/
└── 20260125000004_production_inputs.sql  ← NEW
```

### Scope Boundaries

**In scope (Story 4.2):**
- Create production inputs table
- Package selector from available inventory
- Display inputs in standard 14-column format
- Editable pieces_used with validation
- Persist inputs to database
- Running total of input m³
- Remove input lines
- Keyboard shortcut Ctrl+I to open package selector, with visible hint on button

**Out of scope (later stories):**
- Output lines (Story 4.3)
- Live calculation summary (Story 4.4)
- Validate & commit / inventory deduction (Story 4.5)

### References

- [Source: _bmad-output/planning-artifacts/platform/epics.md#Story 4.2]
- [Source: apps/portal/src/features/inventory/actions/getProducerPackages.ts — FK join query pattern]
- [Source: apps/portal/src/features/inventory/components/ProducerInventory.tsx — DataEntryTable column config]
- [Source: apps/portal/src/features/shipments/components/PackageEntryTable.tsx — volume calculation]
- [Source: packages/ui/src/components/data-entry-table.tsx — DataEntryTable component API]
- [Source: _bmad-output/project-context.md — Standard Column Order, coding standards]
- [Source: supabase/migrations/20260122000002_inventory_model_v2.sql — inventory_packages schema]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5

### Completion Notes List
- Created `portal_production_inputs` table with nullable `pieces_used` (for non-countable packages) and NOT NULL `volume_m3`
- Migration pushed to remote with PostgREST cache reload
- 5 server actions created following existing patterns: getAvailablePackages, getProductionInputs, addProductionInput, removeProductionInput, updateProductionInput
- All actions validate UUID inputs, check auth/permissions, and return ActionResult<T>
- addProductionInput and updateProductionInput validate both pieces (≤ available) and volume (≤ package total)
- PackageSelector redesigned as multi-select: near full-screen dialog (98vw × 92vh), checkbox column, "Use Pcs" + "Use m³" editable columns, confirm button, sequential submission
- PackageSelector uses custom Table primitives + ColumnHeaderMenu (not DataEntryTable) to support checkbox + editable columns alongside readonly display columns
- Multi-select state stored in `Map<string, SelectedPackage>` — pre-fills pieces/volume from package values when row is checked
- Client-side validation in PackageSelector before submission; server-side validation in addProductionInput
- ProductionInputsTable built with Table primitives + ColumnHeaderMenu (not DataEntryTable) to support inline editable Pieces/Volume cells + delete button per row
- Sort/filter/collapse features implemented in both PackageSelector and ProductionInputsTable with localStorage persistence
- Volume auto-calculates when dimensions are single numbers; otherwise manual entry
- Production entry page fetches packages+inputs in parallel, only shows inputs section for draft entries
- `(supabase as any)` cast used for queries (generated types may not include new table)
- Ctrl+I keyboard shortcut implemented (document-level keydown listener) with visible `<kbd>` hint on button
- DialogContent required `sm:max-w-[98vw]` to override default `sm:max-w-lg` responsive constraint
- Build passes with 0 TypeScript errors

### File List
- `supabase/migrations/20260125000004_production_inputs.sql` (NEW)
- `apps/portal/src/features/production/types.ts` (MODIFIED — added ProductionInput interface)
- `apps/portal/src/features/production/actions/index.ts` (MODIFIED — added 5 new exports)
- `apps/portal/src/features/production/actions/getAvailablePackages.ts` (NEW)
- `apps/portal/src/features/production/actions/getProductionInputs.ts` (NEW)
- `apps/portal/src/features/production/actions/addProductionInput.ts` (NEW)
- `apps/portal/src/features/production/actions/removeProductionInput.ts` (NEW)
- `apps/portal/src/features/production/actions/updateProductionInput.ts` (NEW)
- `apps/portal/src/features/production/components/PackageSelector.tsx` (NEW)
- `apps/portal/src/features/production/components/ProductionInputsTable.tsx` (NEW)
- `apps/portal/src/features/production/components/ProductionInputsSection.tsx` (NEW)
- `apps/portal/src/features/production/components/DraftProductionList.tsx` (MODIFIED — hydration fix)
- `apps/portal/src/app/(portal)/production/[id]/page.tsx` (MODIFIED — replaced inputs placeholder)
- `packages/ui/src/components/data-entry-table.tsx` (MODIFIED — hydration fix for localStorage)
- `packages/ui/src/components/column-header-menu.tsx` (MODIFIED — filter active dot indicator)

### Change Log
- Created `portal_production_inputs` database table with FK to production entries and packages
- Added `ProductionInput` interface with all package display fields + piecesUsed/volumeM3
- Implemented 5 server actions for CRUD on production inputs with full validation
- Created PackageSelector as multi-select dialog: near full-screen, checkbox column, editable "Use Pcs"/"Use m³" columns, confirm button with sequential submission
- Created ProductionInputsTable with inline editable Pieces/Volume, sort/filter/collapse, and delete per row
- Created ProductionInputsSection client wrapper for the entry page
- Updated production entry page to fetch and display inputs for draft entries
- Added Ctrl+I keyboard shortcut with visible hint on button (AC6)
- [Review Fix] Added ownership verification (created_by check) to addProductionInput, removeProductionInput, updateProductionInput
- [Review Fix] PackageSelector batch add now continues on individual failures, reports partial success/failure
- [Review Fix] ProductionInputsTable volume field now read-only when auto-calculated from dimensions
- [Review Fix] Fixed hydration mismatches in DraftProductionList, DataEntryTable, PackageSelector, ProductionInputsTable
- [Review Fix] Added filter-active dot indicator to ColumnHeaderMenu

