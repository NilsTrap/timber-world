# Story 4.4: Live Production Calculations

Status: done

## Story

As a Producer,
I want to see live calculations as I enter production data,
so that I can verify accuracy before committing.

## Acceptance Criteria

### AC1: Live Calculation Updates
**Given** I am entering production inputs and outputs
**When** I add or modify any line item
**Then** the following calculations update immediately:
- Total Input m³
- Total Output m³
- Outcome % (output/input × 100)
- Waste % (100 - outcome %)

### AC2: ProductionSummary Component
**Given** I am viewing the production form
**When** I look at the summary section
**Then** I see a ProductionSummary component displaying all calculated metrics
**And** metrics are color-coded:
- Outcome % green if >80%
- Outcome % yellow if 60-80%
- Outcome % red if <60%

### AC3: Correct Calculation Values
**Given** inputs total 10 m³ and outputs total 8.5 m³
**When** I view the summary
**Then** Outcome % shows 85%
**And** Waste % shows 15%

### AC4: Empty/Zero State
**Given** I have no inputs entered yet
**When** I view calculations
**Then** metrics show "—" and don't show errors or NaN

## Tasks / Subtasks

- [x] Task 1: Create parent client wrapper for coordination (AC: 1, 2)
  - [x] Create `components/ProductionEntryClient.tsx` — client component wrapping both InputsSection and OutputsSection
  - [x] Lift volume totals up: add `onInputTotalChange` and `onOutputTotalChange` callbacks to the sections
  - [x] Track `inputTotalM3` and `outputTotalM3` in parent state
  - [x] Pass initial values from server-fetched data (so summary shows correct on load)

- [x] Task 2: Add `onTotalChange` callback to ProductionInputsSection (AC: 1)
  - [x] Add `onTotalChange?: (totalM3: number) => void` prop to `ProductionInputsSection`
  - [x] Call `onTotalChange` whenever `inputs` state changes (derive total from inputs array)
  - [x] Use `useEffect` to emit on inputs change, including initial value on mount

- [x] Task 3: Add `onTotalChange` callback to ProductionOutputsSection (AC: 1)
  - [x] Add `onTotalChange?: (totalM3: number) => void` prop to `ProductionOutputsSection`
  - [x] Call `onTotalChange` whenever `rows` state changes (derive total from rows array)
  - [x] Use `useEffect` to emit on rows change, including initial value on mount

- [x] Task 4: Create ProductionSummary component (AC: 2, 3, 4)
  - [x] Create `components/ProductionSummary.tsx` — client component
  - [x] Props: `inputTotalM3: number`, `outputTotalM3: number`
  - [x] Calculate: `outcomePercent = inputTotalM3 > 0 ? (outputTotalM3 / inputTotalM3) * 100 : null`
  - [x] Calculate: `wastePercent = outcomePercent !== null ? 100 - outcomePercent : null`
  - [x] Display 4 metrics in a horizontal card layout (responsive: 2x2 on mobile, 4x1 on desktop)
  - [x] Show "—" when values are null/zero (AC4)
  - [x] Color coding for outcome %: green (>80), yellow (60-80), red (<60)
  - [x] Format volumes with 3 decimal places, Latvian locale (comma separator)
  - [x] Format percentages with 1 decimal place

- [x] Task 5: Update page.tsx to use client wrapper (AC: 1, 2)
  - [x] Replace direct `ProductionInputsSection` / `ProductionOutputsSection` in page.tsx
  - [x] Import and render `ProductionEntryClient` instead, passing all initial data
  - [x] Compute initial totals server-side for instant display (no layout shift)

- [x] Task 6: Verification (AC: all)
  - [x] Build passes: `npx turbo build --filter=@timber/portal`
  - [x] Summary shows correct values when inputs/outputs exist
  - [x] Adding/removing input rows updates summary immediately
  - [x] Adding/removing/editing output rows updates summary immediately
  - [x] Empty state shows "—" not NaN/0/errors
  - [x] Color coding matches thresholds (green >80%, yellow 60-80%, red <60%)
  - [x] Responsive layout works on mobile (2x2) and desktop (4x1)

## Dev Notes

### Architecture Decision: Parent Client Wrapper

The current page is a Server Component with two independent client sections (`ProductionInputsSection` and `ProductionOutputsSection`). Each manages its own state. To compute live cross-section metrics (outcome %, waste %), we need coordination between them.

**Chosen approach:** Create `ProductionEntryClient` — a thin client wrapper that:
1. Receives all initial data from the server (page.tsx)
2. Renders both InputsSection and OutputsSection as children
3. Tracks volume totals via `onTotalChange` callbacks from each section
4. Renders `ProductionSummary` between the header and sections (or between sections)

**Why not context/store:** Overkill for two numbers. Simple callback props keep the coupling minimal and the code easy to understand.

**Why not compute in page.tsx only:** Page is server-rendered — wouldn't update when client-side state changes (adding/removing rows).

