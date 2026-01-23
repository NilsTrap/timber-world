# Story 2.4: Shipment & Inventory Overview

## Story Information

| Field | Value |
|-------|-------|
| **Story ID** | 2.4 |
| **Epic** | Epic 2: Admin Inventory Management |
| **Title** | Shipment & Inventory Overview |
| **Status** | review |
| **Created** | 2026-01-23 |
| **Priority** | High |

## User Story

**As an** Admin,
**I want** to view all shipments and inventory packages,
**So that** I can monitor what materials are at producer facilities.

## Acceptance Criteria

### AC1: Overview Page with Tabs
**Given** I am logged in as Admin
**When** I navigate to Inventory (sidebar)
**Then** I see a page with two tabs: "Shipments" and "Packages"
**And** the "Shipments" tab is active by default

### AC2: Shipments Table
**Given** I am on the Shipments tab
**When** I view the table
**Then** I see columns: Shipment Code, From, To, Date, Package Count, Total m³
**And** shipments are sorted by date (newest first)

### AC3: Shipment Detail View
**Given** I click on a shipment row
**When** the detail page opens
**Then** I see the shipment header info (code, from, to, date, transport cost)
**And** I see all packages in that shipment with full attributes
**And** I can edit existing packages or add more packages

### AC4: Packages Table
**Given** I am on the Packages tab
**When** I view the table
**Then** I see all packages with columns: Package No, Shipment Code, Product, Species, Humidity, Dimensions, Pieces, m³
**And** I see summary cards above the table: Total Packages, Total m³

### AC5: Filter Bar (Packages)
**Given** I am viewing the Packages tab
**When** I use the filter bar
**Then** I can filter by: Product Name (dropdown), Species (dropdown), Shipment Code (text search)
**And** the table updates to show matching packages
**And** summary cards update to reflect filtered results

### AC6: Column Sort
**Given** I am viewing either the Shipments or Packages table
**When** I click a column header
**Then** the table sorts by that column (toggle ascending/descending)
**And** active sort is indicated by an arrow icon

### AC7: Empty State
**Given** no shipments exist
**When** I view the overview page
**Then** I see an empty state "No shipments recorded yet"
**And** I see a button "Create First Shipment" that navigates to /admin/inventory/new-shipment

---

## Technical Implementation Guide

### Architecture Context

This story builds on Story 2.3's data model and actions. It creates a read-only overview page at `/admin/inventory` (the main Inventory nav item) with two tabs, plus expands the existing `[shipmentId]/page.tsx` placeholder into a full detail/edit view.

**Key decisions:**
- Overview page uses server-side data fetching (RSC) for initial load
- Tabs use URL search params (`?tab=shipments` / `?tab=packages`) for shareable state
- Shipment detail page reuses existing `ShipmentHeader` and `PackageEntryTable` components in edit mode
- Sort is client-side (tables are reasonably sized for MVP)
- Filters use client-side filtering with URL search params for persistence

### Database Schema (existing, no changes needed)

