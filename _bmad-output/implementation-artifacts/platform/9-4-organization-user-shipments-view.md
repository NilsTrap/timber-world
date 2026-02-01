# Story 9.4: Organization User Shipments View

Status: ready

## Story

As an organization user,
I want to see my sent and received shipments,
So that I can track my organization's goods movement.

## Acceptance Criteria

### AC1: Tab Visibility
**Given** I am logged in as an organization user
**When** I navigate to Shipments
**Then** I see two tabs: "Outgoing" and "Incoming"
**And** I do NOT see the "All Shipments" tab (Super Admin only)

### AC2: Outgoing Shipments
**Given** I am viewing Outgoing shipments
**When** I see the table
**Then** I see only shipments where my org is the sender
**And** columns show: Code, To Org, Packages, Volume m³, Status, Date

### AC3: Incoming Shipments with Actions
**Given** I am viewing Incoming shipments
**When** I see the table
**Then** I see only shipments where my org is the receiver
**And** columns show: Code, From Org, Packages, Volume m³, Status, Date
**And** pending shipments show action buttons (Accept/Reject)

### AC4: Notification Badge
**Given** I have pending incoming shipments
**When** I view the Shipments menu item
**Then** I see a notification badge with the count

## Tasks / Subtasks

- [ ] Task 1: Finalize tab structure for org users (AC: 1)
  - [ ] Ensure org users only see Outgoing and Incoming tabs
  - [ ] Hide "All Shipments" tab for non-Super Admin
  - [ ] Default to Outgoing tab

- [ ] Task 2: Implement outgoing shipments for org user (AC: 2)
  - [ ] Create/update `getOutgoingShipments` action
  - [ ] Filter by sender org = current user's org
  - [ ] Display in table with all columns

- [ ] Task 3: Implement incoming shipments for org user (AC: 3)
  - [ ] Create/update `getIncomingShipments` action
  - [ ] Filter by receiver org = current user's org
  - [ ] Add Accept/Reject action buttons for pending rows

- [ ] Task 4: Add navigation notification badge (AC: 4)
  - [ ] Query pending incoming count for current org
  - [ ] Display badge on Shipments nav item
  - [ ] Update on navigation/page load

- [ ] Task 5: Integrate action buttons with dialogs (AC: 3)
  - [ ] Accept button opens confirmation dialog
  - [ ] Reject button opens reason input dialog
  - [ ] Refresh table after action completes

- [ ] Task 6: Verification (AC: all)
  - [ ] Org user sees only Outgoing and Incoming tabs
  - [ ] Outgoing shows shipments sent by org
  - [ ] Incoming shows shipments received by org
  - [ ] Pending shipments have action buttons
  - [ ] Notification badge shows pending count
  - [ ] Build passes: `pnpm turbo build --filter=@timber/portal`

## Dev Notes

### Tab Visibility Logic

```tsx
const { isSuperAdmin, organisationId } = await getSession();

return (
  <Tabs defaultValue="outgoing">
    <TabsList>
      <TabsTrigger value="outgoing">Outgoing</TabsTrigger>
      <TabsTrigger value="incoming">
        Incoming
        {pendingCount > 0 && <Badge>{pendingCount}</Badge>}
      </TabsTrigger>
      {isSuperAdmin && (
        <TabsTrigger value="all">All Shipments</TabsTrigger>
      )}
    </TabsList>
    {/* Tab content */}
  </Tabs>
);
```

### Action Buttons in Table

```tsx
{shipment.status === 'pending' && (
  <div className="flex gap-2">
    <Button
      size="sm"
      onClick={() => setAcceptDialogOpen(shipment.id)}
    >
      Accept
    </Button>
    <Button
      size="sm"
      variant="outline"
      onClick={() => setRejectDialogOpen(shipment.id)}
    >
      Reject
    </Button>
  </div>
)}
```

### Sidebar Badge Integration

```tsx
// In sidebar/navigation component
const pendingShipments = await getPendingShipmentCount();

<NavItem href="/shipments" icon={<TruckIcon />}>
  Shipments
  {pendingShipments > 0 && (
    <Badge
      variant="destructive"
      className="ml-auto h-5 min-w-[20px] px-1.5"
    >
      {pendingShipments}
    </Badge>
  )}
</NavItem>
```

### References

- [Source: epics.md#Story-9.4-Organization-User-Shipments-View]
- [Story 8.4: Receiver Reviews] (incoming shipments)
- [Story 8.5: Accept/Reject] (action handling)
- [Story 8.6: Shipment History] (tab structure)

## Dev Agent Record

### Change Log

- 2026-01-25: Story 9.4 created and ready for development
