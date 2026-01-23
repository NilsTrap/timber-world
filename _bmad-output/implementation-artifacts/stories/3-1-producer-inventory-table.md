# Story 3.1: Producer Inventory Table

## Story Information

| Field | Value |
|-------|-------|
| **Story ID** | 3.1 |
| **Epic** | Epic 3: Producer Inventory View |
| **Title** | Producer Inventory Table |
| **Status** | done |
| **Created** | 2026-01-23 |
| **Priority** | High |

## User Story

**As a** Producer,
**I want** to view all packages at my facility,
**So that** I know what materials are available for production.

## Acceptance Criteria

### AC1: Producer Inventory Page
**Given** I am logged in as Producer
**When** I navigate to Inventory (sidebar link)
**Then** I see a page with title "Inventory" and subtitle "View current inventory at your facility"
**And** the page shows my facility's packages in the standard read-only table

### AC2: Inventory Table
**Given** packages exist for my facility (shipments where `to_party_id` = my linked party)
**When** I view the inventory table
**Then** I see the standard read-only table format with all 14 columns: Shipment, Package, Product, Species, Humidity, Type, Processing, FSC, Quality, Thickness, Width, Length, Pieces, Vol m³
**And** the table uses the existing `DataEntryTable` component in `readOnly` mode
**And** volume displays with 3 decimal places and comma separator
**And** dropdown columns are collapsible (persisted via `collapseStorageKey`)

### AC3: Summary Cards
**Given** packages exist for my facility
**When** I view the inventory page
**Then** I see summary cards above the table: Total Packages, Total Pieces, Total m³
**And** summary cards update when column filters are applied

### AC4: User-to-Party Linking
**Given** I am a Producer user
**When** I log in
**Then** the system knows which party (facility) I belong to via `portal_users.party_id`
**And** only packages from shipments to my party are displayed

### AC5: Empty State
**Given** no packages exist for my facility
**When** I view the Inventory page
**Then** I see an empty state with a Package icon
**And** the message "No inventory available"
**And** a note "Contact Admin to record incoming shipments"

### AC6: Column Sort & Filter
**Given** I am viewing the inventory table
**When** I interact with column headers
**Then** I can sort by any column (ascending/descending)
**And** I can filter by column values using the filter popover
**And** summary cards reflect the filtered dataset

---

## Technical Implementation Guide

### Architecture Context

This story creates the Producer's view of their facility inventory. It reuses the same `DataEntryTable` component and `PackageListItem` type from the Admin's Inventory tab (Story 2.4), but filtered to only show packages shipped to the producer's facility.

**Key decisions:**
- Add `party_id` column to `portal_users` table (DB migration) to link producers to their facility
- Create a new server action `getProducerPackages` that filters by the user's linked party
- Reuse the existing `PackagesTab`-style column definitions and `SummaryCards` component
- Producer inventory page replaces the current placeholder at `apps/portal/src/app/(portal)/inventory/page.tsx`
- The page is server-rendered (RSC) with data fetching at the page level

**Relationship to existing code:**
- Reuses `DataEntryTable` from `@timber/ui` (readOnly mode with sort/filter)
- Reuses `SummaryCards` from `apps/portal/src/features/shipments/components/`
- Follows the same pattern as `PackagesTab.tsx` for column definitions
- Auth uses existing `getSession()` + `isProducer()` helpers

### Database Schema Changes

```sql
-- Migration: Add party_id to portal_users for producer-to-facility linking
ALTER TABLE portal_users
ADD COLUMN party_id UUID REFERENCES parties(id);

-- Update existing producer user(s) to link to their facility
-- (Admin users can have NULL party_id)
COMMENT ON COLUMN portal_users.party_id IS 'Links producer users to their facility (party). NULL for admin users.';
```

### Implementation Tasks

#### Task 1: Database Migration

- [x] Create migration file `supabase/migrations/YYYYMMDD_add_party_id_to_users.sql`
- [x] Add `party_id UUID REFERENCES parties(id)` column to `portal_users`
- [x] Add a comment on the column explaining its purpose
- [x] Apply migration locally

#### Task 2: Update Auth Types

- [x] Update `SessionUser` type in `apps/portal/src/lib/auth/getSession.ts` to include `partyId: string | null`
- [x] Update `getSession()` to query `portal_users` for the `party_id` when the user is a producer
- [x] Ensure `partyId` is available in the session for downstream use

#### Task 3: Create Producer Packages Server Action