```sql
-- Shipments table (from Story 2.3)
CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_code TEXT NOT NULL UNIQUE,
  shipment_number INTEGER NOT NULL,
  from_party_id UUID REFERENCES parties(id) NOT NULL,
  to_party_id UUID REFERENCES parties(id) NOT NULL,
  shipment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transport_cost_eur NUMERIC(10, 2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inventory Packages table (from Story 2.3)
CREATE TABLE inventory_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES shipments(id) NOT NULL,
  package_number TEXT NOT NULL UNIQUE,
  package_sequence INTEGER NOT NULL,
  product_name_id UUID REFERENCES ref_product_names(id),
  wood_species_id UUID REFERENCES ref_wood_species(id),
  humidity_id UUID REFERENCES ref_humidity(id),
  type_id UUID REFERENCES ref_types(id),
  processing_id UUID REFERENCES ref_processing(id),
  fsc_id UUID REFERENCES ref_fsc(id),
  quality_id UUID REFERENCES ref_quality(id),
  thickness TEXT,
  width TEXT,
  length TEXT,
  pieces TEXT,
  volume_m3 DECIMAL,
  volume_is_calculated BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'available',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Implementation Tasks

#### Task 1: Create Server Actions for Data Fetching

- [x] `actions/getShipments.ts` - Fetch all shipments with aggregated data:
  ```typescript
  interface ShipmentListItem {
    id: string;
    shipmentCode: string;
    fromPartyName: string;
    fromPartyCode: string;
    toPartyName: string;
    toPartyCode: string;
    shipmentDate: string;
    transportCostEur: number | null;
    packageCount: number;
    totalVolumeM3: number;
  }
  ```
  Query joins `shipments` with `parties` (for from/to names) and aggregates from `inventory_packages` (count + sum volume_m3). Order by `shipment_date DESC`.

- [x] `actions/getShipmentDetail.ts` - Fetch single shipment with all packages:
  ```typescript
  interface ShipmentDetail {
    id: string;
    shipmentCode: string;
    shipmentNumber: number;
    fromPartyId: string;
    fromPartyName: string;
    toPartyId: string;
    toPartyName: string;
    shipmentDate: string;
    transportCostEur: number | null;
    packages: PackageDetail[];
  }

  interface PackageDetail {
    id: string;
    packageNumber: string;
    packageSequence: number;
    productNameId: string | null;
    productName: string | null;
    woodSpeciesId: string | null;
    woodSpecies: string | null;
    humidityId: string | null;
    humidity: string | null;
    typeId: string | null;
    typeName: string | null;
    processingId: string | null;
    processing: string | null;
    fscId: string | null;
    fsc: string | null;
    qualityId: string | null;
    quality: string | null;
    thickness: string | null;
    width: string | null;
    length: string | null;
    pieces: string | null;
    volumeM3: number | null;
    volumeIsCalculated: boolean;
  }
  ```
  Query joins packages with all 7 reference tables to resolve display names.

- [x] `actions/getPackages.ts` - Fetch all packages with resolved names:
  ```typescript
  interface PackageListItem {
    id: string;
    packageNumber: string;
    shipmentCode: string;
    shipmentId: string;
    productName: string | null;
    woodSpecies: string | null;
    humidity: string | null;
    thickness: string | null;
    width: string | null;
    length: string | null;
    pieces: string | null;
    volumeM3: number | null;
  }
  ```
  Joins `inventory_packages` with `shipments` (for shipment_code) and `ref_product_names`, `ref_wood_species`, `ref_humidity` for display values.

- [x] `actions/updateShipmentPackages.ts` - Update an existing shipment's packages:
  - Accepts shipment ID + transport cost + full package array (same shape as create)
  - Deletes existing packages for the shipment, re-inserts all (simplest approach for MVP)
  - Uses a DB function for atomicity (similar to `create_shipment_with_packages`)

#### Task 2: Create Overview Page Components

- [x] `components/InventoryOverview.tsx` - Client component wrapping the tab layout:
  - Uses `useSearchParams()` for active tab state (`?tab=shipments` | `?tab=packages`)
  - Renders tab buttons with active styling
  - Conditionally renders `ShipmentsTab` or `PackagesTab`

- [x] `components/ShipmentsTab.tsx` - Shipments table component:
  - Receives `shipments: ShipmentListItem[]` as prop
  - Table columns: Shipment Code, From (code + name), To (code + name), Date, Packages, Total m³
  - Clickable rows → navigate to `/admin/inventory/[shipmentId]`
  - Client-side sort on column header click (default: date desc)
  - Empty state with "Create First Shipment" button

- [x] `components/PackagesTab.tsx` - Packages table with filter bar:
  - Receives `packages: PackageListItem[]` and reference dropdown options
  - Filter bar: Product Name (select), Species (select), Shipment Code (text input)
  - Summary cards above table: Total Packages count, Total m³ sum
  - Table with sort on column headers
  - Cards and table update reactively when filters change

- [x] `components/SummaryCards.tsx` - Reusable summary card row:
  - Receives array of `{ label: string; value: string | number }`
  - Renders horizontal card row with label/value pairs
  - Uses Card component from `@timber/ui`

#### Task 3: Create Inventory Overview Page

- [x] Create `apps/portal/src/app/(portal)/admin/inventory/page.tsx`:
  - Server component that fetches shipments + packages + reference dropdowns
  - Passes data to `InventoryOverview` client component
  - Add `loading.tsx` and `error.tsx`

#### Task 4: Expand Shipment Detail Page

- [x] Rewrite `apps/portal/src/app/(portal)/admin/inventory/[shipmentId]/page.tsx`:
  - Server component: fetch shipment detail + reference dropdowns + organisations
  - Render shipment header info (read-only display: code, from, to, date, transport cost)
  - Render package table in edit mode (reuse `PackageEntryTable`)
  - "Save Changes" button to update packages
  - "Back to Overview" navigation link
  - Add `loading.tsx` and `error.tsx`

- [x] Create `components/ShipmentDetailView.tsx` - Client component:
  - Shows shipment header info as read-only display (not form)
  - Renders `PackageEntryTable` with pre-filled rows from existing packages
  - "Add Package" adds new row
  - "Save Changes" calls `updateShipmentPackages` action
  - Success toast + stay on page (no redirect)

#### Task 5: Update Navigation

- [x] Update sidebar: "Inventory" as the main nav item pointing to `/admin/inventory`
  - Keep "New Shipment" as a separate nav item or as an action button on the overview page
  - Ensure the sidebar highlights "Inventory" when on overview, detail, or new-shipment pages

#### Task 6: Create Update Shipment DB Function

- [x] Create migration `supabase/migrations/20260123000003_update_shipment_packages.sql`:
  ```sql
  CREATE OR REPLACE FUNCTION update_shipment_packages(
    p_shipment_id UUID,
    p_transport_cost_eur NUMERIC(10, 2),
    p_packages JSONB
  ) RETURNS JSONB AS $$
  DECLARE
    v_shipment_number INTEGER;
    v_package JSONB;
    v_package_number TEXT;
    v_sequence INTEGER := 0;
  BEGIN
    -- Get shipment number for package numbering
    SELECT shipment_number INTO v_shipment_number
    FROM shipments WHERE id = p_shipment_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Shipment not found: %', p_shipment_id;
    END IF;

    -- Update transport cost
    UPDATE shipments SET transport_cost_eur = p_transport_cost_eur,
      updated_at = now() WHERE id = p_shipment_id;

    -- Delete existing packages
    DELETE FROM inventory_packages WHERE shipment_id = p_shipment_id;

    -- Re-insert all packages
    FOR v_package IN SELECT * FROM jsonb_array_elements(p_packages)
    LOOP
      v_sequence := v_sequence + 1;
      v_package_number := 'TWP-' || LPAD(v_shipment_number::TEXT, 3, '0')
        || '-' || LPAD(v_sequence::TEXT, 3, '0');

      INSERT INTO inventory_packages (
        shipment_id, package_number, package_sequence,
        product_name_id, wood_species_id, humidity_id,
        type_id, processing_id, fsc_id, quality_id,
        thickness, width, length, pieces,
        volume_m3, volume_is_calculated
      ) VALUES (
        p_shipment_id, v_package_number, v_sequence,
        NULLIF(v_package->>'product_name_id', '')::UUID,
        NULLIF(v_package->>'wood_species_id', '')::UUID,
        NULLIF(v_package->>'humidity_id', '')::UUID,
        NULLIF(v_package->>'type_id', '')::UUID,
        NULLIF(v_package->>'processing_id', '')::UUID,
        NULLIF(v_package->>'fsc_id', '')::UUID,
        NULLIF(v_package->>'quality_id', '')::UUID,
        NULLIF(v_package->>'thickness', ''),
        NULLIF(v_package->>'width', ''),
        NULLIF(v_package->>'length', ''),
        NULLIF(v_package->>'pieces', ''),
        (v_package->>'volume_m3')::DECIMAL,
        COALESCE((v_package->>'volume_is_calculated')::BOOLEAN, false)
      );
    END LOOP;

    RETURN jsonb_build_object(
      'shipment_id', p_shipment_id,
      'package_count', v_sequence
    );
  END;
  $$ LANGUAGE plpgsql;
  ```

---

## File Organisation

```
apps/portal/src/features/shipments/
├── actions/
│   ├── getActiveOrganisations.ts     (existing)
│   ├── getShipmentCodePreview.ts     (existing)
│   ├── getReferenceDropdowns.ts      (existing)
│   ├── createShipment.ts             (existing)
│   ├── getShipments.ts               (NEW)
│   ├── getShipmentDetail.ts          (NEW)
│   ├── getPackages.ts                (NEW)
│   ├── updateShipmentPackages.ts     (NEW)
│   └── index.ts                      (update exports)
├── components/
│   ├── ShipmentHeader.tsx            (existing)
│   ├── PackageEntryTable.tsx         (existing)
│   ├── NewShipmentForm.tsx           (existing)
│   ├── InventoryOverview.tsx         (NEW)
│   ├── ShipmentsTab.tsx              (NEW)
│   ├── PackagesTab.tsx               (NEW)
│   ├── ShipmentDetailView.tsx        (NEW)
│   ├── SummaryCards.tsx              (NEW)
│   └── index.ts                      (update exports)
├── types.ts                          (update with new interfaces)
└── index.ts

