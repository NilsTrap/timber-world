# Story 8.5: Accept or Reject Shipment

Status: ready

## Story

As an organization user (receiver),
I want to accept or reject an incoming shipment,
So that I control what inventory enters my organization.

## Acceptance Criteria

### AC1: Accept Confirmation
**Given** I am viewing a pending shipment addressed to my organization
**When** I click "Accept"
**Then** I see a confirmation dialog "Accept X packages (Y m³) from {Org}?"

### AC2: Accept Action and Inventory Transfer
**Given** I confirm acceptance
**When** the action completes
**Then** shipment status changes to "accepted"
**And** `reviewed_at` and `reviewed_by` are set
**And** inventory packages are moved: `organisation_id` updated to my org
**And** shipment status changes to "completed"
**And** `completed_at` is set
**And** sender sees the shipment as "Completed"

### AC3: Reject Requires Reason
**Given** I click "Reject"
**When** I am prompted
**Then** I must enter a rejection reason (required)

### AC4: Reject Action
**Given** I confirm rejection with a reason
**When** the action completes
**Then** shipment status changes to "rejected"
**And** `rejection_reason` is saved
**And** packages remain with sender (no inventory movement)
**And** sender sees the shipment as "Rejected" with the reason

## Tasks / Subtasks

- [ ] Task 1: Create accept confirmation dialog (AC: 1)
  - [ ] Create `AcceptShipmentDialog` component
  - [ ] Display sender organization name
  - [ ] Display package count and total volume
  - [ ] Add Confirm and Cancel buttons

- [ ] Task 2: Implement accept shipment action (AC: 2)
  - [ ] Create `acceptShipment` server action
  - [ ] Verify user belongs to destination org
  - [ ] Verify shipment is in 'pending' status
  - [ ] Begin transaction:
    - [ ] Update shipment status to 'accepted', set reviewed_at/reviewed_by
    - [ ] Update inventory_packages: set organisation_id to receiver's org
    - [ ] Update shipment status to 'completed', set completed_at
  - [ ] Return success response

- [ ] Task 3: Create reject dialog with reason input (AC: 3)
  - [ ] Create `RejectShipmentDialog` component
  - [ ] Add rejection reason textarea (required)
  - [ ] Validate reason is not empty
  - [ ] Add Confirm and Cancel buttons

- [ ] Task 4: Implement reject shipment action (AC: 4)
  - [ ] Create `rejectShipment` server action
  - [ ] Verify user belongs to destination org
  - [ ] Verify shipment is in 'pending' status
  - [ ] Update status to 'rejected'
  - [ ] Save rejection_reason
  - [ ] Set reviewed_at and reviewed_by
  - [ ] No inventory movement

- [ ] Task 5: Update UI to show completed/rejected states (AC: 2, 4)
  - [ ] Show "Completed" badge for accepted shipments
  - [ ] Show "Rejected" badge with reason for rejected shipments
  - [ ] Hide action buttons after decision is made

- [ ] Task 6: Verification (AC: all)
  - [ ] Accept shows confirmation and transfers inventory
  - [ ] Reject requires reason and keeps inventory with sender
  - [ ] Shipment statuses update correctly
  - [ ] Sender sees final status
  - [ ] Build passes: `pnpm turbo build --filter=@timber/portal`

## Dev Notes

### Inventory Transfer Logic

When accepting a shipment, the key operation is:

```sql
-- Update packages to new owner
UPDATE inventory_packages
SET organisation_id = :receiverOrgId
WHERE id IN (
  SELECT package_id FROM shipment_packages
  WHERE shipment_id = :shipmentId
);
```

**Important:** If packages support partial quantities in shipments, we may need to:
1. Deduct from sender's package
2. Create new package record for receiver
3. Link both to the shipment

For MVP, assuming full package transfer is simpler.

### Server Actions

```typescript
export async function acceptShipment(
  shipmentId: string
): Promise<ActionResult<Shipment>> {
  // 1. Verify user is in destination org
  // 2. Verify shipment status is 'pending'
  // 3. Transaction:
  //    - Set status = 'accepted', reviewed_at, reviewed_by
  //    - Transfer inventory ownership
  //    - Set status = 'completed', completed_at
  // 4. Return updated shipment
}

export async function rejectShipment(
  shipmentId: string,
  reason: string
): Promise<ActionResult<Shipment>> {
  // 1. Verify user is in destination org
  // 2. Verify shipment status is 'pending'
  // 3. Verify reason is not empty
  // 4. Set status = 'rejected', rejection_reason, reviewed_at, reviewed_by
  // 5. Return updated shipment
}
```

### Accept Confirmation Dialog

```tsx
<Dialog>
  <DialogHeader>Accept Shipment?</DialogHeader>
  <DialogContent>
    <p>Accept <strong>{packageCount}</strong> packages ({totalVolume} m³) from <strong>{fromOrg.name}</strong>?</p>
    <p className="text-muted mt-2">
      These packages will be added to your inventory.
    </p>
  </DialogContent>
  <DialogFooter>
    <Button variant="outline" onClick={onCancel}>Cancel</Button>
    <Button onClick={onConfirm}>Accept Shipment</Button>
  </DialogFooter>
</Dialog>
```

### References

- [Source: epics.md#Story-8.5-Accept-or-Reject-Shipment]
- [Story 8.4: Receiver Reviews] (dependency)
- [Story 8.6: History & Tracking] (shows final states)

## Dev Agent Record

### Change Log

- 2026-01-25: Story 8.5 created and ready for development
