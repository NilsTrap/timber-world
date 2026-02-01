# Story 8.1: Shipment Schema for Inter-Org Flow

Status: ready

## Story

As a developer,
I want the shipments table extended for inter-org workflows,
So that shipments between organizations include approval flow.

## Acceptance Criteria

### AC1: Shipments Table Extension
**Given** the existing `shipments` table
**When** migrations are applied
**Then** `shipments` table has additional columns:
- status (TEXT: draft, pending, accepted, completed, rejected) - default 'completed' for legacy
- submitted_at (TIMESTAMPTZ, nullable)
- reviewed_at, reviewed_by (for acceptance/rejection)
- rejection_reason (TEXT, nullable)

### AC2: Shipment Packages Support Partial Quantities
**And** `shipment_packages` table (existing) supports partial quantities:
- pieces (INTEGER) - pieces being shipped
- volume_m3 (DECIMAL) - volume being shipped

### AC3: Legacy Data Migration
**And** existing shipments are marked with status = 'completed' (no approval needed for legacy data)

## Tasks / Subtasks

- [ ] Task 1: Create database migration for shipment status workflow (AC: 1, 3)
  - [ ] Add `status` column with CHECK constraint (draft, pending, accepted, completed, rejected)
  - [ ] Set default to 'completed' for new shipments (preserves existing behavior)
  - [ ] Add `submitted_at` TIMESTAMPTZ column (nullable)
  - [ ] Add `reviewed_at` TIMESTAMPTZ column (nullable)
  - [ ] Add `reviewed_by` UUID column with FK to portal_users (nullable)
  - [ ] Add `rejection_reason` TEXT column (nullable)
  - [ ] Update existing shipments to status = 'completed'

- [ ] Task 2: Update inventory_packages table if needed (AC: 2)
  - [ ] Verify pieces and volume_m3 columns exist on inventory_packages
  - [ ] These should already exist from Epic 2 implementation
  - [ ] Add any missing columns for partial shipment support

- [ ] Task 3: Update TypeScript types (AC: 1, 2)
  - [ ] Add ShipmentStatus type: 'draft' | 'pending' | 'accepted' | 'completed' | 'rejected'
  - [ ] Extend Shipment interface with new fields
  - [ ] Update related action types

- [ ] Task 4: Verification (AC: all)
  - [ ] Run migration successfully
  - [ ] Verify existing shipments have status = 'completed'
  - [ ] Verify new shipments can use all status values
  - [ ] Build passes: `pnpm turbo build --filter=@timber/portal`

## Dev Notes

### Migration Strategy

```sql
-- Add shipment status workflow columns
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES portal_users(id);
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add status constraint
ALTER TABLE shipments ADD CONSTRAINT shipments_status_check
  CHECK (status IN ('draft', 'pending', 'accepted', 'completed', 'rejected'));

-- Update existing shipments to completed (they were already processed)
UPDATE shipments SET status = 'completed' WHERE status IS NULL;
```

### TypeScript Types

```typescript
export type ShipmentStatus = 'draft' | 'pending' | 'accepted' | 'completed' | 'rejected';

export interface Shipment {
  id: string;
  code: string;
  fromOrganisationId: string;
  toOrganisationId: string;
  date: string;
  status: ShipmentStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### References

- [Source: epics.md#Story-8.1-Shipment-Schema-for-Inter-Org-Flow]
- [Epic 2: Admin Inventory Management] (existing shipments infrastructure)
- [Epic 6-7: Multi-Tenancy] (organization scoping)

## Dev Agent Record

### Change Log

- 2026-01-25: Story 8.1 created and ready for development
