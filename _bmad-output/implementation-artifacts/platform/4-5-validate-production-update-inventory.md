# Story 4.5: Validate Production & Update Inventory

Status: done

## Story

As a Producer,
I want to validate and commit my production entry,
so that inventory is updated and the production is recorded permanently.

## Acceptance Criteria

### AC1: Validate Button with Confirmation Dialog
**Given** I have a complete production entry (inputs + outputs with volume > 0)
**When** I click "Validate"
**Then** I see a confirmation dialog showing:
- Summary of input packages (count, total m³ to be consumed)
- Summary of output packages (count, total m³ to be created)
- Calculated outcome % and waste %
- Warning if outcome % is unusual (<50% or >100%)

### AC2: Validation Guards
**Given** I have a production entry
**When** I try to validate
**Then** the Validate button is disabled if:
- No inputs have been added
- No outputs have been added
- Any output has volume = 0

### AC3: Commit Production
**Given** I am on the validation confirmation dialog
**When** I confirm by clicking "Validate & Commit"
**Then** the production entry status changes from "draft" to "validated"
**And** input packages have their pieces/volume deducted (or marked consumed if fully used)
**And** output packages are created as new `inventory_packages` records with status "produced"
**And** calculated totals (input m³, output m³, outcome %, waste %) are stored on the entry
**And** `validated_at` timestamp is set
**And** I see success toast "Production validated successfully"
**And** I am redirected to production list page

### AC4: Partial Consumption of Input Packages
**Given** an input package has 100 pieces available
**When** production uses 60 pieces from it
**Then** after validation, the inventory package shows 40 pieces remaining
**And** its volume is reduced proportionally
**And** its status remains "available"

### AC5: Full Consumption of Input Packages
**Given** an input package is fully consumed (all pieces used)
**When** production is validated
**Then** the input package status changes to "consumed"
**And** it no longer appears in available inventory views

### AC6: Output Packages Become Inventory
**Given** production outputs have been defined
**When** production is validated
**Then** each output row becomes a new `inventory_packages` record
**And** the package has status "produced"
**And** the package retains all attributes (product, species, humidity, type, processing, fsc, quality, dimensions, pieces, volume)

## Tasks / Subtasks

- [x] Task 1: Database migration — extend `inventory_packages` for production sources (AC: 6)
  - [x] Make `shipment_id` nullable (currently NOT NULL — outputs from production have no shipment)
  - [x] Add `production_entry_id UUID REFERENCES portal_production_entries(id)` (nullable)
  - [x] Add CHECK constraint: `shipment_id IS NOT NULL OR production_entry_id IS NOT NULL` (every package must have a source)
  - [x] Push migration to remote

- [x] Task 2: Create `validateProduction` server action (AC: 1, 2, 3, 4, 5, 6)
  - [x] Create `actions/validateProduction.ts`
  - [x] Auth check: `getSession()` + `isProducer(session)`
  - [x] Ownership check: `entry.created_by === session.id`
  - [x] Guard: entry must be in "draft" status
  - [x] Guard: must have at least 1 input and 1 output with volume > 0
  - [x] Compute totals: input m³, output m³, outcome %, waste %
  - [x] For each input: deduct pieces/volume from source `inventory_packages` (AC4) or mark consumed (AC5)
  - [x] For each output: INSERT into `inventory_packages` with production_entry_id, status='produced', all attributes (AC6)
  - [x] Generate final package_number for output packages (use process code format: `{processCode}-{seq}`)
  - [x] Update `portal_production_entries`: status='validated', validated_at=now(), store totals
  - [x] Return success with redirect URL
  - [x] Update `actions/index.ts` barrel exports

- [x] Task 3: Create ValidateProductionDialog component (AC: 1, 2)
  - [x] Create `components/ValidateProductionDialog.tsx` — modal dialog with summary
  - [x] Props: `open`, `onOpenChange`, `inputTotalM3`, `outputTotalM3`, `inputCount`, `outputCount`, `onConfirm`, `isPending`
  - [x] Display: input count + total m³, output count + total m³, outcome %, waste %
  - [x] Warning banner if outcome < 50% or > 100% (yellow bg, warning icon)
  - [x] "Validate & Commit" button (primary, with loading state)
  - [x] "Cancel" button (ghost)

- [x] Task 4: Add Validate button to ProductionEntryClient (AC: 1, 2, 3)
  - [x] Add "Validate" button to the summary area or below outputs section
  - [x] Button disabled when: no inputs (inputTotalM3 === 0) or no outputs (outputTotalM3 === 0)
  - [x] On click: open ValidateProductionDialog
  - [x] Track input/output counts from sections (add count callbacks or derive from initial data)
  - [x] On confirm: call `validateProduction` action, show toast, redirect to `/production`