### ProductionSummary Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Input m³     Output m³     Outcome %     Waste %           │
│  12,450       10,567        84,9%         15,1%             │
│                             (green)       (muted)           │
└─────────────────────────────────────────────────────────────┘
```

Use a grid: `grid grid-cols-2 md:grid-cols-4 gap-3` with card-style items.

### Color Coding Logic

```typescript
function getOutcomeColor(percent: number): string {
  if (percent > 80) return "text-green-600";
  if (percent >= 60) return "text-yellow-600";
  return "text-red-600";
}
```

### Volume Computation from Rows

Both sections already compute totals internally. The callback approach avoids re-computing:

```typescript
// In ProductionOutputsSection:
useEffect(() => {
  onTotalChange?.(totalM3);
}, [totalM3, onTotalChange]);
```

For inputs, compute from `inputs` array:
```typescript
const totalM3 = inputs.reduce((sum, i) => sum + i.volumeM3, 0);
useEffect(() => {
  onTotalChange?.(totalM3);
}, [totalM3, onTotalChange]);
```

### Initial Values (Prevent Layout Shift)

Compute initial totals server-side in page.tsx so the summary renders with correct values on first paint:
```typescript
const initialInputTotal = initialInputs.reduce((sum, i) => sum + i.volumeM3, 0);
const initialOutputTotal = initialOutputs.reduce((sum, o) => sum + (o.volumeM3 || 0), 0);
```

Pass these as `initialInputTotal` and `initialOutputTotal` to the client wrapper.

### Existing Patterns to Follow

- **Client wrapper pattern:** Same as `ProductionInputsSection` / `ProductionOutputsSection` — receives server data, manages client state
- **Volume formatting:** Latvian locale, 3 decimal places: `new Intl.NumberFormat("lv", { minimumFractionDigits: 3, maximumFractionDigits: 3 })`
- **Percentage formatting:** 1 decimal place: `new Intl.NumberFormat("lv", { minimumFractionDigits: 1, maximumFractionDigits: 1 })`
- **Card styling:** Use `rounded-lg border bg-card p-4` with `text-sm text-muted-foreground` labels and `text-xl font-semibold` values

### Previous Story Intelligence (4-3)

Key learnings from Story 4-3:
1. **`(supabase as any)` cast:** Still used for queries — generated types don't include new tables
2. **Volume calculation:** Shared helpers in `helpers/output-helpers.ts`
3. **Debounced save:** 800ms debounce in OutputsSection — total callback should emit after state update, not after save
4. **Build verification:** Always run `npx turbo build --filter=@timber/portal` after changes
5. **useMemo for totals:** OutputsSection already uses `useMemo` for `totalM3` — the callback should reference this

### Scope Boundaries

**In scope (Story 4.4):**
- ProductionSummary component with 4 metrics
- Live updates when inputs/outputs change
- Color coding for outcome %
- Empty state handling
- Parent client wrapper for coordination

**Out of scope (later stories):**
- Validate & commit button (Story 4.5)
- Confirmation dialog (Story 4.5)
- Warning for unusual outcome % (<50% or >100%) — Story 4.5 validation dialog
- Production history (Story 5.1)

### File Structure

```
apps/portal/src/features/production/
├── components/
│   ├── ProductionEntryClient.tsx        ← NEW (parent wrapper)
│   ├── ProductionSummary.tsx            ← NEW (metrics display)
│   ├── ProductionInputsSection.tsx      ← MODIFY (add onTotalChange prop)
│   ├── ProductionOutputsSection.tsx     ← MODIFY (add onTotalChange prop)
│   └── ...existing...

apps/portal/src/app/(portal)/production/
└── [id]/
    └── page.tsx                         ← MODIFY (use ProductionEntryClient wrapper)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.4]
- [Source: apps/portal/src/features/production/components/ProductionInputsSection.tsx — totalVolumeM3 computation]
- [Source: apps/portal/src/features/production/components/ProductionOutputsSection.tsx — totalM3 useMemo]
- [Source: apps/portal/src/app/(portal)/production/[id]/page.tsx — current page structure]
- [Source: _bmad-output/project-context.md — coding standards, component patterns]
- [Source: _bmad-output/implementation-artifacts/stories/4-3-add-production-outputs.md — previous story learnings]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5

### Completion Notes List
- Created `ProductionEntryClient.tsx` — thin client wrapper coordinating volume totals between inputs, outputs, and summary
- Created `ProductionSummary.tsx` — 4-metric card grid (Input m³, Output m³, Outcome %, Waste %) with color coding
- Added `onTotalChange` callback prop to both `ProductionInputsSection` and `ProductionOutputsSection`
- Both sections emit their volume total via `useEffect` whenever their data changes
- Page computes initial totals server-side to prevent layout shift on first paint
- Color coding: green >80%, yellow 60-80%, red <60% for outcome percentage
- Empty state shows "—" for all metrics when no inputs exist
- Latvian locale formatting: volumes 3 decimals, percentages 1 decimal
- Responsive grid: 2x2 on mobile, 4x1 on desktop
- Build passes with 0 TypeScript errors
- Code review: wrapped `totalVolumeM3` in `useMemo` in InputsSection for consistency with OutputsSection

### File List
- `apps/portal/src/features/production/components/ProductionEntryClient.tsx` (NEW)
- `apps/portal/src/features/production/components/ProductionSummary.tsx` (NEW)
- `apps/portal/src/features/production/components/ProductionInputsSection.tsx` (MODIFIED — added onTotalChange prop + useEffect)
- `apps/portal/src/features/production/components/ProductionOutputsSection.tsx` (MODIFIED — added onTotalChange prop + useEffect)
- `apps/portal/src/app/(portal)/production/[id]/page.tsx` (MODIFIED — uses ProductionEntryClient wrapper, computes initial totals)

### Change Log
- Created ProductionEntryClient wrapper to coordinate live volume totals between inputs and outputs sections
- Created ProductionSummary component with 4 color-coded metrics cards in responsive grid layout
- Added onTotalChange callback prop to ProductionInputsSection and ProductionOutputsSection for parent coordination
- Refactored page.tsx to render single ProductionEntryClient instead of separate sections, computing initial totals server-side
