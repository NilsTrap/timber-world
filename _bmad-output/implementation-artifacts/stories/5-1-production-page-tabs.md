# Story 5.1: Production Page Tabs (Active + History)

Status: review

## Story

As a Producer,
I want to view my production history alongside active entries,
so that I can review past production entries without navigating away from the Production section.

## Acceptance Criteria

### AC1: Tab Layout
**Given** I am logged in as Producer
**When** I navigate to Production
**Then** I see two tabs: "Active" and "History"
**And** the "Active" tab shows the new production form and draft entries (current behavior)
**And** the "History" tab shows validated production entries

### AC2: History Table Columns
**Given** I am on the "History" tab
**When** I view the history table
**Then** I see columns: Date, Process Type, Input m³, Output m³, Outcome %, Waste %
**And** entries are sorted by date (newest first) by default
**And** I can click column headers to sort by any column

### AC3: Date Filter
**Given** I am viewing production history
**When** I use the date filter
**Then** I can filter to a specific date range
**And** the table updates to show only matching entries

### AC4: Process Filter
**Given** I am viewing production history
**When** I use the process filter dropdown
**Then** I can filter by process type
**And** the table shows only entries for that process

### AC5: History Row Click → Detail View
**Given** I click on a history row
**When** the detail view opens
**Then** I see full details: all input lines, all output lines, calculations (read-only)
**And** I see a "Create Correction" button (for Story 5.2 — placeholder only in this story)

### AC6: Empty State
**Given** no validated entries exist
**When** I view the "History" tab
**Then** I see an empty state "No production history yet"

### AC7: Remove Sidebar "History" Item
**Given** the sidebar currently shows a "History" item for producers
**When** this story is implemented
**Then** the "History" sidebar item is removed (history lives inside the Production page tabs)

## Tasks / Subtasks

- [x] Task 1: Separate Active and History data fetching (AC: 1, 2)
  - [x] Create `getValidatedProductions` server action — fetches validated entries with totals
  - [x] Rename/refactor `getDraftProductions` to only fetch draft entries (currently fetches all)
  - [x] Define `ProductionHistoryItem` type with: id, processName, productionDate, totalInputM3, totalOutputM3, outcomePercentage, wastePercentage, validatedAt
  - [x] Update `actions/index.ts` barrel exports

- [x] Task 2: Create Production Page Tabs layout (AC: 1, 7)
  - [x] Create `ProductionPageTabs` client component with Tabs from `@timber/ui`
  - [x] Move "New Production" form + DraftProductionList into "Active" tab content
  - [x] Add "History" tab content placeholder
  - [x] Update `page.tsx` to use ProductionPageTabs (fetch both drafts and history data on server)
  - [x] Remove "History" from PRODUCER_NAV_ITEMS in `SidebarWrapper.tsx`

- [x] Task 3: Create History Table component (AC: 2)
  - [x] Create `ProductionHistoryTable` client component
  - [x] Display columns: Date (formatted), Process, Input m³, Output m³, Outcome %, Waste %
  - [x] Use standard HTML table with Tailwind styling (not DataEntryTable — this is a simple read-only list)
  - [x] Format: dates as locale date, m³ to 3 decimals, percentages to 1 decimal with % suffix
  - [x] Default sort: newest first (by `productionDate`)
  - [x] Column header click toggles sort (asc/desc)

- [x] Task 4: Add client-side filtering (AC: 3, 4)
  - [x] Add process type filter dropdown above table (all processes from data)
  - [x] Add date range filter (from/to date inputs)
  - [x] Filter state managed in component useState
  - [x] Filters apply client-side on the fetched data array
  - [x] Show "Clear Filters" button when filters applied

- [x] Task 5: Empty state (AC: 6)
  - [x] Show "No production history yet" centered text when history array is empty
  - [x] Also handle "no results" when filters yield 0 matches ("No entries match your filters")

- [x] Task 6: History row navigation (AC: 5)
  - [x] Each history row is a clickable link to `/production/{id}`
  - [x] The existing `[id]/page.tsx` already renders validated entries in read-only mode
  - [x] No changes needed to the detail page itself for this story (correction button is Story 5.2)

