# Story 9.1: Super Admin Aggregated Dashboard

Status: ready

## Story

As a Super Admin,
I want to see platform-wide metrics on my dashboard,
So that I can monitor all organizations at a glance.

## Acceptance Criteria

### AC1: Aggregated Metric Cards
**Given** I am logged in as Super Admin
**When** I view my dashboard
**Then** I see aggregated MetricCards:
- Total Inventory Volume (all orgs combined, m³)
- Total Production Volume (all orgs combined, m³)
- Active Organizations (count of orgs with recent activity)
- Pending Shipments (count awaiting acceptance)

### AC2: Overall Efficiency Metrics
**Given** production data exists across multiple organizations
**When** I view the dashboard
**Then** I see Overall Outcome % and Waste % (weighted across all orgs)

### AC3: Per-Process Breakdown
**Given** I view the dashboard
**When** I look at the efficiency section
**Then** I see per-process breakdown aggregated across all organizations

## Tasks / Subtasks

- [ ] Task 1: Create Super Admin dashboard layout (AC: 1)
  - [ ] Detect if user is Super Admin in dashboard page
  - [ ] Show different layout for Super Admin vs org user
  - [ ] Create `SuperAdminDashboard` component

- [ ] Task 2: Implement aggregated metrics queries (AC: 1)
  - [ ] Create `getPlatformMetrics` server action
  - [ ] Total Inventory Volume: SUM of all inventory_packages.volume_m3
  - [ ] Total Production Volume: SUM of all validated production outputs
  - [ ] Active Organizations: COUNT of orgs with activity in last 30 days
  - [ ] Pending Shipments: COUNT of shipments with status = 'pending'

- [ ] Task 3: Create aggregated metric cards (AC: 1)
  - [ ] Create `PlatformMetricCards` component
  - [ ] Display all four metrics with appropriate icons
  - [ ] Show loading states while fetching

- [ ] Task 4: Implement efficiency metrics (AC: 2)
  - [ ] Create `getPlatformEfficiency` server action
  - [ ] Calculate weighted Outcome % across all production
  - [ ] Calculate weighted Waste % across all production
  - [ ] Display in efficiency card or section

- [ ] Task 5: Implement per-process breakdown (AC: 3)
  - [ ] Create `getProcessBreakdownAllOrgs` server action
  - [ ] Aggregate by process type across all orgs
  - [ ] Create table showing: Process, Entries, Input m³, Output m³, Outcome %
  - [ ] Color-code based on performance thresholds

- [ ] Task 6: Verification (AC: all)
  - [ ] Super Admin sees aggregated metrics
  - [ ] Metrics reflect all organizations' data
  - [ ] Per-process breakdown shows combined stats
  - [ ] Regular org users still see their own dashboard
  - [ ] Build passes: `pnpm turbo build --filter=@timber/portal`

## Dev Notes

### Dashboard Layout

```tsx
// In dashboard page
const { isSuperAdmin } = await getSession();

return isSuperAdmin ? (
  <SuperAdminDashboard />
) : (
  <ProducerDashboard />
);
```

### Platform Metrics Queries

```sql
-- Total Inventory Volume
SELECT SUM(volume_m3) as total_inventory
FROM inventory_packages
WHERE quantity > 0;

-- Total Production Volume
SELECT SUM(ppe.output_volume_m3) as total_production
FROM portal_production_entries ppe
WHERE ppe.status = 'validated';

-- Active Organizations (last 30 days)
SELECT COUNT(DISTINCT organisation_id) as active_orgs
FROM (
  SELECT organisation_id FROM portal_production_entries
  WHERE validated_at > NOW() - INTERVAL '30 days'
  UNION
  SELECT from_organisation_id FROM shipments
  WHERE created_at > NOW() - INTERVAL '30 days'
) as activity;

-- Pending Shipments
SELECT COUNT(*) as pending_count
FROM shipments
WHERE status = 'pending';
```

### Efficiency Calculation

```typescript
// Weighted average: (sum of all outputs) / (sum of all inputs) * 100
const overallOutcome = (totalOutputVolume / totalInputVolume) * 100;
const overallWaste = 100 - overallOutcome;
```

### Component Structure

```
/features/dashboard/
├── components/
│   ├── SuperAdminDashboard.tsx
│   ├── PlatformMetricCards.tsx
│   ├── PlatformEfficiencySection.tsx
│   └── ProcessBreakdownTable.tsx
├── actions/
│   ├── getPlatformMetrics.ts
│   ├── getPlatformEfficiency.ts
│   └── getProcessBreakdownAllOrgs.ts
└── types.ts
```

### References

- [Source: epics.md#Story-9.1-Super-Admin-Aggregated-Dashboard]
- [Story 5.3: Producer Dashboard Metrics] (existing dashboard patterns)
- [Story 5.4: Admin Efficiency Reports] (efficiency calculations)
- [Story 9.2: Per-Org Breakdown] (drill-down from this view)

## Dev Agent Record

### Change Log

- 2026-01-25: Story 9.1 created and ready for development
