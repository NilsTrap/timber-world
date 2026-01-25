# Story 5.4: Admin Efficiency Reports

Status: done

## Story

As an Admin,
I want to view producer efficiency reports,
so that I can monitor production performance and identify improvements.

## Acceptance Criteria

### AC1: Admin Dashboard Efficiency Overview
**Given** I am logged in as Admin
**When** I view my dashboard
**Then** I see an "Efficiency Overview" section
**And** I see summary metrics: Total Production Volume (m3), Overall Outcome %, Overall Waste %

### AC2: Per-Process Efficiency Table
**Given** production data exists
**When** I view the Admin dashboard
**Then** I see a per-process efficiency table showing:
- Process Name
- Total Entries
- Total Input m3
- Total Output m3
- Outcome %
- Waste %
- Trend indicator (compared to previous period)

### AC3: Date Range Filter
**Given** I am viewing efficiency reports
**When** I use the date range filter
**Then** I can view metrics for: This Week, This Month, This Quarter, All Time, Custom Range
**And** all metrics recalculate for the selected period

### AC4: Process Detail View
**Given** I am viewing per-process metrics
**When** I click on a process row
**Then** I see a detailed view with:
- Chart showing outcome % over time
- List of recent production entries for that process
- Best and worst performing entries

### AC5: Export Functionality
**Given** I want to export data
**When** I click "Export"
**Then** I can download efficiency data as CSV
**And** export includes: Date, Process, Input m3, Output m3, Outcome %, Waste %

### AC6: Empty State
**Given** no production data exists
**When** I view Admin dashboard
**Then** I see a message "No production data recorded yet"
**And** the efficiency section shows placeholder state

## Tasks / Subtasks

- [x] Task 1: Create admin efficiency data actions (AC: 1, 2, 3)
  - [x] Create `apps/portal/src/features/dashboard/actions/getAdminMetrics.ts` server action
  - [x] Query all `portal_production_entries` (validated entries across all producers)
  - [x] Compute total production volume, weighted outcome %, waste %
  - [x] Create `apps/portal/src/features/dashboard/actions/getAdminProcessBreakdown.ts` server action
  - [x] Group validated entries by process_id, compute per-process stats
  - [x] Add trend calculation: compare current period to previous period
  - [x] Create `apps/portal/src/features/dashboard/actions/getProcessHistory.ts` server action for detail view
  - [x] Update `apps/portal/src/features/dashboard/actions/index.ts` with new exports
  - [x] Update `apps/portal/src/features/dashboard/types.ts` with `AdminMetrics`, `AdminProcessBreakdownItem`, `ProcessHistoryItem` interfaces

- [x] Task 2: Create date range filter types and utilities (AC: 3)
  - [x] Add `DateRangeFilter` type: 'week' | 'month' | 'quarter' | 'all' | 'custom'
  - [x] Add `DateRange` interface: { start: Date, end: Date }
  - [x] Create `getDateRangeForFilter(filter: DateRangeFilter)` utility function
  - [x] Handle custom range with explicit start/end dates

- [x] Task 3: Create AdminDashboardMetrics component (AC: 1, 6)
  - [x] Create `apps/portal/src/features/dashboard/components/AdminDashboardMetrics.tsx`
  - [x] Display 3 metric cards: Total Production Volume, Overall Outcome %, Overall Waste %
  - [x] Format volumes with 3 decimal places (comma separator): `0,000 m3`
  - [x] Format percentages with 1 decimal: `85,2%`
  - [x] Show "--" for zero/empty values
  - [x] Show empty state message when no data

- [x] Task 4: Create AdminProcessBreakdownTable component (AC: 2, 3, 4)
  - [x] Create `apps/portal/src/features/dashboard/components/AdminProcessBreakdownTable.tsx` (client component)
  - [x] Display table with columns: Process, Entries, Input m3, Output m3, Outcome %, Waste %, Trend
  - [x] Color-code outcome % cells: green (>=80), yellow (60-79), red (<60)
  - [x] Add trend indicator: arrow up (green) if improved, arrow down (red) if declined, dash (gray) if unchanged
  - [x] Make rows clickable -> navigate to process detail modal/view
  - [x] Add date range filter dropdown in table header

