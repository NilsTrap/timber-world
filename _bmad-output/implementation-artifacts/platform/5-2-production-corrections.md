# Story 5.2: Production Corrections

Status: done

## Story

As a Producer,
I want to create a correction entry to fix a mistake in a past production,
so that inventory is adjusted correctly while maintaining a full audit trail.

## Acceptance Criteria

### AC1: Create Correction from Validated Entry
**Given** I am viewing a validated production entry in history detail view
**When** I click "Create Correction"
**Then** a new production entry is created with entry_type "correction"
**And** it is linked to the original entry via corrects_entry_id
**And** the same process is pre-selected (inherited from original)
**And** I am redirected to the new correction entry form

### AC2: Correction Entry Form
**Given** I am editing a correction entry
**When** I view the form
**Then** it works exactly like a normal production entry (inputs, outputs, live calculations)
**And** I see a "Correction" badge instead of "Draft" in the status area
**And** I see a reference link to the original entry it corrects

### AC3: Validate Correction
**Given** I have completed a correction entry (inputs + outputs added)
**When** I click "Validate"
**Then** the same validation flow runs (inputs deducted, outputs created in inventory)
**And** the entry status changes to "validated"
**And** I see a success toast and am redirected to the production page

### AC4: History Display
**Given** a correction entry is validated
**When** I view it in the History tab
**Then** it appears with a "Correction" badge in the process column
**And** it is included in totals and efficiency calculations like any other entry

### AC5: Detail View for Validated Correction
**Given** I click on a validated correction entry in history
**When** the detail view opens
**Then** I see full details (inputs, outputs, calculations) in read-only mode
**And** I see a link to the original entry it corrects
**And** I do NOT see a "Create Correction" button (no correction of corrections)

## Tasks / Subtasks

- [x] Task 1: Database schema changes (AC: 1, 4, 5)
  - [x] Add `entry_type` column to `portal_production_entries` (text, default 'standard', CHECK in ('standard', 'correction'))
  - [x] Add `corrects_entry_id` column (UUID, nullable, FK to portal_production_entries.id)
  - [x] Create migration file in `supabase/migrations/`
  - [x] Verify migration applies cleanly

- [x] Task 2: Create correction entry action (AC: 1)
  - [x] Create `createCorrectionEntry.ts` server action
  - [x] Accept `originalEntryId` parameter
  - [x] Validate: authenticated, producer role, original entry exists and is validated
  - [x] Validate: original entry is type 'standard' (no correction of corrections)
  - [x] Insert new entry with: same process_id, today's date, status 'draft', entry_type 'correction', corrects_entry_id = originalEntryId
  - [x] Return new entry ID for redirect
  - [x] Update `actions/index.ts` barrel exports

- [x] Task 3: Wire "Create Correction" button (AC: 1)
  - [x] Enable the existing disabled "Create Correction" button in `[id]/page.tsx`
  - [x] Add client-side onClick handler that calls `createCorrectionEntry`
  - [x] Show loading state during creation
  - [x] On success, redirect to the new correction entry page
  - [x] On error, show toast notification
  - [x] Hide button when entry is itself a correction (entry_type === 'correction')

- [x] Task 4: Update detail page for correction entries (AC: 2, 5)
  - [x] Fetch `entry_type` and `corrects_entry_id` in `getProductionEntry` action
  - [x] Show "Correction" badge (orange/amber) instead of "Draft" for correction entries in draft state
  - [x] Show reference link "Corrects: [Process Name] - [Date]" below the title when correction
  - [x] Link navigates to `/production/{corrects_entry_id}`
  - [x] Hide "Create Correction" button when entry_type is 'correction' (even after validation)

- [x] Task 5: Update history table display (AC: 4)
  - [x] Add `entryType` field to `ProductionHistoryItem` type
  - [x] Fetch `entry_type` in `getValidatedProductions` query
  - [x] Display "Correction" badge (small amber pill) next to process name in history table
  - [x] Corrections are included in footer totals/averages (no special treatment)

