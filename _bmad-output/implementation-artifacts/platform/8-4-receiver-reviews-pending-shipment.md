# Story 8.4: Receiver Reviews Pending Shipment

Status: ready

## Story

As an organization user (receiver),
I want to see and review incoming shipment requests,
So that I can verify what I'm receiving before accepting.

## Acceptance Criteria

### AC1: Notification Indicator
**Given** I am logged in as an organization user
**When** a shipment is pending with my organization as destination
**Then** I see a notification indicator on the Shipments menu

### AC2: Incoming Shipments Tab
**Given** I navigate to Shipments
**When** I view the "Incoming" tab
**Then** I see all pending shipments addressed to my organization
**And** columns show: Code, From Org, Packages, Volume m³, Submitted Date, Actions

### AC3: Shipment Detail View
**Given** I click on a pending shipment
**When** the detail view opens
**Then** I see full package list with all attributes
**And** I see sender's notes (if any)
**And** I see "Accept" and "Reject" buttons

### AC4: Super Admin View
**Given** I am Super Admin
**When** I view Shipments
**Then** I can see all pending shipments across all organizations

## Tasks / Subtasks

- [ ] Task 1: Create shipment tabs structure (AC: 2)
  - [ ] Create `ShipmentTabs` component
  - [ ] Add "Outgoing" tab (sender's shipments)
  - [ ] Add "Incoming" tab (receiver's shipments)
  - [ ] Route to correct tab based on URL param

- [ ] Task 2: Implement incoming shipments query (AC: 2, 4)
  - [ ] Create `getIncomingShipments` server action
  - [ ] Filter by destination org (current user's org)
  - [ ] Include package count and total volume
  - [ ] For Super Admin: show all incoming across orgs

- [ ] Task 3: Create IncomingShipmentsTable (AC: 2)
  - [ ] Display Code, From Org, Packages, Volume, Submitted Date
  - [ ] Add status badge (Pending highlighted)
  - [ ] Make rows clickable to open detail

- [ ] Task 4: Add notification indicator (AC: 1)
  - [ ] Create `getPendingShipmentCount` server action
  - [ ] Add badge to Shipments nav item
  - [ ] Update on page load

- [ ] Task 5: Update shipment detail view (AC: 3)
  - [ ] Show full package list in table format
  - [ ] Display sender's notes if present
  - [ ] Show Accept and Reject buttons for pending shipments
  - [ ] Hide action buttons for non-pending or non-receiver

- [ ] Task 6: Verification (AC: all)
  - [ ] Pending shipments show notification badge
  - [ ] Incoming tab shows shipments to my org
  - [ ] Detail view shows packages and action buttons
  - [ ] Super Admin sees all pending shipments
  - [ ] Build passes: `pnpm turbo build --filter=@timber/portal`

## Dev Notes

### Tab Structure

```
/shipments/
├── ?tab=outgoing (default for org users)
├── ?tab=incoming
└── ?tab=all (Super Admin only - Story 9.3)
```

### Incoming Shipments Query

```sql
SELECT
  s.*,
  from_org.name as from_org_name,
  from_org.code as from_org_code,
  COUNT(sp.id) as package_count,
  SUM(sp.volume_m3) as total_volume
FROM shipments s
JOIN organisations from_org ON s.from_organisation_id = from_org.id
LEFT JOIN shipment_packages sp ON sp.shipment_id = s.id
WHERE s.to_organisation_id = :currentOrgId
  AND s.status IN ('pending', 'accepted', 'completed', 'rejected')
GROUP BY s.id, from_org.id
ORDER BY s.submitted_at DESC;
```

### Notification Badge

```tsx
// In sidebar navigation
<NavItem href="/shipments">
  Shipments
  {pendingCount > 0 && (
    <Badge variant="destructive" className="ml-2">
      {pendingCount}
    </Badge>
  )}
</NavItem>
```

### References

- [Source: epics.md#Story-8.4-Receiver-Reviews-Pending-Shipment]
- [Story 8.3: Submit Shipment] (dependency)
- [Story 8.5: Accept or Reject] (next step)

## Dev Agent Record

### Change Log

- 2026-01-25: Story 8.4 created and ready for development