- [x] Task 5: Create ProcessDetailView component (AC: 4)
  - [x] Create `apps/portal/src/features/dashboard/components/ProcessDetailView.tsx` (client component)
  - [x] Display as modal or slide-over panel
  - [x] Include line chart showing outcome % over time (use simple chart or div-based visualization)
  - [x] List recent production entries for the process (Date, Input, Output, Outcome %)
  - [x] Highlight best and worst performing entries

- [x] Task 6: Create ExportButton component (AC: 5)
  - [x] Create `apps/portal/src/features/dashboard/components/ExportButton.tsx`
  - [x] Generate CSV from efficiency data with columns: Date, Process, Input m3, Output m3, Outcome %, Waste %
  - [x] Trigger download with filename `efficiency-report-{date}.csv`
  - [x] Use European number formatting in CSV (comma decimal)

- [x] Task 7: Wire components into admin dashboard page (AC: all)
  - [x] Update `apps/portal/src/app/(portal)/dashboard/page.tsx` to detect admin role
  - [x] Render AdminDashboardMetrics and AdminProcessBreakdownTable for admin users
  - [x] Keep existing producer dashboard for producer users
  - [x] Add export button to admin view
  - [x] Handle loading and error states

- [x] Task 8: Verification (AC: all)
  - [x] Build passes: `npx turbo build --filter=@timber/portal`
  - [x] Admin dashboard shows efficiency metrics when production data exists
  - [x] Date range filter recalculates metrics correctly
  - [x] Trend indicators show correct direction
  - [x] Process detail view opens and displays chart/entries
  - [x] CSV export downloads correctly
  - [x] Empty state displays correctly for new installations
  - [x] Producer dashboard remains unchanged

## Dev Notes

### Architecture: Admin Efficiency Data

The admin dashboard aggregates data from `portal_production_entries` across **all producers** (unlike producer dashboard which is scoped to a single user).

**Key differences from Producer Dashboard:**
1. No `created_by` filter - admin sees all production data
2. Includes trend calculations (requires date range comparison)
3. Adds process detail view with historical chart
4. Includes CSV export functionality

**Weighted averages computed as:**
```
Overall Outcome % = SUM(total_output_m3) / SUM(total_input_m3) * 100
Overall Waste % = 100 - Overall Outcome %
```

**Trend calculation:**
```
Current Period: selected date range
Previous Period: same duration before current start date
Trend = Current Outcome % - Previous Outcome %
Arrow up if > 1%, arrow down if < -1%, dash if within +-1%
```

### Component Structure

```
apps/portal/src/features/dashboard/
├── actions/
│   ├── getProducerMetrics.ts          (existing)
│   ├── getProcessBreakdown.ts         (existing)
│   ├── getAdminMetrics.ts             (NEW)
│   ├── getAdminProcessBreakdown.ts    (NEW)
│   ├── getProcessHistory.ts           (NEW)
│   └── index.ts                       (MODIFY)
├── components/
│   ├── ProducerDashboardMetrics.tsx   (existing)
│   ├── ProcessBreakdownTable.tsx      (existing)
│   ├── AdminDashboardMetrics.tsx      (NEW)
│   ├── AdminProcessBreakdownTable.tsx (NEW)
│   ├── ProcessDetailView.tsx          (NEW)
│   ├── ExportButton.tsx               (NEW)
│   └── DateRangeFilter.tsx            (NEW)
├── types.ts                           (MODIFY)
└── utils/
    └── dateRanges.ts                  (NEW)
```

### Type Definitions