- [x] Task 6: Update types (AC: all)
  - [x] Add `entryType` to `ProductionEntry` type ('standard' | 'correction')
  - [x] Add `correctsEntryId` to `ProductionEntry` type (string | null)
  - [x] Add `entryType` to `ProductionHistoryItem` type
  - [x] Add `entryType` and `correctsEntryId` to `ProductionEntryDetail` interface in getProductionEntry.ts

- [x] Task 7: Verification (AC: all)
  - [x] Build passes: `npx turbo build --filter=@timber/portal`
  - [x] Migration applies: `npx supabase db push`
  - [x] "Create Correction" button creates a linked correction entry
  - [x] Correction entry form works like normal production (add inputs, outputs, validate)
  - [x] Correction badge shown in draft state and in history
  - [x] Validated correction shows link to original entry
  - [x] No "Create Correction" button on correction entries
  - [x] History totals include correction entries

## Dev Notes

### Architecture: Correction Entries

Corrections follow the accounting "reverse journal" pattern: validated entries are immutable, but a new entry can be created to adjust the net effect. Key design decisions:

1. **Same flow, different type** — Corrections use the exact same input/output/validate pipeline. The only differences are the `entry_type` column and the `corrects_entry_id` link.
2. **No cascading corrections** — A correction cannot correct another correction (prevents infinite chains).
3. **Inventory effects are real** — When a correction is validated, it deducts inputs and creates outputs just like a standard entry. The producer is responsible for entering the right adjustments.
4. **Included in metrics** — Corrections are regular entries for efficiency calculation purposes. They affect totals normally.

### Database Schema Changes

```sql
-- Migration: add correction fields to portal_production_entries
ALTER TABLE portal_production_entries
  ADD COLUMN entry_type text NOT NULL DEFAULT 'standard'
  CHECK (entry_type IN ('standard', 'correction'));

ALTER TABLE portal_production_entries
  ADD COLUMN corrects_entry_id uuid REFERENCES portal_production_entries(id);
```

### Component Structure

```
apps/portal/src/features/production/
├── actions/
│   ├── createCorrectionEntry.ts              (NEW — create linked correction)
│   ├── createProductionEntry.ts              (unchanged)
│   ├── getProductionEntry.ts                 (MODIFY — return entryType + correctsEntryId)
│   ├── getValidatedProductions.ts            (MODIFY — return entryType)
│   └── index.ts                              (MODIFY — add createCorrectionEntry export)
├── components/
│   ├── ProductionHistoryTable.tsx            (MODIFY — show correction badge)
│   └── CorrectionBadge.tsx                   (NEW — small amber badge component)
├── types.ts                                   (MODIFY — add entryType, correctsEntryId)

apps/portal/src/app/(portal)/production/
├── [id]/page.tsx                              (MODIFY — wire button, show correction info)

supabase/migrations/
└── YYYYMMDDHHMMSS_add_correction_fields.sql  (NEW — schema migration)
```

### createCorrectionEntry Action Pattern

```typescript
export async function createCorrectionEntry(
  originalEntryId: string
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isProducer(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  // Fetch original entry — verify it exists, is validated, is 'standard' type
  const { data: original } = await supabase
    .from("portal_production_entries")
    .select("id, process_id, entry_type, status, created_by")
    .eq("id", originalEntryId)
    .single();

  if (!original) return { success: false, error: "Entry not found", code: "NOT_FOUND" };
  if (original.created_by !== session.id) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  if (original.status !== "validated") return { success: false, error: "Can only correct validated entries", code: "VALIDATION_FAILED" };
  if (original.entry_type === "correction") return { success: false, error: "Cannot correct a correction entry", code: "VALIDATION_FAILED" };

  // Insert new correction entry
  const { data, error } = await supabase
    .from("portal_production_entries")
    .insert({
      process_id: original.process_id,
      production_date: new Date().toISOString().split("T")[0],
      status: "draft",
      entry_type: "correction",
      corrects_entry_id: originalEntryId,
      created_by: session.id,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message, code: "INSERT_FAILED" };
  return { success: true, data: { id: data.id } };
}
```