apps/portal/src/app/(portal)/admin/inventory/
├── page.tsx                          (NEW - overview page)
├── loading.tsx                       (NEW)
├── error.tsx                         (NEW)
├── new-shipment/
│   ├── page.tsx                      (existing)
│   ├── loading.tsx                   (existing)
│   └── error.tsx                     (existing)
└── [shipmentId]/
    ├── page.tsx                      (REWRITE - full detail view)
    ├── loading.tsx                   (NEW)
    └── error.tsx                     (NEW)

supabase/migrations/
└── 20260123000003_update_shipment_packages.sql  (NEW)
```

---

## Key Patterns & Conventions

### Server Action Pattern (from Story 2.2/2.3)

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

export async function myAction(input: MyInput): Promise<ActionResult<MyOutput>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from("table").select("*");

  if (error) return { success: false, error: `Failed: ${error.message}`, code: "QUERY_FAILED" };
  return { success: true, data: transformedData };
}
```

### Tab Pattern (URL-based)

```typescript
"use client";

import { useSearchParams, useRouter } from "next/navigation";

export function InventoryOverview({ shipments, packages, dropdowns }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get("tab") || "shipments";

  const setTab = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`?${params.toString()}`);
  };

  return (
    <div>
      <div className="flex gap-2 border-b">
        <button onClick={() => setTab("shipments")} className={...}>Shipments</button>
        <button onClick={() => setTab("packages")} className={...}>Packages</button>
      </div>
      {activeTab === "shipments" ? <ShipmentsTab ... /> : <PackagesTab ... />}
    </div>
  );
}
```

