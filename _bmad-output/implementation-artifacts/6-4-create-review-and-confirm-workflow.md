# Story 6.4: Create Review and Confirm Workflow

Status: ready-for-dev

## Story

As a **Content Manager**,
I want **to review and confirm updates before they go live**,
so that **I maintain control over what appears on the public site** (FR38).

## Acceptance Criteria

1. **Given** uploaded data has passed validation
   **When** the review screen displays
   **Then** a summary shows: products to add, products to update, products unchanged

2. **Given** the review screen is displayed
   **When** viewing changes
   **Then** detailed diff view shows before/after for updated products

3. **Given** review is complete
   **When** user clicks "Confirm Update"
   **Then** changes are applied to the database

4. **Given** review is in progress
   **When** user clicks "Cancel"
   **Then** the upload is discarded without changes

5. **Given** the confirm action
   **When** displayed
   **Then** confirmation requires explicit action (not auto-apply)

6. **Given** update succeeds
   **When** complete
   **Then** confirmation shows count of affected products

7. **Given** update is confirmed
   **When** public site loads
   **Then** the public catalog reflects updates immediately (FR41)

8. **Given** any update action
   **When** performed
   **Then** an audit log entry records the update action

## Tasks / Subtasks

- [ ] Task 1: Build Review Summary (AC: 1)
  - [ ] 1.1: Create ReviewSummary component
  - [ ] 1.2: Calculate: new products, updated products, unchanged
  - [ ] 1.3: Display counts in card format
  - [ ] 1.4: Show breakdown by change type (price, stock, both)

- [ ] Task 2: Implement Diff View (AC: 2)
  - [ ] 2.1: Create ProductDiff component
  - [ ] 2.2: Show side-by-side current vs new values
  - [ ] 2.3: Highlight changed fields (visual diff)
  - [ ] 2.4: Paginate if many changes (>50 rows)

- [ ] Task 3: Create Confirm/Cancel Actions (AC: 3, 4, 5)
  - [ ] 3.1: Add "Confirm Update" button with confirmation dialog
  - [ ] 3.2: Add "Cancel" button that clears upload state
  - [ ] 3.3: Require explicit checkbox: "I have reviewed these changes"
  - [ ] 3.4: Show warning count in confirm dialog

- [ ] Task 4: Apply Database Updates (AC: 6, 7)
  - [ ] 4.1: Create Server Action `applyProductUpdates`
  - [ ] 4.2: Use Supabase upsert for bulk updates
  - [ ] 4.3: Handle partial failures (rollback on error)
  - [ ] 4.4: Invalidate any cached product data

- [ ] Task 5: Audit Logging (AC: 8)
  - [ ] 5.1: Create `audit_logs` table if not exists
  - [ ] 5.2: Log: user_id, action, timestamp, affected_count, details
  - [ ] 5.3: Store before/after snapshot for rollback capability

## Dev Notes

### Architecture Compliance

**File Structure:**
```
src/
├── app/admin/products/upload/
│   └── page.tsx                    # Upload flow (upload → validate → review → confirm)
├── components/features/admin/
│   ├── ReviewSummary.tsx           # Change summary
│   ├── ProductDiff.tsx             # Before/after comparison
│   └── ConfirmDialog.tsx           # Confirmation modal
├── lib/
│   └── actions/
│       └── products.ts             # applyProductUpdates action
```

### Technical Requirements

**Review Summary Data:**
```typescript
interface ReviewSummary {
  totalRows: number
  newProducts: number
  updatedProducts: number
  unchangedProducts: number
  changes: ProductChange[]
}

interface ProductChange {
  sku: string
  changeType: 'new' | 'updated' | 'unchanged'
  currentValues?: Partial<Product>
  newValues: Partial<Product>
  changedFields: string[]
}
```

**Server Action Pattern:**
```typescript
export async function applyProductUpdates(
  changes: ProductChange[],
  uploadType: 'inventory' | 'pricing'
): Promise<ActionResult<{ affected: number }>> {
  // 1. Start transaction
  // 2. Apply updates
  // 3. Log to audit table
  // 4. Return result
}
```

**Audit Log Schema:**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES admin_users(id),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  affected_count INTEGER,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### UI Components

**ReviewSummary Layout:**
```
┌─────────────────────────────────────────┐
│  📊 Upload Summary                       │
├─────────┬─────────┬─────────┬──────────┤
│ 📥 New  │ 🔄 Update│ ✓ Same  │ 📋 Total │
│   5     │   23    │   72    │   100    │
└─────────┴─────────┴─────────┴──────────┘
```

**Diff View:**
```
┌────────────────────────────────────────┐
│ SKU: OAK-FJ-22-1200                    │
├──────────────┬─────────────────────────┤
│ Field        │ Current → New           │
├──────────────┼─────────────────────────┤
│ unit_price_m3│ €2,400 → €2,500 (+4.2%)│
│ stock_qty    │ 120 → 150 (+30)         │
└──────────────┴─────────────────────────┘
```

### Rollback Strategy (NFR53)

- Store complete before-state in audit_logs.details
- If update fails mid-way, transaction rollback handles it
- Manual rollback: Admin can view audit log and revert specific changes

### Dependencies

- **Story 6.2**: Upload functionality
- **Story 6.3**: Validation must pass before review

### References

- [Source: prd.md#FR38] - Review/confirm requirement
- [Source: prd.md#FR41] - Public catalog update
- [Source: architecture.md#NFR53] - Rollback capability
- [Source: architecture.md#NFR15] - Admin actions logged

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