```typescript
export type DateRangeFilter = 'week' | 'month' | 'quarter' | 'all' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface AdminMetrics {
  totalProductionVolumeM3: number;
  overallOutcomePercent: number;
  overallWastePercent: number;
  entryCount: number;
}

export interface AdminProcessBreakdownItem {
  processId: string;
  processName: string;
  totalEntries: number;
  totalInputM3: number;
  totalOutputM3: number;
  avgOutcomePercent: number;
  avgWastePercent: number;
  trend: 'up' | 'down' | 'stable';
  trendValue: number; // percentage point change
}

export interface ProcessHistoryItem {
  entryId: string;
  date: string;
  inputM3: number;
  outputM3: number;
  outcomePercent: number;
  createdBy: string;
}

export interface ProcessDetailData {
  processId: string;
  processName: string;
  historyItems: ProcessHistoryItem[];
  chartData: { date: string; outcomePercent: number }[];
  bestEntry: ProcessHistoryItem | null;
  worstEntry: ProcessHistoryItem | null;
}
```

### Date Range Filter Logic

```typescript
function getDateRangeForFilter(filter: DateRangeFilter, customRange?: DateRange): DateRange {
  const now = new Date();
  const end = now;

  switch (filter) {
    case 'week':
      return { start: subDays(now, 7), end };
    case 'month':
      return { start: subDays(now, 30), end };
    case 'quarter':
      return { start: subDays(now, 90), end };
    case 'all':
      return { start: new Date(0), end };
    case 'custom':
      return customRange || { start: subDays(now, 30), end };
  }
}
```

### Simple Chart Approach

For the outcome % over time chart, use a simple div-based bar chart or line visualization:

```tsx
// Simple bar chart using divs (no external library needed)
function SimpleChart({ data }: { data: { date: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 100);

  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((item, i) => (
        <div
          key={i}
          className="flex-1 bg-primary/20 rounded-t"
          style={{ height: `${(item.value / max) * 100}%` }}
          title={`${item.date}: ${formatPercent(item.value)}%`}
        />
      ))}
    </div>
  );
}
```

### CSV Export Logic

```typescript
function generateCSV(data: AdminProcessBreakdownItem[], dateRange: string): string {
  const header = 'Process,Entries,Input m3,Output m3,Outcome %,Waste %\n';
  const rows = data.map(item =>
    `${item.processName},${item.totalEntries},${formatVolume(item.totalInputM3)},${formatVolume(item.totalOutputM3)},${formatPercent(item.avgOutcomePercent)},${formatPercent(item.avgWastePercent)}`
  ).join('\n');

  return header + rows;
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
```

### Dashboard Page Role Detection

```tsx
async function DashboardContent() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  // Check role from session
  const isAdmin = session.role === 'admin';

  if (isAdmin) {
    // Render admin dashboard
    return <AdminDashboardContent />;
  } else {
    // Render producer dashboard (existing)
    return <ProducerDashboardContent />;
  }
}
```

### Previous Story Intelligence (5-3)

Key learnings from Story 5-3:
1. **`(supabase as any)` cast** still needed for tables not in generated types
2. **Server actions** follow the `ActionResult<T>` pattern with auth checks
3. **`isAdmin(session)`** should be used for admin-only actions
4. **`getSession()`** returns session with `role` field
5. **Query patterns:** No `created_by` filter for admin views (see all data)
6. **`ref_processes`** table holds process names, joined via FK
7. **Build verification:** always run `npx turbo build --filter=@timber/portal` after changes
8. **Date formatting:** use `formatDate()` from `@/lib/utils` for DD.MM.YYYY
9. **Number formatting:** use `formatVolume()` and `formatPercent()` from `@/lib/utils`

### Existing Patterns to Follow