### Client-Side Sort Pattern

```typescript
const [sortConfig, setSortConfig] = useState<{
  key: string;
  direction: "asc" | "desc";
} | null>(null);

const sortedData = useMemo(() => {
  if (!sortConfig) return data;
  return [...data].sort((a, b) => {
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortConfig.direction === "asc" ? cmp : -cmp;
  });
}, [data, sortConfig]);
```

### UK English

All user-facing strings must use UK spelling:
- "Organisation" (not "Organization")
- Consistent with Story 2.2/2.3 patterns

---

## Definition of Done

- [x] Overview page accessible at `/admin/inventory`
- [x] Two tabs ("Shipments" / "Packages") with URL-based state
- [x] Shipments table shows: Code, From, To, Date, Package Count, Total m³
- [x] Shipments sorted by date (newest first) by default
- [x] Clicking a shipment row navigates to detail page
- [x] Column headers sortable (toggle asc/desc) on both tabs
- [x] Packages tab shows all packages with resolved reference names
- [x] Summary cards show Total Packages and Total m³
- [x] Filter bar filters by Product Name, Species, Shipment Code
- [x] Summary cards update when filters are applied
- [x] Shipment detail page shows header info + editable package table
- [x] Can edit existing packages on detail page
- [x] Can add new packages on detail page
- [x] "Save Changes" persists updates atomically via DB function
- [x] Empty state shows "No shipments recorded yet" + "Create First Shipment" button
- [x] Sidebar navigation updated (Inventory → overview page)
- [x] No TypeScript errors
- [x] Build passes

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5