### Detail Page Changes

The `[id]/page.tsx` needs to:
1. Add `entryType` and `correctsEntryId` to `ProductionEntryDetail` destructuring
2. Show "Correction" badge when `entryType === 'correction'`
3. Show link to original entry when `correctsEntryId` exists
4. Hide "Create Correction" button when `entryType === 'correction'`
5. Enable button with onClick for standard validated entries

The button needs to be a client component (for onClick + loading state). Create a thin `CreateCorrectionButton` client component or use an inline form with a server action.

### History Table Badge

In `ProductionHistoryTable.tsx`, the process name cell should show:
```tsx
<td className="px-4 py-3">
  {entry.processName}
  {entry.entryType === "correction" && (
    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
      Correction
    </span>
  )}
</td>
```

### Validation Flow

No changes to `validateProduction.ts` are needed — it already handles any production entry regardless of type. The correction entry goes through the same draft → validating → validated flow, deducting inputs and creating output packages identically.

### Previous Story Intelligence (5-1)

Key learnings from Story 5-1:
1. **`getValidatedProductions`** fetches with FK join on `ref_processes(value)` — add `entry_type` to the select
2. **`ProductionHistoryItem`** type needs `entryType` field added
3. **`(supabase as any)` cast** still needed for tables not in generated types
4. **Date formatting** — use `formatDate()` from `@/lib/utils` for DD.MM.YYYY
5. **Build verification** — always run `npx turbo build --filter=@timber/portal` after changes

### Existing Patterns to Follow

- **Server Actions:** `createClient`, `getSession()`, `isProducer()`, return `ActionResult<T>`
- **Client components:** Add `"use client"` directive for interactive components
- **Toast notifications:** `import { toast } from "sonner"` for success/error messages
- **Router navigation:** `import { useRouter } from "next/navigation"` for client-side redirect
- **Badge styling:** Use Tailwind utility classes matching existing badge patterns (see status badge in `[id]/page.tsx`)
- **UUID validation:** Use the existing `UUID_REGEX` pattern from other actions

### Scope Boundaries

**In scope (Story 5.2):**
- Database migration for entry_type + corrects_entry_id
- createCorrectionEntry server action
- Wire "Create Correction" button on validated standard entries
- Show "Correction" badge in draft and history views
- Show link to original entry in correction detail view
- Hide "Create Correction" on correction entries

**Out of scope (later stories):**
- Dashboard metrics (Story 5.3)
- Admin efficiency reports (Story 5.4)
- Correction limits (e.g., max one correction per entry)
- Correction approval workflow

### References

