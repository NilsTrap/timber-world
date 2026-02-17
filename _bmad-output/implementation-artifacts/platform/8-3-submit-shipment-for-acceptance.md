# Story 8.3: Submit Shipment for Acceptance

Status: done

## Story

As an organization user,
I want to submit my shipment draft for receiver approval,
So that the receiving organization can review before goods move.

## Acceptance Criteria

### AC1: Submit Confirmation Dialog
**Given** I have a draft shipment with at least one package
**When** I click "Submit for Acceptance"
**Then** I see a confirmation dialog showing: destination org, package count, total m³

### AC2: Submit Action
**Given** I confirm the submission
**When** the action completes
**Then** shipment status changes from "draft" to "pending"
**And** `submitted_at` timestamp is set
**And** I see success message "Shipment submitted for acceptance"

### AC3: Pending State Restrictions
**Given** a shipment is pending
**When** I view it
**Then** I can no longer add or remove packages
**And** I see status "Pending Acceptance"
**And** I see a "Cancel" button (returns to draft)

### AC4: Validation - No Empty Shipments
**Given** I try to submit a shipment with no packages
**When** I click "Submit"
**Then** I see error "At least one package is required"

## Tasks / Subtasks

- [ ] Task 1: Create submit confirmation dialog (AC: 1)
  - [ ] Create `SubmitShipmentDialog` component
  - [ ] Display destination organization name
  - [ ] Display package count
  - [ ] Display total volume (m³)
  - [ ] Add Confirm and Cancel buttons

- [ ] Task 2: Implement submit action (AC: 2, 4)
  - [ ] Create `submitShipmentForAcceptance` server action
  - [ ] Validate shipment has at least one package
  - [ ] Update status to 'pending'
  - [ ] Set submitted_at timestamp
  - [ ] Return success/error response

- [ ] Task 3: Update shipment detail view for pending state (AC: 3)
  - [ ] Show "Pending Acceptance" status badge
  - [ ] Disable package add/remove buttons
  - [ ] Hide "Submit" button
  - [ ] Show "Cancel" button

- [ ] Task 4: Implement cancel submission (AC: 3)
  - [ ] Create `cancelShipmentSubmission` server action
  - [ ] Change status back to 'draft'
  - [ ] Clear submitted_at timestamp
  - [ ] Re-enable package editing

- [ ] Task 5: Verification (AC: all)
  - [ ] Submit button shows confirmation dialog
  - [ ] Successful submit changes status to pending
  - [ ] Pending shipment cannot be edited
  - [ ] Empty shipment cannot be submitted
  - [ ] Cancel returns shipment to draft
  - [ ] Build passes: `pnpm turbo build --filter=@timber/portal`

## Dev Notes

### Status Transitions

```
draft → pending (via Submit for Acceptance)
pending → draft (via Cancel - only sender can do this)
pending → accepted → completed (receiver accepts)
pending → rejected (receiver rejects)
```

### Confirmation Dialog Content

```tsx
<Dialog>
  <DialogHeader>Submit Shipment for Acceptance?</DialogHeader>
  <DialogContent>
    <p>Destination: <strong>{toOrganisation.name}</strong></p>
    <p>Packages: <strong>{packageCount}</strong></p>
    <p>Total Volume: <strong>{totalVolume} m³</strong></p>
    <p className="text-muted">
      The receiving organization will be notified and must accept this shipment
      before inventory is transferred.
    </p>
  </DialogContent>
  <DialogFooter>
    <Button variant="outline" onClick={onCancel}>Cancel</Button>
    <Button onClick={onConfirm}>Submit for Acceptance</Button>
  </DialogFooter>
</Dialog>
```

### Server Action

```typescript
export async function submitShipmentForAcceptance(
  shipmentId: string
): Promise<ActionResult<Shipment>> {
  // 1. Verify user owns the shipment (sender org)
  // 2. Verify shipment is in 'draft' status
  // 3. Verify at least one package exists
  // 4. Update status to 'pending', set submitted_at
  // 5. Return updated shipment
}
```

### References

- [Source: epics.md#Story-8.3-Submit-Shipment-for-Acceptance]
- [Story 8.2: Create Shipment Draft] (dependency)
- [Story 8.4: Receiver Reviews] (next step in flow)

## Dev Agent Record

### Change Log

- 2026-01-25: Story 8.3 created and ready for development
- 2026-02-18: Extended for incoming shipments from external suppliers
  - Receivers can submit incoming shipments "On The Way" (not just senders)
  - Authorization: isOwner OR (isReceiver AND isFromExternal) can submit
  - Cancel submission also available for receivers of incoming external shipments
  - Delete button added to shipment drafts list and detail view