### Completion Notes
- Server actions use Supabase PostgREST relation queries (foreign key joins) for fetching party names and reference values
- `getShipments` aggregates package count and total volume via the embedded `inventory_packages` relation
- `getShipmentDetail` joins all 7 reference tables to resolve display names for each package
- `getPackages` resolves product_name, wood_species, humidity display values plus shipment_code
- `updateShipmentPackages` uses atomic DB function (delete + re-insert pattern) matching `create_shipment_with_packages` style
- Tabs use URL search params (`?tab=shipments`/`?tab=packages`) for shareable/bookmarkable state
- `InventoryOverview` wraps `useSearchParams()` in a Suspense boundary for Next.js compatibility
- ShipmentsTab defaults sort to date DESC (newest first)
- PackagesTab filters dynamically show only values that exist in the actual data
- SummaryCards update reactively when filters change (computed from filtered array)
- ShipmentDetailView loads packages into PackageEntryTable rows, reusing the same edit experience as new shipment
- Sidebar "Inventory" link updated to `/admin/inventory` - active state highlighting works for all sub-pages via `startsWith` check
- Empty state with "Create First Shipment" CTA button navigates to existing new-shipment page

### File List
- `apps/portal/src/features/shipments/types.ts` - Added ShipmentListItem, PackageDetail, ShipmentDetail, PackageListItem, UpdateShipmentInput types
- `apps/portal/src/features/shipments/actions/getShipments.ts` - NEW: Fetch all shipments with party joins and package aggregates
- `apps/portal/src/features/shipments/actions/getShipmentDetail.ts` - NEW: Fetch single shipment with all packages and resolved reference names
- `apps/portal/src/features/shipments/actions/getPackages.ts` - NEW: Fetch all packages with resolved names
- `apps/portal/src/features/shipments/actions/updateShipmentPackages.ts` - NEW: Update shipment packages atomically via DB function
- `apps/portal/src/features/shipments/actions/index.ts` - Added 4 new exports
- `apps/portal/src/features/shipments/components/InventoryOverview.tsx` - NEW: Tab layout with URL-based state
- `apps/portal/src/features/shipments/components/ShipmentsTab.tsx` - NEW: Shipments table with sort and empty state
- `apps/portal/src/features/shipments/components/PackagesTab.tsx` - NEW: Packages table with filter bar and summary cards
- `apps/portal/src/features/shipments/components/SummaryCards.tsx` - NEW: Reusable summary card row
- `apps/portal/src/features/shipments/components/ShipmentDetailView.tsx` - NEW: Shipment detail with editable package table
- `apps/portal/src/features/shipments/components/index.ts` - Added 5 new exports
- `apps/portal/src/app/(portal)/admin/inventory/page.tsx` - NEW: Inventory overview page (RSC)
- `apps/portal/src/app/(portal)/admin/inventory/loading.tsx` - NEW: Loading skeleton
- `apps/portal/src/app/(portal)/admin/inventory/error.tsx` - NEW: Error boundary
- `apps/portal/src/app/(portal)/admin/inventory/[shipmentId]/page.tsx` - REWRITTEN: Full detail view with packages
- `apps/portal/src/app/(portal)/admin/inventory/[shipmentId]/loading.tsx` - NEW: Loading skeleton
- `apps/portal/src/app/(portal)/admin/inventory/[shipmentId]/error.tsx` - NEW: Error boundary
- `apps/portal/src/components/layout/SidebarWrapper.tsx` - Updated Inventory link to `/admin/inventory`
- `supabase/migrations/20260123000003_update_shipment_packages.sql` - NEW: Atomic update DB function