- [x] Task 5: Handle inventory deduction logic (AC: 4, 5)
  - [x] For each production input row:
    - Fetch current `inventory_packages` record by package_id
    - If `pieces_used` equals available pieces → set status = 'consumed'
    - If `pieces_used` < available pieces → reduce pieces, recalculate volume proportionally
  - [x] Handle edge case: package has no countable pieces (pieces_used = NULL) → use volume ratio for deduction
  - [x] All updates in a single transaction-like sequence (fail fast on errors)

- [x] Task 6: Verification (AC: all)
  - [x] Build passes: `npx turbo build --filter=@timber/portal`
  - [x] Validate button disabled when no inputs or outputs
  - [x] Dialog shows correct summary values
  - [x] Warning appears for unusual outcome %
  - [x] After validation: entry status is "validated"
  - [x] After validation: input packages have reduced pieces/volume or consumed status
  - [x] After validation: output packages appear as new inventory with status "produced"
  - [x] After validation: calculated totals stored on production entry
  - [x] After validation: redirect to production list with success toast
  - [x] Draft entry page no longer shows editable sections after validation

## Dev Notes

### Architecture: Validate & Commit Flow

The validation is a single atomic server action that:
1. Verifies preconditions (auth, ownership, draft status, has inputs/outputs)
2. Computes final metrics
3. Deducts from input inventory packages
4. Creates new inventory packages from outputs
5. Updates the production entry status + stores metrics
6. Returns success for client-side redirect

```typescript
export async function validateProduction(
  productionEntryId: string
): Promise<ActionResult<{ redirectUrl: string }>> {
  // 1. Auth + ownership + status checks
  // 2. Fetch all inputs + outputs
  // 3. Compute totals
  // 4. For each input: deduct from inventory_packages
  // 5. For each output: create inventory_packages record
  // 6. Update production_entries: status, validated_at, totals
  // 7. Return { redirectUrl: "/production" }
}
```

### Database Migration: Production-Sourced Packages

Currently `inventory_packages.shipment_id` is NOT NULL. Production outputs need to become inventory without a shipment. The migration:

```sql
-- Make shipment_id nullable
ALTER TABLE inventory_packages ALTER COLUMN shipment_id DROP NOT NULL;

-- Add production source reference
ALTER TABLE inventory_packages
  ADD COLUMN production_entry_id UUID REFERENCES portal_production_entries(id);

-- Every package must have either a shipment or production source
ALTER TABLE inventory_packages
  ADD CONSTRAINT chk_package_source
  CHECK (shipment_id IS NOT NULL OR production_entry_id IS NOT NULL);
```

Also need to update the UNIQUE constraint on `(shipment_id, package_sequence)` since shipment_id can now be NULL:
```sql
-- Drop the existing unique constraint that includes nullable shipment_id
-- Production packages use a different uniqueness: (production_entry_id, package_sequence)
ALTER TABLE inventory_packages DROP CONSTRAINT IF EXISTS inventory_packages_shipment_id_package_sequence_key;

-- Re-add for shipment packages only (partial unique index)
CREATE UNIQUE INDEX idx_inventory_packages_shipment_seq
  ON inventory_packages(shipment_id, package_sequence) WHERE shipment_id IS NOT NULL;

CREATE UNIQUE INDEX idx_inventory_packages_production_seq
  ON inventory_packages(production_entry_id, package_sequence) WHERE production_entry_id IS NOT NULL;
```

### Input Deduction Logic

```typescript
for (const input of inputs) {
  const pkg = await getPackage(input.package_id);

  if (input.pieces_used && pkg.pieces) {
    const currentPieces = parseInt(pkg.pieces);
    const remaining = currentPieces - input.pieces_used;

    if (remaining <= 0) {
      // Fully consumed
      await updatePackage(pkg.id, { status: 'consumed', pieces: '0', volume_m3: 0 });
    } else {
      // Partial: reduce pieces and recalculate volume proportionally
      const ratio = remaining / currentPieces;
      const newVolume = pkg.volume_m3 * ratio;
      await updatePackage(pkg.id, { pieces: String(remaining), volume_m3: newVolume });
    }
  } else {
    // No countable pieces — use volume deduction
    const newVolume = Math.max(0, (pkg.volume_m3 || 0) - input.volume_m3);
    if (newVolume <= 0) {
      await updatePackage(pkg.id, { status: 'consumed', volume_m3: 0 });
    } else {
      await updatePackage(pkg.id, { volume_m3: newVolume });
    }
  }
}
```