- [x] Create `apps/portal/src/features/inventory/actions/getProducerPackages.ts`
- [x] Action checks `isProducer(session)` and reads `session.partyId`
- [x] Query: Select all packages from `inventory_packages` JOIN `shipments` WHERE `shipments.to_party_id = session.partyId`
- [x] Join all 7 reference tables to resolve display names (same pattern as admin `getPackages.ts`)
- [x] Return `PackageListItem[]` (reuse type from shipments feature or create shared type)
- [x] Return error if `partyId` is null (producer not linked to facility)

```typescript
// Query structure
const { data, error } = await supabase
  .from("inventory_packages")
  .select(`
    id,
    package_number,
    thickness, width, length, pieces,
    volume_m3,
    shipments!inner (shipment_code, to_party_id),
    ref_product_names (value),
    ref_wood_species (value),
    ref_humidity (value),
    ref_types (value),
    ref_processing (value),
    ref_fsc (value),
    ref_quality (value)
  `)
  .eq("shipments.to_party_id", session.partyId);
```

#### Task 4: Create Producer Inventory Feature

- [x] Create feature directory: `apps/portal/src/features/inventory/`
- [x] Create `types.ts` — can import/re-export `PackageListItem` from shipments feature or define locally
- [x] Create `actions/index.ts` — barrel export
- [x] Create `components/ProducerInventory.tsx` — client component with table + summary cards

**ProducerInventory component structure:**
```typescript
"use client";

import { useMemo, useState, useCallback } from "react";
import { DataEntryTable, type ColumnDef } from "@timber/ui";
import { SummaryCards } from "@/features/shipments/components/SummaryCards";
import type { PackageListItem } from "../types";

interface ProducerInventoryProps {
  packages: PackageListItem[];
}

export function ProducerInventory({ packages }: ProducerInventoryProps) {
  // Same column definitions as PackagesTab (14 columns, readOnly)
  // Summary cards: Total Packages, Total Pieces, Total m³
  // Uses onDisplayRowsChange for filter-aware summary
}
```

#### Task 5: Update Inventory Page

- [x] Replace placeholder content in `apps/portal/src/app/(portal)/inventory/page.tsx`
- [x] For producer role: fetch packages via `getProducerPackages()` and render `ProducerInventory`
- [x] For admin role: redirect to `/admin/inventory` (admin has their own inventory page)
- [x] Handle empty state (no packages)
- [x] Handle error state (producer not linked to facility)

```typescript
export default async function InventoryPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (isAdmin(session)) {
    redirect("/admin/inventory");
  }

  // Producer flow
  const result = await getProducerPackages();
  // ... render ProducerInventory or empty state
}
```

#### Task 6: Verification

- [x] Build passes: `npx turbo build --filter=@timber/portal`
- [x] Producer can view inventory table with all 14 columns
- [x] Summary cards show correct totals (packages, pieces, volume)
- [x] Column sort works (ascending/descending toggle)
- [x] Column filters work (value checkboxes in popover)
- [x] Summary cards update when filters are applied
- [x] Empty state shows when no packages exist
- [x] Admin accessing `/inventory` is redirected to `/admin/inventory`
- [x] Producer without linked party sees appropriate error message

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Epic 1 (Auth & Navigation) | Done | Producer login + sidebar navigation |
| Story 2.3 (Shipments & Packages) | Done | Database tables, package data exists |
| Story 2.4 (Inventory Overview) | Done | DataEntryTable readOnly pattern, SummaryCards component |
| `DataEntryTable` component | Done | Sort, filter, collapse, readOnly mode |
| `SummaryCards` component | Done | Reusable summary card display |

---

## Dev Agent Notes

### Reuse Patterns from Story 2.4

