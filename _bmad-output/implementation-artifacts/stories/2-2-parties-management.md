# Story 2.2: Parties Management

## Story Information

| Field | Value |
|-------|-------|
| **Story ID** | 2.2 |
| **Epic** | Epic 2: Admin Inventory Management |
| **Title** | Parties Management |
| **Status** | done |
| **Created** | 2026-01-22 |
| **Priority** | High |

## User Story

**As an** Admin,
**I want** to manage parties (organizations like Timber World, producers),
**So that** I can create shipments between them.

## Acceptance Criteria

### AC1: View Parties Table
**Given** I am logged in as Admin
**When** I navigate to Admin > Parties
**Then** I see a table of all parties with columns: Code, Name, Status, Actions

### AC2: Add Party
**Given** I am viewing the parties table
**When** I click "Add Party"
**Then** I see a form with fields: Code (3 uppercase letters, required), Name (required)

### AC3: Create Party
**Given** I am adding a new party
**When** I enter a valid 3-letter code and name
**Then** the party is created
**And** I see a success toast "Party created"
**And** the party appears in the table

### AC4: Code Validation
**Given** I try to add a party with an existing code
**When** I click Save
**Then** I see an error "Party code already exists"

**Given** I enter a code that is not exactly 3 uppercase letters
**When** I try to save
**Then** I see a validation error "Code must be exactly 3 uppercase letters"

### AC5: Edit Party
**Given** I am editing a party
**When** I modify the name and save
**Then** the name is updated
**And** the code remains unchanged (immutable)

### AC6: Deactivate Party
**Given** I try to deactivate a party
**When** the party has existing shipments
**Then** I see a warning "This party has X shipments"
**And** I can only deactivate (soft delete), not delete

---

## Technical Implementation Guide

### Architecture Context

Parties are organizations that participate in shipments. The `parties` table stores the 3-letter code and name. Initial parties (TWP, INE) are seeded in the migration.

### Database Schema

```sql
CREATE TABLE parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code CHAR(3) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT parties_code_uppercase CHECK (code = UPPER(code))
);
```

### Implementation Tasks

#### Task 1: Create Parties Feature Structure
- [x] Create `apps/portal/src/features/parties/` folder
- [x] Create schemas, types, barrel exports

#### Task 2: Create Server Actions
- [x] `getParties.ts` - Fetch all parties
- [x] `createParty.ts` - Add new party
- [x] `updateParty.ts` - Edit party name
- [x] `toggleParty.ts` - Activate/deactivate
- [x] `getPartyShipmentCount.ts` - Count shipments for deactivation warning

#### Task 3: Create Components
- [x] `PartiesTable.tsx` - Display parties with actions
- [x] `PartyForm.tsx` - Add/edit dialog

#### Task 4: Create Admin Parties Page
- [x] Create `apps/portal/src/app/(portal)/admin/parties/page.tsx`
- [x] Create loading.tsx and error.tsx
- [x] Add Parties navigation link to sidebar

---

## File Organization

```
apps/portal/src/features/parties/
├── actions/
│   ├── getParties.ts
│   ├── createParty.ts
│   ├── updateParty.ts
│   ├── toggleParty.ts
│   └── index.ts
├── components/
│   ├── PartiesTable.tsx
│   ├── PartyForm.tsx
│   └── index.ts
├── schemas/
│   └── party.ts
├── types.ts
└── index.ts
```

---

## Definition of Done

- [x] Parties page displays all parties
- [x] Admin can add new parties with 3-letter codes
- [x] Admin can edit party names
- [x] Admin can deactivate parties
- [x] Code validation enforced (3 uppercase letters, unique)
- [x] Parties with shipments show warning (cannot be hard deleted)
- [x] No TypeScript errors
- [x] Build passes

---

## Dev Agent Record

### Implementation Summary

**Date:** 2026-01-22
**Status:** Completed

### Files Created

**Feature Structure:**
- `apps/portal/src/features/parties/types.ts` - Party type definitions
- `apps/portal/src/features/parties/schemas/party.ts` - Zod validation schemas
- `apps/portal/src/features/parties/schemas/index.ts` - Schema exports
- `apps/portal/src/features/parties/index.ts` - Barrel exports

**Server Actions:**
- `apps/portal/src/features/parties/actions/getParties.ts` - Fetch all parties
- `apps/portal/src/features/parties/actions/createParty.ts` - Create new party
- `apps/portal/src/features/parties/actions/updateParty.ts` - Update party name
- `apps/portal/src/features/parties/actions/toggleParty.ts` - Activate/deactivate
- `apps/portal/src/features/parties/actions/getPartyShipmentCount.ts` - Count shipments for warning
- `apps/portal/src/features/parties/actions/index.ts` - Action exports

**Components:**
- `apps/portal/src/features/parties/components/PartiesTable.tsx` - Table with CRUD actions
- `apps/portal/src/features/parties/components/PartyForm.tsx` - Add/edit dialog
- `apps/portal/src/features/parties/components/index.ts` - Component exports

**Pages:**
- `apps/portal/src/app/(portal)/admin/parties/page.tsx` - Parties management page
- `apps/portal/src/app/(portal)/admin/parties/loading.tsx` - Loading state
- `apps/portal/src/app/(portal)/admin/parties/error.tsx` - Error boundary

### Files Modified

- `apps/portal/src/components/layout/SidebarLink.tsx` - Added Building2 icon
- `apps/portal/src/components/layout/SidebarWrapper.tsx` - Added Parties nav link

### Key Features Implemented

1. **Parties Table** - Displays all parties with Code, Name, Status columns
2. **Add Party** - Dialog form with 3-letter code validation (auto-uppercase)
3. **Edit Party** - Name editable, code immutable (disabled field)
4. **Deactivate Party** - Confirmation dialog showing shipment count warning
5. **Code Validation** - Zod schema enforces 3 uppercase letters, unique check
6. **Sidebar Navigation** - Building2 icon, link to /admin/parties

### Patterns Followed

- Same patterns as Story 2.1 (Reference Data Management)
- Feature-based folder structure
- Server Actions with ActionResult<T> pattern
- AlertDialog for deactivation confirmation
- Toast notifications for success/error feedback