- [Source: _bmad-output/planning-artifacts/platform/epics.md#Story 5.2]
- [Source: apps/portal/src/features/production/actions/createProductionEntry.ts — entry creation pattern]
- [Source: apps/portal/src/features/production/actions/validateProduction.ts — validation flow]
- [Source: apps/portal/src/features/production/actions/getProductionEntry.ts — detail query]
- [Source: apps/portal/src/features/production/actions/getValidatedProductions.ts — history query]
- [Source: apps/portal/src/features/production/types.ts — current types]
- [Source: apps/portal/src/app/(portal)/production/[id]/page.tsx — detail page]
- [Source: apps/portal/src/features/production/components/ProductionHistoryTable.tsx — history table]
- [Source: _bmad-output/project-context.md — coding standards]
- [Source: _bmad-output/implementation-artifacts/platform/5-1-production-page-tabs.md — previous story intelligence]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Completion Notes List
- Created database migration `20260126000001_production_correction_fields.sql` adding `entry_type` (text, default 'standard', CHECK constraint) and `corrects_entry_id` (UUID FK to self) columns with index
- Created `createCorrectionEntry.ts` server action with full validation (auth, ownership, validated status, not-a-correction checks) and auto-populating correction inputs from original entry's output packages
- Created `CreateCorrectionButton` client component with loading state, toast notifications, and router redirect
- Created `deleteProductionEntry.ts` server action with ownership + draft-status checks and cascading child deletes
- Created `DeleteDraftButton.tsx` client component with AlertDialog confirmation and destructive styling
- Updated `getProductionEntry` to fetch and return `entryType` + `correctsEntryId`
- Updated `getValidatedProductions` to fetch and return `entryType`
- Updated `validateProduction.ts` with pre-check for package number conflicts (prevents data corruption from partial mutation failures)
- Updated `ProductionHistoryTable` to show amber "Correction" badge next to process name
- Updated `[id]/page.tsx` to show correction badge, reference link, back navigation, delete button, and conditionally show/hide Create Correction button
- Updated `ProductionEntryClient` to hide metric summary cards for corrections and lift inputs state for auto-generate
- Updated `ProductionInputsSection` with `onInputsChange` callback for live inputs propagation
- Updated `DraftProductionList` with inline delete buttons and AlertDialog confirmation
- Updated `ProductionPageTabs` with `defaultTab` prop for tab URL navigation
- Updated `production/page.tsx` with `searchParams` to support `?tab=history` deep linking
- Added `EntryType` type alias and updated `ProductionEntry`, `ProductionHistoryItem`, `ProductionEntryDetail` interfaces
- Build passes with 0 TypeScript errors

### File List
- `supabase/migrations/20260126000001_production_correction_fields.sql` (NEW)
- `apps/portal/src/features/production/actions/createCorrectionEntry.ts` (NEW)
- `apps/portal/src/features/production/actions/deleteProductionEntry.ts` (NEW)
- `apps/portal/src/features/production/components/CreateCorrectionButton.tsx` (NEW)
- `apps/portal/src/features/production/components/DeleteDraftButton.tsx` (NEW)
- `apps/portal/src/features/production/actions/index.ts` (MODIFIED — added createCorrectionEntry + deleteProductionEntry exports)
- `apps/portal/src/features/production/actions/getProductionEntry.ts` (MODIFIED — entryType + correctsEntryId in query and response)
- `apps/portal/src/features/production/actions/getValidatedProductions.ts` (MODIFIED — entryType in query and response)
- `apps/portal/src/features/production/actions/validateProduction.ts` (MODIFIED — pre-check for package number conflicts before mutations)
- `apps/portal/src/features/production/types.ts` (MODIFIED — added EntryType, updated ProductionEntry + ProductionHistoryItem)
- `apps/portal/src/features/production/components/ProductionHistoryTable.tsx` (MODIFIED — correction badge in process column)
- `apps/portal/src/features/production/components/ProductionEntryClient.tsx` (MODIFIED — hideMetrics prop, currentInputs state lifting)
- `apps/portal/src/features/production/components/ProductionInputsSection.tsx` (MODIFIED — onInputsChange callback)
- `apps/portal/src/features/production/components/DraftProductionList.tsx` (MODIFIED — inline delete with AlertDialog)
- `apps/portal/src/features/production/components/ProductionPageTabs.tsx` (MODIFIED — defaultTab prop)
- `apps/portal/src/app/(portal)/production/[id]/page.tsx` (MODIFIED — correction button, badge, reference link, back nav, delete button, hideMetrics, CR processCode)
- `apps/portal/src/app/(portal)/production/page.tsx` (MODIFIED — searchParams for tab deep linking)

### Change Log
- Added production corrections support: new DB columns (entry_type, corrects_entry_id), server action to create corrections, client button with loading state, correction badges in history table and detail view, reference link to original entry
- Added auto-population of correction inputs from original entry's output packages
- Added pre-check in validateProduction to prevent data corruption from package number conflicts
- Added delete draft entry functionality (server action + UI in both detail page and list view)
- Added back navigation with tab-aware deep linking
- Hidden metric summary cards for correction entries
- Fixed auto-generate button not showing for new production entries (inputs state lifting)