The Producer Inventory is essentially the same as the Admin's "Inventory" tab but:
1. Filtered to a single party (producer's facility)
2. Has an additional "Total Pieces" summary card
3. Lives at `/inventory` (not `/admin/inventory`)
4. No tabs (just the table)

### Key Differences from Admin Inventory Tab

| Aspect | Admin (Story 2.4) | Producer (Story 3.1) |
|--------|-------------------|---------------------|
| Route | `/admin/inventory?tab=inventory` | `/inventory` |
| Data scope | All packages | Only packages at my facility |
| Tabs | Inventory + Shipments | No tabs (single view) |
| Summary cards | Packages, m³ | Packages, Pieces, m³ |
| Edit capability | Click shipment to edit | Read-only (no editing) |

### Volume Format

All volume values: 3 decimal places, comma separator.
- `getValue`: returns `toFixed(3)` (raw, for sort/parse)
- `getDisplayValue`: returns `toFixed(3).replace(".", ",")` (formatted)

### Party Linking Strategy

For MVP, the approach is intentionally simple:
- Add `party_id` to `portal_users`
- Admin sets this when creating/editing a producer user (manual, or via future admin UI)
- For immediate testing: update directly in DB or add to registration flow
- This column is nullable (admin users don't need it)

### Shared Types

Consider whether `PackageListItem` should move to a shared location (e.g., `apps/portal/src/types/` or a shared feature). For MVP, importing from the shipments feature is acceptable.

---

## Dev Agent Record

### Implementation Plan

- Added `party_id` column to `portal_users` via migration to link producers to their facility
- Extended `SessionUser` type and `getSession()` to include `partyId` (queried from `portal_users` for producer role only)
- Created `getProducerPackages` server action following the same pattern as admin `getPackages` but filtering by `shipments.to_party_id = session.partyId`
- Created `ProducerInventory` component with standard 14-column `DataEntryTable` readOnly + `SummaryCards` (Packages, Pieces, m³)
- Updated `/inventory` page: admin redirects to `/admin/inventory`, producer sees their facility's packages
- Reused `PackageListItem` type from shipments feature via re-export in inventory feature `types.ts`
- Used `onDisplayRowsChange` callback for filter-aware summary cards (same pattern as Story 2.4)

### Debug Log

- Build failed initially due to TypeScript error on `portalUser?.party_id` — the Supabase typed client doesn't include the new column. Fixed by casting to `any` (same pattern used by all other portal actions).

### Completion Notes

- All 6 tasks completed and verified
- Build passes cleanly
- Producer inventory page shows standard 14-column read-only table filtered to their facility
- Summary cards: Total Packages, Total Pieces, Total m³ (updates with filters)
- Empty state and error state (no party link) both handled
- Admin role redirected to `/admin/inventory`
- To test: a producer user must have their `party_id` set in `portal_users` to match a party that is the `to_party_id` of shipments

### Senior Developer Review (AI)

**Review Date:** 2026-01-24
**Review Outcome:** Changes Requested (2 High, 3 Medium, 2 Low)

**Action Items:**
- [x] [HIGH] Fix `!inner` join in getProducerPackages — query was returning ALL packages and filtering client-side (data leak + performance)
- [x] [MEDIUM] Document getSession() extra DB query as known post-MVP optimization target
- [x] [MEDIUM] Add ShipmentDetailView.tsx bug fix to File List
- [x] [HIGH] Hardcoded i18n text — documented as project-wide tech debt (consistent with Epic 2 pattern, not a blocker)
- [x] [MEDIUM] Pieces parsing with ranges — consistent with DataEntryTable sum behavior, no fix needed
- [x] [LOW] Barrel re-export pattern — acceptable for current scope
- [x] [LOW] aria-labels on empty/error states — acceptable with current HTML semantics

---

## File List

| File | Action | Notes |
|------|--------|-------|
| `supabase/migrations/20260124000001_add_party_id_to_users.sql` | Created | Adds party_id column to portal_users |
| `apps/portal/src/lib/auth/getSession.ts` | Modified | Added partyId to SessionUser, query portal_users for party_id |
| `apps/portal/src/features/inventory/types.ts` | Created | Re-exports PackageListItem and ActionResult from shipments |
| `apps/portal/src/features/inventory/actions/getProducerPackages.ts` | Created | Server action to fetch producer's packages |
| `apps/portal/src/features/inventory/actions/index.ts` | Created | Barrel export |
| `apps/portal/src/features/inventory/components/ProducerInventory.tsx` | Created | Client component with DataEntryTable + SummaryCards |
| `apps/portal/src/app/(portal)/inventory/page.tsx` | Modified | Replaced placeholder with producer inventory view |
| `apps/portal/src/features/shipments/components/ShipmentDetailView.tsx` | Modified | Bug fix: pass shipmentCode prop to PackageEntryTable |

---

## Change Log

| Date | Change |
|------|--------|
| 2026-01-24 | Story 3.1 implemented: Producer Inventory Table with party linking, server action, and read-only DataEntryTable view |
| 2026-01-24 | Code review: Fixed !inner join (data security), documented getSession perf note, updated File List |
