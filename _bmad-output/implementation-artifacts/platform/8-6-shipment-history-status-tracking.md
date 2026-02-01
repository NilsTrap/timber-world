# Story 8.6: Shipment History and Status Tracking

Status: ready

## Story

As an organization user,
I want to view my shipment history,
So that I can track what I've sent and received.

## Acceptance Criteria

### AC1: Shipment Tabs
**Given** I am logged in as an organization user
**When** I navigate to Shipments
**Then** I see tabs: "Outgoing" (sent by my org), "Incoming" (sent to my org)

### AC2: Outgoing Tab
**Given** I am viewing the Outgoing tab
**When** I see the table
**Then** I see columns: Code, To Org, Packages, Volume m³, Status, Date
**And** status shows: Draft, Pending, Completed, Rejected

### AC3: Incoming Tab
**Given** I am viewing the Incoming tab
**When** I see the table
**Then** I see columns: Code, From Org, Packages, Volume m³, Status, Date
**And** pending shipments are highlighted

### AC4: Shipment Detail
**Given** I click on any shipment
**When** the detail view opens
**Then** I see full shipment details including all packages
**And** if rejected, I see the rejection reason

### AC5: Super Admin All Shipments
**Given** I am Super Admin
**When** I view Shipments
**Then** I see an "All Shipments" tab showing shipments between all organizations

## Tasks / Subtasks

- [ ] Task 1: Complete shipments page with tabs (AC: 1)
  - [ ] Finalize `ShipmentTabs` component from Story 8.4
  - [ ] Add URL param handling for tab state
  - [ ] Style active/inactive tabs

- [ ] Task 2: Create outgoing shipments table (AC: 2)
  - [ ] Create `getOutgoingShipments` server action
  - [ ] Filter by sender org (current user's org)
  - [ ] Create `OutgoingShipmentsTable` component
  - [ ] Display all columns with status badges

- [ ] Task 3: Update incoming shipments table styling (AC: 3)
  - [ ] Highlight pending rows with visual indicator
  - [ ] Add action buttons for pending shipments
  - [ ] Show date of submission

- [ ] Task 4: Create comprehensive shipment detail view (AC: 4)
  - [ ] Show shipment header (code, from, to, status, dates)
  - [ ] Show all packages in table format
  - [ ] Show notes if present
  - [ ] Show rejection reason if status is 'rejected'
  - [ ] Show timeline of status changes

- [ ] Task 5: Add All Shipments tab for Super Admin (AC: 5)
  - [ ] Create `getAllShipments` server action
  - [ ] Conditionally show tab for Super Admin only
  - [ ] Include org filter dropdown

- [ ] Task 6: Verification (AC: all)
  - [ ] Outgoing tab shows shipments sent by user's org
  - [ ] Incoming tab shows shipments received by user's org
  - [ ] Pending shipments are visually distinct
  - [ ] Detail view shows all information
  - [ ] Super Admin sees all shipments
  - [ ] Build passes: `pnpm turbo build --filter=@timber/portal`

## Dev Notes

### Status Badges

```tsx
const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};
```

### Outgoing Shipments Query

```sql
SELECT
  s.*,
  to_org.name as to_org_name,
  to_org.code as to_org_code,
  COUNT(sp.id) as package_count,
  SUM(sp.volume_m3) as total_volume
FROM shipments s
JOIN organisations to_org ON s.to_organisation_id = to_org.id
LEFT JOIN shipment_packages sp ON sp.shipment_id = s.id
WHERE s.from_organisation_id = :currentOrgId
GROUP BY s.id, to_org.id
ORDER BY s.created_at DESC;
```

### Shipment Detail Timeline

```tsx
<div className="space-y-3">
  <TimelineItem
    date={shipment.createdAt}
    label="Created"
    by={null}
  />
  {shipment.submittedAt && (
    <TimelineItem
      date={shipment.submittedAt}
      label="Submitted for Acceptance"
      by={null}
    />
  )}
  {shipment.reviewedAt && (
    <TimelineItem
      date={shipment.reviewedAt}
      label={shipment.status === 'rejected' ? 'Rejected' : 'Accepted'}
      by={shipment.reviewedByName}
    />
  )}
  {shipment.completedAt && (
    <TimelineItem
      date={shipment.completedAt}
      label="Completed - Inventory Transferred"
      by={null}
    />
  )}
</div>
```

### Component Structure

```
/shipments/
├── page.tsx (tabs: Outgoing, Incoming, [All])
└── [id]/
    └── page.tsx (detail view)

/features/shipments/components/
├── ShipmentTabs.tsx
├── OutgoingShipmentsTable.tsx
├── IncomingShipmentsTable.tsx
├── AllShipmentsTable.tsx (Super Admin)
├── ShipmentDetail.tsx
├── ShipmentStatusBadge.tsx
└── ShipmentTimeline.tsx
```

### References

- [Source: epics.md#Story-8.6-Shipment-History-and-Status-Tracking]
- [Story 8.4: Receiver Reviews] (incoming tab)
- [Story 8.5: Accept/Reject] (status outcomes)
- [Story 9.3: All Shipments View] (Super Admin extension)

## Dev Agent Record

### Change Log

- 2026-01-25: Story 8.6 created and ready for development
