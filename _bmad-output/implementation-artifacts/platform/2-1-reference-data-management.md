# Story 2.1: Reference Data Management

## Story Information

| Field | Value |
|-------|-------|
| **Story ID** | 2.1 |
| **Epic** | Epic 2: Admin Inventory Management |
| **Title** | Reference Data Management |
| **Status** | done |
| **Created** | 2026-01-22 |
| **Priority** | High |

## User Story

**As an** Admin,
**I want** to manage all dropdown options (product names, species, humidity, etc.),
**So that** users can select from consistent, controlled lists when entering inventory.

## Acceptance Criteria

### AC1: Reference Data Navigation
**Given** I am logged in as Admin
**When** I navigate to Admin > Reference Data
**Then** I see a menu/tabs for all reference tables: Product Names, Wood Species, Humidity, Types, Processing, FSC, Quality

### AC2: View Reference Table
**Given** I select a reference table (e.g., Wood Species)
**When** the page loads
**Then** I see a table with columns: Value, Sort Order, Status (Active/Inactive), Actions
**And** I see an "Add" button

### AC3: Add New Option
**Given** I am viewing a reference table
**When** I click "Add" and enter a new value
**Then** the option is saved to the database
**And** I see a success toast "Option added"
**And** the new option appears in the table

### AC4: Edit Option
**Given** I am viewing a reference table
**When** I click Edit on a row and modify the value
**Then** changes are saved to the database
**And** I see a success toast "Option updated"

### AC5: Deactivate Option
**Given** I want to remove an option
**When** I click Deactivate on a row
**Then** the option is marked inactive (is_active = false)
**And** the option no longer appears in dropdown selectors
**And** I see a success toast "Option deactivated"

### AC6: Duplicate Prevention
**Given** I try to add a value that already exists
**When** I click Save
**Then** I see an error "This value already exists"
**And** the form is not submitted

### AC7: Reorder Options
**Given** I want to change the order of options
**When** I drag and drop rows (or use up/down buttons)
**Then** the sort_order is updated
**And** dropdowns will show options in the new order

---

## Technical Implementation Guide

### Architecture Context

This story implements admin CRUD for all 7 reference tables that provide dropdown options for inventory entry. Each reference table has the same structure (value, sort_order, is_active).

**Key Patterns (from project-context.md):**
- Server Actions with `ActionResult<T>` return type
- Zod validation on all form inputs
- React Hook Form for form management
- Toast notifications for feedback (sonner)
- Feature-based file organization

### Technology Stack

| Technology | Usage |
|------------|-------|
| Supabase | Reference table CRUD operations |
| React Hook Form | Form state management |
| Zod | Runtime validation |
| Server Actions | Create/update/delete handling |
| sonner | Toast notifications |
| shadcn/ui | Table, Button, Input, Dialog, Tabs components |

### Database Schema

Reference tables already exist from migration `20260122000002_inventory_model_v2.sql`:

```sql
-- All reference tables have same structure
CREATE TABLE ref_[name] (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

Tables: `ref_product_names`, `ref_wood_species`, `ref_humidity`, `ref_types`, `ref_processing`, `ref_fsc`, `ref_quality`

### Implementation Tasks

#### Task 1: Create Reference Data Feature Structure
- [x] Create `apps/portal/src/features/reference-data/` folder
- [x] Create `schemas/referenceOption.ts` - Zod schema for options
- [x] Create `types.ts` - TypeScript types
- [x] Create barrel exports

#### Task 2: Create Server Actions
- [x] `actions/getReferenceOptions.ts` - Fetch options for a table
- [x] `actions/createReferenceOption.ts` - Add new option
- [x] `actions/updateReferenceOption.ts` - Edit option value
- [x] `actions/toggleReferenceOption.ts` - Activate/deactivate
- [x] `actions/reorderReferenceOptions.ts` - Update sort order
- [x] Create `actions/index.ts` barrel export

#### Task 3: Create Components
- [x] `components/ReferenceTableSelector.tsx` - Tabs/menu to select table
- [x] `components/ReferenceOptionsTable.tsx` - Display options with actions
- [x] `components/ReferenceOptionForm.tsx` - Add/edit dialog
- [x] Create `components/index.ts` barrel export

#### Task 4: Create Admin Reference Page
- [x] Update `apps/portal/src/app/(portal)/admin/reference/page.tsx`
- [x] Add table selector component
- [x] Add options table with CRUD actions
- [x] Admin role check

#### Task 5: Update Navigation
- [x] Add "Reference Data" link to admin navigation
- [x] Ensure proper active state styling

---

## Dev Notes

### Reference Table Mapping

| Table Name | Display Name | Route Param |
|------------|--------------|-------------|
| ref_product_names | Product Names | product-names |
| ref_wood_species | Wood Species | wood-species |
| ref_humidity | Humidity | humidity |
| ref_types | Types | types |
| ref_processing | Processing | processing |
| ref_fsc | FSC | fsc |
| ref_quality | Quality | quality |

### Server Action Pattern

```typescript
// Generic action that works for any reference table
export async function getReferenceOptions(
  tableName: ReferenceTableName
): Promise<ActionResult<ReferenceOption[]>> {
  // Validate table name is in allowed list
  // Fetch from appropriate table
  // Return sorted by sort_order
}
```

### File Organization

```
apps/portal/src/features/reference-data/
├── actions/
│   ├── getReferenceOptions.ts
│   ├── createReferenceOption.ts
│   ├── updateReferenceOption.ts
│   ├── toggleReferenceOption.ts
│   ├── reorderReferenceOptions.ts
│   └── index.ts
├── components/
│   ├── ReferenceTableSelector.tsx
│   ├── ReferenceOptionsTable.tsx
│   ├── ReferenceOptionForm.tsx
│   └── index.ts
├── schemas/
│   ├── referenceOption.ts
│   └── index.ts
├── types.ts
└── index.ts
```

### What NOT to Build in This Story

- Parties management (that's Story 2.2)
- Shipment creation (that's Story 2.3)
- Inventory overview (that's Story 2.4)
- Reference data usage in forms (later stories)

---

## Testing Checklist

- [ ] Reference data page displays all 7 table tabs
- [ ] Clicking a tab shows the correct options
- [ ] "Add" button opens form dialog
- [ ] New option appears after adding
- [ ] Edit updates the value correctly
- [ ] Deactivate marks option as inactive
- [ ] Duplicate values show error
- [ ] Reordering updates sort_order
- [ ] Non-admin users cannot access page
- [ ] No TypeScript errors
- [ ] Code follows project conventions

---

## Definition of Done

- [x] Admin can view all reference tables
- [x] Admin can add new options
- [x] Admin can edit existing options
- [x] Admin can deactivate options
- [x] Admin can reorder options
- [x] Duplicate values are prevented
- [x] Success/error toasts shown appropriately
- [x] Admin role check enforced
- [x] No TypeScript errors
- [x] Code follows project conventions

---

## Dev Agent Record

### Implementation Date
2026-01-22

### Files Created/Modified

#### Reference Data Feature
- `apps/portal/src/features/reference-data/` - New feature folder
  - `types.ts` - TypeScript types, table mappings, `VALID_REFERENCE_TABLES`, `isValidUUID()`
  - `schemas/referenceOption.ts` - Zod validation schemas
  - `schemas/index.ts` - Barrel export
  - `actions/getReferenceOptions.ts` - Fetch options
  - `actions/createReferenceOption.ts` - Add new option (sort_order starts at 1)
  - `actions/updateReferenceOption.ts` - Edit option (with UUID validation)
  - `actions/toggleReferenceOption.ts` - Activate/deactivate (with UUID validation)
  - `actions/reorderReferenceOptions.ts` - Change sort order
  - `actions/index.ts` - Barrel export
  - `components/ReferenceTableSelector.tsx` - Tab navigation
  - `components/ReferenceOptionsTable.tsx` - Table with CRUD, sortable columns
  - `components/ReferenceOptionForm.tsx` - Add/edit dialog with form reset fix
  - `components/ReferenceDataManager.tsx` - Main client component
  - `components/index.ts` - Barrel export
  - `index.ts` - Feature barrel export
- `apps/portal/src/app/(portal)/admin/reference/page.tsx` - Admin reference page

#### Sidebar Navigation (Portal-wide)
- `apps/portal/src/components/layout/Sidebar.tsx` - New collapsible sidebar component
- `apps/portal/src/components/layout/SidebarLink.tsx` - Sidebar navigation link component
- `apps/portal/src/components/layout/SidebarWrapper.tsx` - Server component for session/role
- `apps/portal/src/app/(portal)/layout.tsx` - Updated to use sidebar layout
- `apps/portal/src/components/layout/TopNav.tsx` - Deprecated (replaced by Sidebar)
- `apps/portal/src/components/layout/NavLink.tsx` - Added Settings icon

#### Shared UI Components
- `packages/ui/src/components/table.tsx` - New Table component
- `packages/ui/src/components/tabs.tsx` - New Tabs component
- `packages/ui/src/components/badge.tsx` - New Badge component
- `packages/ui/src/index.ts` - Updated exports

### Code Review Fixes Applied
- **H2**: Form reset bug - Added `useEffect` to reset form when option prop changes
- **H3**: UUID validation - Added `isValidUUID()` function and validation in server actions
- **M2**: Duplicate constants - Extracted `VALID_REFERENCE_TABLES` to types.ts
- **M3**: Reorder loading state - Added `isReordering` state with optimistic updates
- **L1**: Removed unused `getRouteParam` function
- **L2**: Added aria-labels to all icon buttons

### Post-Implementation Enhancements
1. **Sidebar Navigation**: Replaced top navigation with collapsible left sidebar
   - Persists collapse state to localStorage
   - Shows icons only when collapsed, icons + labels when expanded
   - Role-based navigation items (Admin vs Producer)
   - Profile and Logout moved to sidebar footer

2. **Table Sorting**: Added sortable columns to Reference Options table
   - Default sort: alphabetical by Value (ascending)
   - Clickable column headers (Order, Value, Status)
   - Visual sort indicators (arrows)
   - Order numbers start at 1 (not 0)

### Completion Notes
Implemented full CRUD for reference data management. All 7 reference tables (Product Names, Wood Species, Humidity, Types, Processing, FSC, Quality) can be managed through a unified interface with tabs. Features include add, edit, deactivate/activate, reorder (up/down buttons), and sortable columns. Portal now uses collapsible sidebar navigation for better UX. Used type assertions for Supabase queries since generated types don't include the new reference tables yet.

### Ad-Hoc Enhancement (2026-01-26)
**Super Admin Delete Reference Options**
- Added `deleteReferenceOption` server action (Super Admin only)
- Added delete button (trash icon) to ReferenceOptionsTable for Super Admin
- Delete confirmation dialog before permanent deletion
- Files modified: `deleteReferenceOption.ts` (new), `ReferenceOptionsTable.tsx`, `ReferenceDataManager.tsx`, `admin/reference/page.tsx`