### Output Package Creation

For each output row, create a new `inventory_packages` record:
```typescript
const outputPackage = {
  production_entry_id: productionEntryId,
  shipment_id: null,  // No shipment for production outputs
  package_number: output.package_number,  // Already formatted as {code}-001
  package_sequence: index + 1,
  product_name_id: output.product_name_id,
  wood_species_id: output.wood_species_id,
  humidity_id: output.humidity_id,
  type_id: output.type_id,
  processing_id: output.processing_id,
  fsc_id: output.fsc_id,
  quality_id: output.quality_id,
  thickness: output.thickness,
  width: output.width,
  length: output.length,
  pieces: output.pieces,
  volume_m3: output.volume_m3,
  volume_is_calculated: false,
  status: 'produced',
};
```

### Warning Thresholds

Unusual outcome percentage triggers a warning (not a block):
- Outcome < 50% → "Very low output ratio — are inputs/outputs correct?"
- Outcome > 100% → "Output exceeds input — are volumes correct?"

### Client-Side Validation Guards

The Validate button should be disabled when:
```typescript
const canValidate = inputTotalM3 > 0 && outputTotalM3 > 0;
```

### Post-Validation Page Behavior

After validation, the entry status becomes "validated". The page already conditionally renders sections with `isDraft` check. Validated entries will show a static summary (no editable sections). For MVP, the redirect to `/production` list is sufficient.

### Redirect After Validation

Use Next.js `useRouter` for client-side redirect:
```typescript
import { useRouter } from "next/navigation";
const router = useRouter();
// After successful validation:
router.push("/production");
```

### Previous Story Intelligence (4-4)

Key learnings from Story 4-4:
1. **ProductionEntryClient** wrapper coordinates state between sections
2. **`onTotalChange` callbacks** emit totals — can also add count callbacks or derive counts
3. **`useMemo` for computed values** — use for any derived calculations
4. **Server-side initial values** — compute on server to prevent layout shift
5. **Build verification** — always run after changes

### Existing Patterns to Follow

- **Server Actions:** `createClient`, `getSession()`, `isProducer()`, return `ActionResult<T>`, UUID validation, ownership check
- **Dialog pattern:** Use `@timber/ui` Dialog/AlertDialog components (Radix-based)
- **Toast notifications:** `toast.success()` / `toast.error()` from sonner
- **Client redirect:** `useRouter().push()` from `next/navigation`
- **`(supabase as any)` cast:** Still needed for tables not in generated types
- **Loading state:** `useTransition` + `isPending` for mutation buttons

### Scope Boundaries

**In scope (Story 4.5):**
- Validate button + confirmation dialog
- Commit: update entry status, deduct inputs, create output inventory
- Warning for unusual metrics
- Validation guards (no inputs/outputs)
- Redirect to production list after commit
- Store calculated totals on entry

**Out of scope (later stories):**
- Production history table with validated entries (Story 5.1)
- Edit production entry (Story 5.2)
- Undo/revert validation
- Audit trail of inventory changes

### File Structure

```
apps/portal/src/features/production/
├── actions/
│   ├── validateProduction.ts              ← NEW
│   └── index.ts                           ← MODIFY (add export)
├── components/
│   ├── ValidateProductionDialog.tsx       ← NEW
│   ├── ProductionEntryClient.tsx          ← MODIFY (add Validate button + dialog)
│   └── ...existing...

supabase/migrations/
└── 20260125000007_inventory_production_source.sql  ← NEW
```

### References

