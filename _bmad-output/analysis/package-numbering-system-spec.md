# Package Numbering System Specification

**Status:** Planned (not yet implemented)
**Created:** 2026-02-18
**Scope:** All future shipments (incoming and outgoing)

## Overview

A unified package numbering system that applies globally across all shipments regardless of direction (incoming/outgoing) or parties involved.

## Format

```
TWP-{SHIPMENT_NUMBER}-{PACKAGE_NUMBER}
```

### Components

| Part | Format | Description |
|------|--------|-------------|
| `TWP` | Fixed | Timber World Platform prefix (constant) |
| `{SHIPMENT_NUMBER}` | 3 digits | Global sequential number (001, 002, 003...) |
| `{PACKAGE_NUMBER}` | 2 digits | Sequential within each shipment (01, 02...) |

### Examples

| Package Number | Meaning |
|----------------|---------|
| `TWP-001-01` | First package of first shipment |
| `TWP-001-02` | Second package of first shipment |
| `TWP-001-15` | 15th package of first shipment |
| `TWP-002-01` | First package of second shipment |
| `TWP-100-01` | First package of 100th shipment |

## Key Rules

1. **Universal Application** - Same format for ALL shipments:
   - Incoming shipments from external suppliers
   - Outgoing shipments to customers
   - Internal transfers between organizations

2. **Global Shipment Counter** - The `{SHIPMENT_NUMBER}` increments globally across the entire platform, not per organization or direction.

3. **Package Counter Per Shipment** - The `{PACKAGE_NUMBER}` resets to `01` for each new shipment.

4. **No Retroactive Updates** - Existing packages retain their current numbering. This system applies only to packages created after implementation.

5. **Immutable Once Assigned** - Package numbers cannot change after creation.

## Implementation Notes

### Database Considerations

**Option A: Use existing `shipment_number`**
- If `shipments.shipment_number` already increments globally, use it directly
- Package number derived from `package_sequence` within shipment

**Option B: New sequence table**
- Create `package_number_sequences` table with global counter
- More control but additional complexity

### Files to Modify

When implementing:

1. **`apps/portal/src/features/shipments/actions/saveIncomingShipmentPackages.ts`**
   - Update package number generation for incoming external shipments
   - Query or increment global shipment counter
   - Generate sequential package numbers

2. **`apps/portal/src/features/shipments/actions/addPackagesToShipment.ts`** (if exists)
   - Same pattern for outgoing shipments

3. **`apps/portal/src/features/shipments/components/IncomingShipmentPackageEditor.tsx`**
   - Update client-side preview to show new format
   - May need to fetch current shipment's TWP number from server

### Edge Cases to Handle

- **Package deletion** - Numbers should NOT be reused or reassigned
- **Maximum packages** - 99 packages per shipment (2-digit limit). Consider if this is sufficient.
- **Maximum shipments** - 999 shipments (3-digit limit). Consider when to expand to 4 digits.

## Current Package Numbering (Legacy)

The existing system uses various formats:
- Shipment-based: `{SHIPMENT_CODE}-{SEQ}` (e.g., `OUT-TWP-001-01`)
- Legacy formats from imports

These will continue to exist alongside the new system. No migration required.

## Approval

- **User approval:** Confirmed (2026-02-18)
- **Implementation timing:** Deferred to future sprint
- **First use case:** Incoming shipments from external suppliers