- [x] Task 7: Verification (AC: all)
  - [x] Build passes: `npx turbo build --filter=@timber/portal`
  - [x] Production page shows two tabs (Active + History)
  - [x] Active tab shows new production form + draft entries (existing behavior preserved)
  - [x] History tab shows validated entries with correct columns
  - [x] Column sort works (click toggles asc/desc)
  - [x] Process filter dropdown works
  - [x] Date range filter works
  - [x] Clicking a history row navigates to read-only detail view
  - [x] Empty state shown when no history exists
  - [x] Sidebar no longer shows "History" item for producers

## Dev Notes

### Architecture: Tab-Based Production Page

The production page transitions from a single-view page to a tabbed layout. Key design decisions:

1. **Server-side data fetching** — Both active drafts and validated history are fetched in `page.tsx` (server component) and passed as props to the client tab component.
2. **Client-side tabs** — Uses `Tabs` from `@timber/ui` (Radix-based) for tab switching without page reload.
3. **Client-side filtering** — Filters are local state, not URL params. History data is typically small enough (<100 entries) to filter client-side. If this grows, consider server-side pagination later.
4. **Simple table for history** — The history table is a simple styled `<table>` (not DataEntryTable), since it's a flat read-only list with no dropdowns, no collapse, and different column types (metrics, not package attributes).

### Component Structure

```
apps/portal/src/app/(portal)/production/page.tsx  (MODIFY — add tabs layout, fetch history)
apps/portal/src/features/production/
├── actions/
│   ├── getDraftProductions.ts                    (MODIFY — filter to draft only)
│   ├── getValidatedProductions.ts                (NEW — fetch validated with totals)
│   └── index.ts                                  (MODIFY — add export)
├── components/
│   ├── ProductionPageTabs.tsx                    (NEW — tabs wrapper)
│   ├── ProductionHistoryTable.tsx                (NEW — history table with sort/filter)
│   └── DraftProductionList.tsx                   (unchanged — still renders draft list)
└── types.ts                                      (MODIFY — add ProductionHistoryItem)

apps/portal/src/components/layout/SidebarWrapper.tsx  (MODIFY — remove History nav item)
```

### Data Model for History Items

```typescript
export interface ProductionHistoryItem {
  id: string;
  processName: string;
  productionDate: string;
  totalInputM3: number;
  totalOutputM3: number;
  outcomePercentage: number;
  wastePercentage: number;
  validatedAt: string;
}
```

Query pattern for `getValidatedProductions`:
```typescript
const { data } = await supabase
  .from("portal_production_entries")
  .select("id, production_date, total_input_m3, total_output_m3, outcome_percentage, waste_percentage, validated_at, ref_processes(value)")
  .eq("created_by", session.id)
  .eq("status", "validated")
  .order("validated_at", { ascending: false });
```

### Tabs Component Usage

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@timber/ui";

<Tabs defaultValue="active">
  <TabsList>
    <TabsTrigger value="active">Active</TabsTrigger>
    <TabsTrigger value="history">History</TabsTrigger>
  </TabsList>
  <TabsContent value="active">
    {/* New Production form + DraftProductionList */}
  </TabsContent>
  <TabsContent value="history">
    <ProductionHistoryTable entries={historyEntries} />
  </TabsContent>
</Tabs>
```

### getDraftProductions Refactor

Currently `getDraftProductions` fetches ALL entries (draft + validated). Refactor to only fetch drafts:
```typescript
.eq("status", "draft")  // Add this filter back
```

The validated entries will be served by the new `getValidatedProductions` action.

### History Table Sorting

Client-side sort with state:
```typescript
const [sortColumn, setSortColumn] = useState<string>("validatedAt");
const [sortAsc, setSortAsc] = useState(false); // newest first by default
```

Column headers toggle sort direction when clicked. Use chevron icons to indicate current sort.

### Filters

**Process filter:** A `<select>` dropdown populated from unique process names in the data.

**Date range:** Two `<input type="date">` fields (from/to). Compare against `productionDate`.

Both filters are additive (AND logic).

### Sidebar Update

Remove the History nav item from `PRODUCER_NAV_ITEMS` in `SidebarWrapper.tsx`:
```diff
const PRODUCER_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard" },
  { href: "/inventory", label: "Inventory", iconName: "Package" },
  { href: "/production", label: "Production", iconName: "Factory" },