- [Source: _bmad-output/planning-artifacts/platform/epics.md#Story 4.5]
- [Source: supabase/migrations/20260122000002_inventory_model_v2.sql — inventory_packages schema]
- [Source: supabase/migrations/20260125000004_production_inputs.sql — production_inputs with pieces_used]
- [Source: supabase/migrations/20260122000001_portal_mvp_schema.sql — portal_production_entries with validated_at, totals]
- [Source: apps/portal/src/features/production/types.ts — ProductionEntry, ProductionInput, ProductionOutput types]
- [Source: apps/portal/src/features/production/components/ProductionEntryClient.tsx — parent wrapper with totals]
- [Source: _bmad-output/project-context.md — coding standards, ActionResult pattern]
- [Source: _bmad-output/implementation-artifacts/platform/4-4-live-production-calculations.md — previous story learnings]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5

### Completion Notes List
- Created database migration making `shipment_id` nullable and adding `production_entry_id` FK with CHECK constraint ensuring every package has a source
- Replaced the existing UNIQUE constraint with partial unique indexes for shipment and production packages
- Created `validateProduction` server action with full atomic flow: auth/ownership checks, guards, totals computation, input deduction, output creation, entry status update
- Input deduction handles both piece-based (proportional volume reduction) and volume-only consumption
- Fully consumed packages get `status: 'consumed'` with zeroed values; partially consumed retain `'available'` status
- Created `ValidateProductionDialog` with AlertDialog, summary metrics (2x2 grid), and warning banner for unusual outcome %
- Added Validate button to `ProductionEntryClient` with `disabled` state and Ctrl+Enter keyboard shortcut (hint displayed on button)
- Added `onCountChange` callbacks to both InputsSection and OutputsSection for dialog count display
- Success flow: toast notification + redirect to `/production` list
- Error flow: toast error + dialog closes
- Build passes with 0 TypeScript errors
- Fixed: Production list now shows both draft and validated entries (was filtering only drafts)
- Fixed: Producer inventory query now includes production-sourced packages via second query (inner join on shipments excluded NULL shipment_id rows)
- Fixed: Available packages query also includes production-sourced packages and excludes consumed ones

### File List
- `supabase/migrations/20260125000007_inventory_production_source.sql` (NEW)
- `apps/portal/src/features/production/actions/validateProduction.ts` (NEW)
- `apps/portal/src/features/production/actions/index.ts` (MODIFIED — added validateProduction export)
- `apps/portal/src/features/production/components/ValidateProductionDialog.tsx` (NEW)
- `apps/portal/src/features/production/components/ProductionEntryClient.tsx` (MODIFIED — added Validate button, dialog, keyboard shortcut, count state, readOnly prop)
- `apps/portal/src/features/production/components/ProductionInputsSection.tsx` (MODIFIED — added onCountChange prop, readOnly prop, Ctrl+I guard)
- `apps/portal/src/features/production/components/ProductionOutputsSection.tsx` (MODIFIED — added onCountChange prop, readOnly prop, Ctrl+O guard)
- `apps/portal/src/features/production/components/ProductionOutputsTable.tsx` (MODIFIED — passes readOnly to DataEntryTable)
- `apps/portal/src/features/production/components/ProductionInputsTable.tsx` (MODIFIED — readOnly mode, fixed collapse arrows)
- `apps/portal/src/features/production/components/DraftProductionList.tsx` (MODIFIED — shows both draft+validated with conditional badge)
- `apps/portal/src/features/production/components/PackageSelector.tsx` (MODIFIED — volume precision tolerance, fixed collapse arrows)
- `apps/portal/src/features/production/actions/getDraftProductions.ts` (MODIFIED — removed status=draft filter)
- `apps/portal/src/features/production/actions/getAvailablePackages.ts` (MODIFIED — includes production packages, excludes consumed)
- `apps/portal/src/features/production/actions/addProductionInput.ts` (MODIFIED — volume precision tolerance, draft status guard)
- `apps/portal/src/features/production/actions/updateProductionInput.ts` (MODIFIED — volume precision tolerance, draft status guard)
- `apps/portal/src/features/inventory/actions/getProducerPackages.ts` (MODIFIED — includes production packages, excludes consumed)
- `apps/portal/src/app/(portal)/production/[id]/page.tsx` (MODIFIED — always render client, readOnly mode for validated entries)

### Change Log
- Added migration to support production-sourced inventory packages (nullable shipment_id, new production_entry_id FK, CHECK constraint)
- Created validateProduction server action implementing the full commit flow: guards, metrics, input deduction, output creation, status update
- Created ValidateProductionDialog confirmation dialog with summary metrics and unusual-outcome warnings
- Added Validate button with disabled state and Ctrl+Enter shortcut to ProductionEntryClient
- Added onCountChange callbacks to both input/output sections for count tracking
- Fixed production list to show all entries (not just drafts) with conditional status badges
- Fixed inventory queries to include production-sourced packages and exclude consumed ones
- Added read-only mode for validated entries (page.tsx, all sub-components)
- Fixed volume precision tolerance in addProductionInput/updateProductionInput/PackageSelector
- Fixed collapse arrow inconsistency in ProductionInputsTable and PackageSelector
- Fixed Thickness column label abbreviation in ProductionInputsTable
- [Code Review] Added atomic status lock (draft→validating→validated) to prevent race conditions
- [Code Review] Added revertStatus() on all failure paths for improved atomicity
- [Code Review] Added over-consumption guards in validateProduction (pieces and volume checks)
- [Code Review] Added draft status guard to addProductionInput and updateProductionInput
- [Code Review] Guarded Ctrl+O shortcut with readOnly check in ProductionOutputsSection
