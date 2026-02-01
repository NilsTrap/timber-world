# Story 8.2: Create Shipment Draft

Status: ready

## Story

As an organization user,
I want to create a shipment draft and select packages,
So that I can prepare a shipment to another organization.

## Acceptance Criteria

### AC1: New Shipment Form
**Given** I am logged in as an organization user
**When** I navigate to Shipments and click "New Shipment"
**Then** I see a form with: To Organisation (dropdown), Notes (optional)

### AC2: Auto-Generated Shipment Code
**Given** I am creating a shipment
**When** I select a destination organization
**Then** the shipment code is auto-generated (e.g., "INE-TWP-001")
**And** a draft shipment record is created

### AC3: Package Selection
**Given** I have a draft shipment
**When** I click "Add Packages"
**Then** I see a package selector showing my organization's available inventory
**And** I can select multiple packages with quantities (pieces/volume)

### AC4: Package Display
**Given** I have selected packages
**When** I view the shipment draft
**Then** I see all selected packages with: Package#, Product, Dimensions, Pieces, Volume
**And** I see totals: Total Packages, Total m³

### AC5: Remove Package
**Given** I have a draft shipment
**When** I remove a package from the selection
**Then** the package is removed from the shipment
**And** totals are recalculated

## Tasks / Subtasks

- [ ] Task 1: Create Shipments navigation and page structure (AC: 1)
  - [ ] Add "Shipments" to sidebar navigation for organization users
  - [ ] Create `/shipments` route and page
  - [ ] Create "New Shipment" button

- [ ] Task 2: Create New Shipment form (AC: 1, 2)
  - [ ] Create `CreateShipmentForm` component
  - [ ] Add destination organization dropdown (exclude own org)
  - [ ] Add optional notes field
  - [ ] Auto-generate shipment code on org selection
  - [ ] Create `createShipmentDraft` server action

- [ ] Task 3: Implement shipment code generation (AC: 2)
  - [ ] Format: [FROM_CODE]-[TO_CODE]-[NUMBER]
  - [ ] Query existing shipments to get next number
  - [ ] Ensure code uniqueness

- [ ] Task 4: Create package selector dialog (AC: 3)
  - [ ] Create `ShipmentPackageSelector` component
  - [ ] Show org's available inventory (quantity > 0)
  - [ ] Allow multi-select with quantity inputs
  - [ ] Validate quantities don't exceed available

- [ ] Task 5: Display selected packages (AC: 4, 5)
  - [ ] Create `ShipmentPackagesTable` component
  - [ ] Show package details with quantities
  - [ ] Calculate and display totals
  - [ ] Add remove button per package

- [ ] Task 6: Create server actions (AC: all)
  - [ ] `createShipmentDraft` - create draft shipment
  - [ ] `addPackagesToShipment` - add packages with quantities
  - [ ] `removePackageFromShipment` - remove package
  - [ ] `getShipmentDraft` - fetch draft with packages

- [ ] Task 7: Verification (AC: all)
  - [ ] Organization user can create new shipment draft
  - [ ] Shipment code auto-generates correctly
  - [ ] Package selector shows available inventory
  - [ ] Selected packages display with totals
  - [ ] Build passes: `pnpm turbo build --filter=@timber/portal`

## Dev Notes

### Shipment Code Format

```typescript
// Example: INE-TWP-001
// [sender_code]-[receiver_code]-[sequence_number]
function generateShipmentCode(fromCode: string, toCode: string, existingCount: number): string {
  const sequence = String(existingCount + 1).padStart(3, '0');
  return `${fromCode}-${toCode}-${sequence}`;
}
```

### Component Structure

```
/shipments/
├── page.tsx (list view with tabs)
├── new/
│   └── page.tsx (create new shipment)
└── [id]/
    └── page.tsx (view/edit draft)

/features/shipments/
├── components/
│   ├── CreateShipmentForm.tsx
│   ├── ShipmentPackageSelector.tsx
│   ├── ShipmentPackagesTable.tsx
│   └── ShipmentTabs.tsx
├── actions/
│   ├── createShipmentDraft.ts
│   ├── addPackagesToShipment.ts
│   ├── removePackageFromShipment.ts
│   └── getShipmentDraft.ts
└── types.ts
```

### Package Selector UX

The package selector should:
1. Show all available inventory packages for the org
2. Allow filtering by product, species, etc.
3. Show available quantity vs already committed
4. Support entering partial quantities (e.g., 100 of 500 pieces)

### References

- [Source: epics.md#Story-8.2-Create-Shipment-Draft]
- [Story 8.1: Shipment Schema] (dependency - must be complete first)
- [Epic 2: Create Shipment] (existing shipment creation patterns)

## Dev Agent Record

### Change Log

- 2026-01-25: Story 8.2 created and ready for development
