# Story 9.3: All Shipments View

Status: ready

## Story

As a Super Admin,
I want to see all shipments across the platform,
So that I can track goods movement between all organizations.

## Acceptance Criteria

### AC1: All Shipments Tab
**Given** I am logged in as Super Admin
**When** I navigate to Shipments
**Then** I see an "All Shipments" tab (in addition to Incoming/Outgoing)

### AC2: All Shipments Table
**Given** I am viewing the All Shipments tab
**When** I see the table
**Then** I see columns: Code, From Org, To Org, Packages, Volume m³, Status, Date
**And** shipments are sorted by date (newest first)

### AC3: Filter Options
**Given** I am viewing All Shipments
**When** I use the filter options
**Then** I can filter by: From Org, To Org, Status, Date Range

### AC4: Shipment Detail Access
**Given** I click on any shipment row
**When** the detail view opens
**Then** I see full shipment details including all packages
**And** I can see acceptance/rejection history

### AC5: Pending Shipments Highlight
**Given** pending shipments exist
**When** I view All Shipments
**Then** pending shipments are visually highlighted
**And** I see a count badge on the tab "All Shipments (3)"

## Tasks / Subtasks

- [ ] Task 1: Add All Shipments tab for Super Admin (AC: 1)
  - [ ] Update `ShipmentTabs` to detect Super Admin
  - [ ] Add "All Shipments" tab conditionally
  - [ ] Handle tab URL param (?tab=all)

- [ ] Task 2: Implement all shipments query (AC: 2)
  - [ ] Create `getAllShipments` server action
  - [ ] Join with both from and to organisations
  - [ ] Include package count and total volume
  - [ ] Order by date descending

- [ ] Task 3: Create All Shipments table (AC: 2, 5)
  - [ ] Create `AllShipmentsTable` component
  - [ ] Display all columns including both orgs
  - [ ] Highlight pending rows with visual indicator
  - [ ] Add status badge column

- [ ] Task 4: Implement filters (AC: 3)
  - [ ] Add From Org dropdown filter
  - [ ] Add To Org dropdown filter
  - [ ] Add Status dropdown filter
  - [ ] Add Date Range picker
  - [ ] Apply filters to query

- [ ] Task 5: Add pending count badge (AC: 5)
  - [ ] Query pending shipment count
  - [ ] Display badge on "All Shipments" tab
  - [ ] Update badge styling

- [ ] Task 6: Ensure detail view works for Super Admin (AC: 4)
  - [ ] Super Admin can view any shipment detail
  - [ ] Show full timeline including review events
  - [ ] Show rejection reason if applicable

- [ ] Task 7: Verification (AC: all)
  - [ ] Super Admin sees All Shipments tab
  - [ ] Table shows shipments between all orgs
  - [ ] Filters work correctly
  - [ ] Pending badge shows count
  - [ ] Org users don't see All Shipments tab
  - [ ] Build passes: `pnpm turbo build --filter=@timber/portal`

## Dev Notes

### All Shipments Query

```sql
SELECT
  s.*,
  from_org.name as from_org_name,
  from_org.code as from_org_code,
  to_org.name as to_org_name,
  to_org.code as to_org_code,
  COUNT(sp.id) as package_count,
  SUM(sp.volume_m3) as total_volume
FROM shipments s
JOIN organisations from_org ON s.from_organisation_id = from_org.id
JOIN organisations to_org ON s.to_organisation_id = to_org.id
LEFT JOIN shipment_packages sp ON sp.shipment_id = s.id
GROUP BY s.id, from_org.id, to_org.id
ORDER BY s.created_at DESC;
```

### Filter Implementation

```typescript
interface ShipmentFilters {
  fromOrgId?: string;
  toOrgId?: string;
  status?: ShipmentStatus | 'all';
  dateFrom?: string;
  dateTo?: string;
}

export async function getAllShipments(
  filters: ShipmentFilters = {}
): Promise<ActionResult<ShipmentWithDetails[]>> {
  let query = supabase.from('shipments').select(`...`);

  if (filters.fromOrgId) {
    query = query.eq('from_organisation_id', filters.fromOrgId);
  }
  if (filters.toOrgId) {
    query = query.eq('to_organisation_id', filters.toOrgId);
  }
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }

  return query.order('created_at', { ascending: false });
}
```

### Tab Badge

```tsx
<TabsTrigger value="all">
  All Shipments
  {pendingCount > 0 && (
    <Badge variant="secondary" className="ml-2 bg-yellow-100 text-yellow-800">
      {pendingCount}
    </Badge>
  )}
</TabsTrigger>
```

### Pending Row Highlighting

```tsx
<TableRow
  className={cn(
    shipment.status === 'pending' && 'bg-yellow-50 hover:bg-yellow-100'
  )}
>
```

### References

- [Source: epics.md#Story-9.3-All-Shipments-View]
- [Story 8.6: Shipment History] (tab structure)
- [Story 9.1: Aggregated Dashboard] (pending count metric)

## Dev Agent Record

### Change Log

- 2026-01-25: Story 9.3 created and ready for development
