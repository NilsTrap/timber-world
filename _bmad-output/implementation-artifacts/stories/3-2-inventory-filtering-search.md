# Story 3.2: Inventory Filtering & Search

Status: ready-for-dev

## Story

As a Producer,
I want to filter and search inventory by various attributes,
so that I can quickly find specific materials for production.

## Acceptance Criteria

### AC1: Text Search
**Given** I am viewing the inventory table
**When** I type in the search box
**Then** the table filters to show packages matching the search term
**And** search matches against: Package No, Product Name, Species
**And** search is case-insensitive

### AC2: Column Filters
**Given** I am viewing the inventory table
**When** I use the column filter menus
**Then** I can filter by: Product Name, Species, Humidity, Type, Processing, Shipment
**And** the table updates to show only matching packages

**Status:** Already implemented via `DataEntryTable` readOnly mode + `ColumnHeaderMenu`

### AC3: Column Sort
**Given** I am viewing the inventory table
**When** I click on a column's sort option
**Then** the table sorts by that column
**And** clicking again toggles between ascending and descending

**Status:** Already implemented via `ColumnHeaderMenu`

### AC4: Clear Filters
**Given** I have filtered/sorted the inventory
**When** I click "Clear Filters"
**Then** the table resets to show all packages in default order

**Status:** Already implemented (Clear Filters button appears when sort/filter active)

### AC5: Empty Filter State
**Given** I filter/search inventory and no results match
**When** I view the table
**Then** I see a message "No packages match your filters"
**And** I see a "Clear Filters" button to reset all filters and search

### AC6: Shipment Filter
**Given** I want to filter by shipment
**When** I select a shipment from the Shipment column filter
**Then** only packages from that shipment are shown

**Status:** Already implemented via column filter on Shipment column

## Tasks / Subtasks

- [ ] Task 1: Add search input to ProducerInventory (AC: 1)
  - [ ] Add `searchTerm` state to ProducerInventory component
  - [ ] Add search `Input` with search icon above the DataEntryTable
  - [ ] Filter `packages` by search term before passing to DataEntryTable (case-insensitive match against packageNumber, productName, woodSpecies)
  - [ ] Search + column filters are additive (search narrows first, then column filters narrow further)
  - [ ] Summary cards reflect the combined filtered result (via existing `onDisplayRowsChange`)

- [ ] Task 2: Add empty filter state (AC: 5)
  - [ ] Detect when `displayedPackages.length === 0` AND either search is active or column filters are active
  - [ ] Show empty state: centered message "No packages match your filters" with a "Clear Filters" button
  - [ ] "Clear Filters" button resets search input AND triggers DataEntryTable filter/sort reset
  - [ ] Distinguish from the existing empty state (no packages at all) which shows "No inventory available"

- [ ] Task 3: Expose filter reset on DataEntryTable (AC: 5)
  - [ ] Add optional `onClearFilters` callback prop to DataEntryTable (called when Clear Filters button is clicked internally)
  - [ ] OR: Add `ref` / imperative handle to allow parent to trigger filter reset
  - [ ] OR: Add `filterKey` prop that resets internal state when changed (simplest — increment key to force re-mount of filter state)
  - [ ] Choose simplest approach that doesn't over-engineer the component

- [ ] Task 4: Verification (AC: all)
  - [ ] Build passes: `npx turbo build --filter=@timber/portal`
  - [ ] Search filters table by Package No, Product Name, and Species
  - [ ] Column filters still work (additive with search)
  - [ ] Summary cards update with combined search + filter results
  - [ ] Empty state shows when no results match
  - [ ] Clear Filters from empty state resets both search and column filters
  - [ ] Admin inventory page (`/admin/inventory`) is unaffected

## Dev Notes

### What's Already Done (from Story 3.1 + UX fixes)

The `DataEntryTable` component already provides in readOnly mode:
- Column-level sort/filter via `ColumnHeaderMenu` (covers AC2, AC3, AC6)
- "Clear Filters" button above table when any filter/sort is active (covers AC4)
- Filter indicator dot on column headers with active filters
- `onDisplayRowsChange` callback for filter-aware summary cards

### Remaining Work

Only two things are genuinely new:
1. **Search input** — pre-filters packages before they reach DataEntryTable
2. **Empty state for no matches** — when search + column filters yield 0 results

### Implementation Approach

**Search:** Add search state in `ProducerInventory`. Filter the `packages` array by search term before passing as `rows` to DataEntryTable. This is the simplest approach — search is a pre-filter, column filters are post-filters inside DataEntryTable.

```typescript
const filteredBySearch = useMemo(() => {
  if (!searchTerm.trim()) return packages;
  const term = searchTerm.toLowerCase();
  return packages.filter(
    (p) =>
      p.packageNumber.toLowerCase().includes(term) ||
      (p.productName ?? "").toLowerCase().includes(term) ||
      (p.woodSpecies ?? "").toLowerCase().includes(term)
  );
}, [packages, searchTerm]);
```

**Empty state:** When `displayedPackages.length === 0` AND (`searchTerm` is non-empty OR packages were pre-filtered), show the empty message instead of the table.

**Filter reset:** The simplest approach is to use a `key` prop on `DataEntryTable` that resets its internal state. When the user clicks "Clear All" from the empty state, increment a key counter AND clear the search term. This forces DataEntryTable to remount with fresh filter/sort state.

### Key Patterns from Story 3.1

- `ProducerInventory` is a `"use client"` component receiving `packages: PackageListItem[]` from the server page
- Uses `onDisplayRowsChange` callback from DataEntryTable to track the visible filtered set for summary cards
- Summary cards import from `@/features/shipments/components/SummaryCards`
- Search icon: use `Search` from `lucide-react`
- Input component: use `Input` from `@timber/ui`

### Project Context Deviation

The project-context.md states: "URL state for filters — Use searchParams for filter/sort state, not useState". However, DataEntryTable manages its own filter/sort state internally with useState (established pattern from Stories 2.3, 2.4, 3.1). The search input will also use useState for consistency with this established pattern. URL-based filter state would require a significant refactor of DataEntryTable and is out of scope for this story.

### File Structure

```
apps/portal/src/features/inventory/
├── components/
│   └── ProducerInventory.tsx  ← MODIFY (add search + empty state)
├── actions/
│   ├── getProducerPackages.ts
│   └── index.ts
└── types.ts
```

Optional (only if Task 3 requires component change):
```
packages/ui/src/components/
└── data-entry-table.tsx       ← MODIFY (add key-based reset or callback)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2]
- [Source: _bmad-output/implementation-artifacts/stories/3-1-producer-inventory-table.md]
- [Source: _bmad-output/project-context.md#React/Next.js Rules]
- [Source: packages/ui/src/components/data-entry-table.tsx]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