- { href: "/history", label: "History", iconName: "History" },
];
```

### Previous Story Intelligence (4-5)

Key learnings from Story 4-5:
1. **getDraftProductions** currently fetches all statuses (was changed from draft-only in Story 4-5) — needs to be reverted to draft-only now that history has its own tab/action
2. **`[id]/page.tsx`** already handles readOnly mode for validated entries — no changes needed for detail view
3. **`(supabase as any)` cast** — still needed for tables not in generated types
4. **Build verification** — always run after changes
5. **Atomic lock pattern** — validated entries are immutable, no editing allowed

### Existing Patterns to Follow

- **Server Actions:** `createClient`, `getSession()`, return `ActionResult<T>`
- **Tabs:** Import from `@timber/ui` (Radix-based Tabs components)
- **Client components:** Add `"use client"` directive for interactive components
- **Date formatting:** Use `formatDate()` / `formatDateTime()` from `@/lib/utils` (European DD.MM.YYYY format)
- **Number formatting:** m³ to 3 decimal places, percentages to 1 decimal

### Scope Boundaries

**In scope (Story 5.1):**
- Tab layout (Active + History)
- History table with sort and filter
- Date range and process type filters
- Row click navigates to existing detail view
- Empty state for no history
- Remove "History" sidebar item

**Out of scope (later stories):**
- "Create Correction" button functionality (Story 5.2 — button visible but non-functional or hidden until 5.2)
- Dashboard metrics (Story 5.3)
- Admin efficiency reports (Story 5.4)
- Pagination (small dataset assumption for MVP)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1]
- [Source: apps/portal/src/app/(portal)/production/page.tsx — current page structure]
- [Source: apps/portal/src/features/production/actions/getDraftProductions.ts — current query]
- [Source: apps/portal/src/features/production/types.ts — existing types]
- [Source: apps/portal/src/components/layout/SidebarWrapper.tsx — PRODUCER_NAV_ITEMS]
- [Source: packages/ui/src/components/tabs.tsx — Tabs component API]
- [Source: apps/portal/src/app/(portal)/production/[id]/page.tsx — detail page readOnly mode]
- [Source: _bmad-output/project-context.md — coding standards]
- [Source: _bmad-output/implementation-artifacts/stories/4-5-validate-production-update-inventory.md — previous story intelligence]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5

### Completion Notes List
- Created `getValidatedProductions` server action that fetches validated production entries with totals (input/output m³, outcome/waste %)
- Refactored `getDraftProductions` to filter only draft entries (previously fetched all statuses)
- Added `ProductionHistoryItem` type to types.ts
- Created `ProductionPageTabs` client component using `@timber/ui` Tabs (Radix-based)
- Created `ProductionHistoryTable` with sortable columns, process filter dropdown, date range filter, empty states, and row navigation links
- Updated `page.tsx` to fetch both drafts and validated entries in parallel, passing to tab component
- Removed "History" from producer sidebar navigation
- Deleted orphaned `/history` placeholder page (was a placeholder from Epic 4)
- Build passes with 0 TypeScript errors

### File List
- `apps/portal/src/features/production/actions/getValidatedProductions.ts` (NEW)
- `apps/portal/src/features/production/components/ProductionPageTabs.tsx` (NEW)
- `apps/portal/src/features/production/components/ProductionHistoryTable.tsx` (NEW)
- `apps/portal/src/features/production/actions/getDraftProductions.ts` (MODIFIED — filter to draft only)
- `apps/portal/src/features/production/actions/index.ts` (MODIFIED — added getValidatedProductions export)
- `apps/portal/src/features/production/types.ts` (MODIFIED — added ProductionHistoryItem)
- `apps/portal/src/app/(portal)/production/page.tsx` (MODIFIED — tabs layout, fetch history)
- `apps/portal/src/components/layout/SidebarWrapper.tsx` (MODIFIED — removed History nav item)
- `apps/portal/src/app/(portal)/history/page.tsx` (DELETED — history now in production tabs)

### Change Log
- Added tabbed layout to Production page (Active + History tabs)
- Created getValidatedProductions action for fetching validated entries with metrics
- Refactored getDraftProductions to only return draft entries
- Created ProductionHistoryTable with sortable columns, process/date filters, and clickable rows
- Removed History from sidebar navigation and deleted placeholder page
- Added ProductionHistoryItem type for history data