- **Server Actions:** `createClient`, `getSession()`, `isAdmin()`, return `ActionResult<T>`
- **Number display:** Use comma as decimal separator (European format)
- **Table styling:** Match `ProcessBreakdownTable` patterns - `tabular-nums`, `text-right` for numerics
- **Card styling:** `rounded-lg border bg-card p-6 shadow-sm`
- **Color coding:** green (>=80%), yellow (60-79%), red (<60%)
- **Navigation:** `useRouter()` + `router.push()` for client-side nav

### Modal/Dialog Pattern

Use shadcn Dialog component for process detail view:

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@timber/ui";

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>{processName} - Efficiency History</DialogTitle>
    </DialogHeader>
    <ProcessDetailView processId={selectedProcessId} />
  </DialogContent>
</Dialog>
```

### Scope Boundaries

**In scope (Story 5.4):**
- Admin dashboard efficiency overview (3 metric cards)
- Per-process breakdown table with trend indicators
- Date range filtering (week, month, quarter, all, custom)
- Process detail view with chart and entry list
- CSV export functionality
- Empty state for no data

**Out of scope:**
- Real-time updates (manual refresh only)
- Cross-producer comparison (individual producer performance)
- PDF export (CSV only for MVP)
- Email reports / scheduled reports
- Custom date picker component (use native date inputs for custom range)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.4]
- [Source: apps/portal/src/app/(portal)/dashboard/page.tsx - current producer dashboard]
- [Source: apps/portal/src/features/dashboard/actions/getProducerMetrics.ts - query pattern]
- [Source: apps/portal/src/features/dashboard/components/ProcessBreakdownTable.tsx - table pattern]
- [Source: _bmad-output/project-context.md - coding standards]
- [Source: _bmad-output/implementation-artifacts/stories/5-3-producer-dashboard-metrics.md - previous story]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- **AC1 verified:** Admin dashboard displays 3 metric cards (Total Production Volume, Overall Outcome %, Overall Waste %) with real data aggregated from all producers
- **AC2 verified:** Per-process efficiency table shows Process, Entries, Input m³, Output m³, Outcome %, Waste %, and Trend indicator
- **AC3 verified:** Date range filter dropdown in table header with options: This Week, This Month, This Quarter, All Time, Custom Range
- **AC4 verified:** Process row clicks open modal with bar chart showing outcome % over time, list of recent entries, and highlighted best/worst entries
- **AC5 verified:** Export CSV button generates file with European number formatting and timestamped filename
- **AC6 verified:** Empty state displays "No production data recorded yet" message when no production exists
- **Build passes:** `npx turbo build --filter=@timber/portal` completes successfully with no errors
- **Producer dashboard unchanged:** Existing ProducerDashboardContent remains functional for producer role users

### File List

- `apps/portal/src/features/dashboard/types.ts` (MODIFIED - added admin types)
- `apps/portal/src/features/dashboard/actions/getAdminMetrics.ts` (NEW)
- `apps/portal/src/features/dashboard/actions/getAdminProcessBreakdown.ts` (NEW)
- `apps/portal/src/features/dashboard/actions/getProcessHistory.ts` (NEW)
- `apps/portal/src/features/dashboard/actions/index.ts` (MODIFIED - added exports)
- `apps/portal/src/features/dashboard/utils/dateRanges.ts` (NEW)
- `apps/portal/src/features/dashboard/components/AdminDashboardMetrics.tsx` (NEW)
- `apps/portal/src/features/dashboard/components/AdminProcessBreakdownTable.tsx` (NEW)
- `apps/portal/src/features/dashboard/components/ProcessDetailView.tsx` (NEW)
- `apps/portal/src/features/dashboard/components/ExportButton.tsx` (NEW)
- `apps/portal/src/features/dashboard/components/AdminDashboardContent.tsx` (NEW)
- `apps/portal/src/app/(portal)/dashboard/page.tsx` (MODIFIED - integrated AdminDashboardContent)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFIED)

### Change Log

- 2026-01-25: Story 5.4 implementation complete - all acceptance criteria met, build passes
- 2026-01-25: Fixed page not loading issue - required server restart after code changes
