# Story 9.2: Per-Organization Breakdown

Status: ready

## Story

As a Super Admin,
I want to see a breakdown by organization,
So that I can compare performance across my network.

## Acceptance Criteria

### AC1: Organizations Overview Table
**Given** I am logged in as Super Admin
**When** I view the dashboard
**Then** I see an "Organizations Overview" table with columns:
- Organization Name
- Inventory (m³)
- Production Volume (m³)
- Outcome %
- Last Activity

### AC2: Organization Drill-Down
**Given** I am viewing the Organizations Overview
**When** I click on an organization row
**Then** I am taken to that organization's detailed view
**And** I see their dashboard as they would see it

### AC3: Viewing As Indicator
**Given** I am viewing an organization's detail view
**When** I look at the header
**Then** I see "Viewing as: {Org Name}" indicator
**And** I see a "Back to Platform View" link

### AC4: Performance Color Coding
**Given** organizations have varying performance
**When** I view the breakdown
**Then** Outcome % is color-coded (green >= 80%, yellow 60-79%, red < 60%)

## Tasks / Subtasks

- [ ] Task 1: Create Organizations Overview section (AC: 1)
  - [ ] Create `OrganizationsOverviewTable` component
  - [ ] Display columns: Name, Inventory, Production, Outcome %, Last Activity
  - [ ] Sort by name or any column

- [ ] Task 2: Implement per-org metrics query (AC: 1, 4)
  - [ ] Create `getOrganizationsMetrics` server action
  - [ ] For each org: inventory volume, production volume, outcome %
  - [ ] Calculate last activity date
  - [ ] Apply color coding based on outcome %

- [ ] Task 3: Create organization drill-down page (AC: 2, 3)
  - [ ] Create `/admin/org-view/[id]` route
  - [ ] Load organization's dashboard view
  - [ ] Pass `viewingAsOrgId` context to all queries

- [ ] Task 4: Add viewing indicator header (AC: 3)
  - [ ] Create `ViewingAsHeader` component
  - [ ] Display organization name
  - [ ] Add "Back to Platform View" link
  - [ ] Style to be clearly visible

- [ ] Task 5: Update data queries to support "view as" mode (AC: 2)
  - [ ] Modify `getInventoryPackages` to accept optional orgId
  - [ ] Modify `getProductionEntries` to accept optional orgId
  - [ ] Modify dashboard metrics to accept optional orgId

- [ ] Task 6: Verification (AC: all)
  - [ ] Organizations table shows all orgs with metrics
  - [ ] Clicking org shows their view
  - [ ] "Viewing as" indicator is visible
  - [ ] Outcome % is color-coded
  - [ ] Build passes: `pnpm turbo build --filter=@timber/portal`

## Dev Notes

### Organizations Metrics Query

```sql
SELECT
  o.id,
  o.code,
  o.name,
  COALESCE(inv.total_volume, 0) as inventory_volume,
  COALESCE(prod.total_output, 0) as production_volume,
  CASE
    WHEN prod.total_input > 0
    THEN (prod.total_output / prod.total_input * 100)
    ELSE NULL
  END as outcome_percent,
  GREATEST(
    COALESCE(inv.last_activity, '1970-01-01'),
    COALESCE(prod.last_activity, '1970-01-01')
  ) as last_activity
FROM organisations o
LEFT JOIN (
  SELECT
    organisation_id,
    SUM(volume_m3) as total_volume,
    MAX(created_at) as last_activity
  FROM inventory_packages
  WHERE quantity > 0
  GROUP BY organisation_id
) inv ON inv.organisation_id = o.id
LEFT JOIN (
  SELECT
    organisation_id,
    SUM(input_volume_m3) as total_input,
    SUM(output_volume_m3) as total_output,
    MAX(validated_at) as last_activity
  FROM portal_production_entries
  WHERE status = 'validated'
  GROUP BY organisation_id
) prod ON prod.organisation_id = o.id
WHERE o.is_active = true
ORDER BY o.name;
```

### Color Coding Logic

```tsx
function getOutcomeColor(percent: number | null): string {
  if (percent === null) return 'text-gray-400';
  if (percent >= 80) return 'text-green-600';
  if (percent >= 60) return 'text-yellow-600';
  return 'text-red-600';
}
```

### "View As" Context

```typescript
// In app state or URL param
interface ViewContext {
  viewingAsOrgId: string | null;
  viewingAsOrgName: string | null;
}

// Pass to server actions
const inventory = await getInventoryPackages({
  organisationId: viewingAsOrgId ?? session.organisationId
});
```

### Component Structure

```
/admin/org-view/[id]/
└── page.tsx (shows org's dashboard with viewing indicator)

/features/dashboard/components/
├── OrganizationsOverviewTable.tsx
└── ViewingAsHeader.tsx
```

### References

- [Source: epics.md#Story-9.2-Per-Organization-Breakdown]
- [Story 9.1: Aggregated Dashboard] (parent view)
- [Story 6.5: Organization Selector] (similar filtering concept)

## Dev Agent Record

### Change Log

- 2026-01-25: Story 9.2 created and ready for development
