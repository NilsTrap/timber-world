# Inventory Data Model v2 Specification

**Date:** 2026-01-22
**Status:** APPROVED
**Scope:** Replaces original product-based inventory with flat shipment/package model

---

## Overview

This document specifies the new inventory data model for Timber World Platform. The key change is moving from a **Product Catalog + Inventory** model to a **Flat Shipment/Package** model where each inventory row contains ALL attributes.

### Design Principles

1. **Flat Structure** - No separate product catalog; each package has all attributes inline
2. **Admin-Managed Dropdowns** - All dropdown options are managed by Admin only
3. **Auto-Generated Codes** - Shipment codes and package numbers are system-generated
4. **Spreadsheet-Like Entry** - Horizontal row-based data entry with copy functionality

---

## Code Formats

### Shipment Code

**Format:** `[FROM]-[TO]-[NUMBER]`

| Part | Description | Example |
|------|-------------|---------|
| FROM | 3-letter organisation code (sender) | TWP |
| TO | 3-letter organisation code (receiver) | INE |
| NUMBER | 3-digit sequential number | 001 |

**Examples:**
- `TWP-INE-001` = Timber World Platform → INERCE, shipment #1
- `INE-TWP-001` = INERCE → Timber World Platform, shipment #1
- `TWP-INE-002` = Timber World Platform → INERCE, shipment #2

**Rules:**
- Number is sequential per organisation pair (TWP-INE has its own sequence)
- System auto-generates based on source and destination selection
- Immutable once created

### Package Number

**Format:** `TWP-[SHIPMENT]-[PACKAGE]`

| Part | Description | Example |
|------|-------------|---------|
| TWP | Fixed prefix (Timber World Platform) | TWP |
| SHIPMENT | 3-digit global shipment sequence | 001 |
| PACKAGE | 3-digit package sequence within shipment | 001 |

**Examples:**
- `TWP-001-001` = Global shipment #1, Package #1
- `TWP-001-002` = Global shipment #1, Package #2
- `TWP-002-001` = Global shipment #2, Package #1

**Rules:**
- SHIPMENT is globally sequential (all shipments, regardless of parties)
- PACKAGE is sequential within each shipment
- Each package number is globally unique
- System auto-generates when adding packages to a shipment

---

## Dropdown Fields (Admin-Managed)

### Reference Tables

All dropdown options are stored in reference tables and managed exclusively by Admin.

| Field | Table Name | Initial Values |
|-------|------------|----------------|
| Product Name | `ref_product_names` | Unedged boards, Edged boards, Strips, Solid wood panels |
| Wood Species | `ref_wood_species` | Oak, Ash, Birch, Pine |
| Humidity | `ref_humidity` | Fresh cut, Air dried, KD 7-9%, KD 9-11% |
| Type | `ref_types` | FJ, Full stave |
| Processing | `ref_processing` | Rough sawn, Calibrated, Planed, Opticut, Sorted, Unsorted, Varnished, Waxed, Oiled, Sanded |
| FSC | `ref_fsc` | FSC 100%, FSC Credit Mix, No |
| Quality | `ref_quality` | AA, AV, AS, BC, CC, ABC, Insects, Defected |

### Reference Table Schema

```sql
-- Generic structure for all reference tables
CREATE TABLE ref_[name] (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Admin Management Features

- Add new options
- Edit existing options (updates all references)
- Deactivate options (soft delete, preserves history)
- Reorder options (sort_order field)
- Cannot delete options that are in use

---

## Parties Table (UI: "Organisations")

### Schema

```sql
CREATE TABLE parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code CHAR(3) NOT NULL UNIQUE,  -- 3-letter code
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Initial Values

| Code | Name |
|------|------|
| TWP | Timber World Platform |
| INE | INERCE |

### Rules

- Code must be exactly 3 characters (first character letter, followed by 2 letters or numbers, uppercase)
- Admin can add new organisations
- Cannot delete organisations with existing shipments

---

## Shipments Table

### Schema

```sql
CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_code TEXT NOT NULL UNIQUE,      -- e.g., "TWP-INE-001"
  shipment_number INTEGER NOT NULL,        -- Global sequential number
  from_party_id UUID REFERENCES parties(id) NOT NULL,
  to_party_id UUID REFERENCES parties(id) NOT NULL,
  shipment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT different_parties CHECK (from_party_id != to_party_id)
);

CREATE INDEX idx_shipments_code ON shipments(shipment_code);
CREATE INDEX idx_shipments_date ON shipments(shipment_date DESC);
CREATE INDEX idx_shipments_from ON shipments(from_party_id);
CREATE INDEX idx_shipments_to ON shipments(to_party_id);
```

### Auto-Generation Logic

```typescript
async function generateShipmentCode(fromPartyId: string, toPartyId: string): Promise<string> {
  // Get party codes
  const fromParty = await getParty(fromPartyId);
  const toParty = await getParty(toPartyId);

  // Get next number for this party pair
  const count = await countShipments(fromPartyId, toPartyId);
  const number = String(count + 1).padStart(3, '0');

  return `${fromParty.code}-${toParty.code}-${number}`;
}
```

---

## Inventory Packages Table

### Schema

```sql
CREATE TABLE inventory_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Shipment Reference
  shipment_id UUID REFERENCES shipments(id) NOT NULL,
  package_number TEXT NOT NULL UNIQUE,     -- e.g., "TWP-001-001"
  package_sequence INTEGER NOT NULL,       -- Sequence within shipment

  -- Dropdown Fields (Foreign Keys)
  product_name_id UUID REFERENCES ref_product_names(id),
  wood_species_id UUID REFERENCES ref_wood_species(id),
  humidity_id UUID REFERENCES ref_humidity(id),
  type_id UUID REFERENCES ref_types(id),
  processing_id UUID REFERENCES ref_processing(id),
  fsc_id UUID REFERENCES ref_fsc(id),
  quality_id UUID REFERENCES ref_quality(id),

  -- Dimension Fields (Number or Range as TEXT)
  thickness TEXT,                          -- "40" or "40-50"
  width TEXT,                              -- "100" or "100-120"
  length TEXT,                             -- "2000" or "2000-3000"

  -- Quantity Fields
  pieces TEXT,                             -- Number or "-" for uncountable
  volume_m3 DECIMAL,                       -- Auto-calculated or manual
  volume_is_calculated BOOLEAN DEFAULT false,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(shipment_id, package_sequence)
);

CREATE INDEX idx_inventory_packages_shipment ON inventory_packages(shipment_id);
CREATE INDEX idx_inventory_packages_number ON inventory_packages(package_number);
CREATE INDEX idx_inventory_packages_product ON inventory_packages(product_name_id);
CREATE INDEX idx_inventory_packages_species ON inventory_packages(wood_species_id);
```

### Package Number Generation

```typescript
async function generatePackageNumber(shipmentId: string): Promise<{packageNumber: string, sequence: number}> {
  const shipment = await getShipment(shipmentId);

  // Count existing packages in this shipment
  const packageCount = await countPackages(shipmentId);
  const sequence = packageCount + 1;
  const packageSeq = String(sequence).padStart(3, '0');

  // Use global shipment number
  const shipmentSeq = String(shipment.shipment_number).padStart(3, '0');

  return {
    packageNumber: `TWP-${shipmentSeq}-${packageSeq}`,
    sequence
  };
}
```

### Dimension Fields

Dimensions support two formats:
1. **Exact Number:** `"40"` - used in volume calculations
2. **Range:** `"40-50"` - descriptive only, not used in calculations

```typescript
function parseDimension(value: string): { isRange: boolean; min: number | null; max: number | null } {
  if (value.includes('-')) {
    const [min, max] = value.split('-').map(Number);
    return { isRange: true, min, max };
  }
  const num = parseFloat(value);
  return { isRange: false, min: num, max: num };
}
```

### Pieces Field

Supports:
- Integer: `"500"` - countable pieces
- Dash: `"-"` - not countable
- Text: `"not counted"` - alternative notation

### Volume Calculation

```typescript
function calculateVolume(thickness: string, width: string, length: string, pieces: string): number | null {
  // Only calculate if all dimensions are exact numbers and pieces is a number
  const t = parseDimension(thickness);
  const w = parseDimension(width);
  const l = parseDimension(length);
  const p = parseInt(pieces);

  if (t.isRange || w.isRange || l.isRange || isNaN(p)) {
    return null; // Manual entry required
  }

  // Convert mm to m and calculate
  const thicknessM = t.min! / 1000;
  const widthM = w.min! / 1000;
  const lengthM = l.min! / 1000;

  return thicknessM * widthM * lengthM * p;
}
```

---

## Entry Form Specification

### Layout

Horizontal/tabular layout (spreadsheet-like):

```
| Shipment | Package | Product | Species | Humidity | Type | Processing | FSC | Quality | Thickness | Width | Length | Pieces | m³ |
|----------|---------|---------|---------|----------|------|------------|-----|---------|-----------|-------|--------|--------|-----|
| [auto]   | [auto]  | [drop]  | [drop]  | [drop]   |[drop]| [drop]     |[drop]|[drop]  | [input]   |[input]|[input] |[input] |[calc]|
```

### Features

1. **Auto-Generated Fields:**
   - Shipment Code (when creating new shipment)
   - Package Number (when adding row)

2. **Dropdown Fields:**
   - Product Name, Species, Humidity, Type, Processing, FSC, Quality
   - Options from respective reference tables
   - Only active options shown

3. **Input Fields:**
   - Thickness, Width, Length: Text input (number or range)
   - Pieces: Text input (number or "-")
   - Volume m³: Auto-calculated or manual override

4. **Row Actions:**
   - **Add Row:** Adds new empty row with auto-generated package number
   - **Copy Row:** Duplicates previous row with new package number (all fields copied except pieces/volume)
   - **Delete Row:** Removes the row (confirmation required)

5. **Validation:**
   - Required fields: Product Name, Species (others optional)
   - Pieces must be number or "-"
   - Volume auto-calculates when possible, editable otherwise

---

## Database Migration Plan

### Step 1: Create Reference Tables

```sql
-- Create all reference tables with initial data
CREATE TABLE ref_product_names (...);
INSERT INTO ref_product_names (value, sort_order) VALUES
  ('Unedged boards', 1),
  ('Edged boards', 2),
  ('Strips', 3),
  ('Solid wood panels', 4);

-- Repeat for all reference tables...
```

### Step 2: Create Core Tables

```sql
CREATE TABLE parties (...);
CREATE TABLE shipments (...);
CREATE TABLE inventory_packages (...);
```

### Step 3: Seed Initial Data

```sql
INSERT INTO parties (code, name) VALUES
  ('TWP', 'Timber World Platform'),
  ('INE', 'INERCE');
```

### Step 4: Remove Old Tables (if needed)

```sql
-- Optional: Drop old portal_products table if no longer needed
-- DROP TABLE portal_products;
```

---

## Admin UI Requirements

### Reference Data Management

Admin needs pages to manage each reference table:

1. **Product Names** - `/admin/reference/product-names`
2. **Wood Species** - `/admin/reference/wood-species`
3. **Humidity** - `/admin/reference/humidity`
4. **Types** - `/admin/reference/types`
5. **Processing** - `/admin/reference/processing`
6. **FSC** - `/admin/reference/fsc`
7. **Quality** - `/admin/reference/quality`

Each page has:
- Table of all options (value, active status, usage count)
- Add new option button
- Edit option (inline or dialog)
- Deactivate option (cannot delete if in use)
- Drag-and-drop reordering

### Organisations Management

Admin page to manage organisations: `/admin/organisations`

- Table of all organisations (code, name, active)
- Add new organisation
- Edit organisation name (code is immutable)
- Deactivate organisation

---

## Impact on Existing Epics

### Epic 2: Admin Inventory Management

**Story 2.1** (Reference Data Management)
- Manage all dropdown reference tables

**Story 2.2** (Organisations Management)
- Manage organisations (formerly "parties" in DB terms)

**Story 2.3** (Create Shipment & Add Packages)
- Create new shipment (select from/to organisations)
- Add packages with all attributes
- Horizontal entry form with copy row feature

**Story 2.4** (Shipment & Inventory Overview)
- View all shipments with package counts
- View all inventory packages with filtering
- Filter by shipment, product name, species, etc.

### Epic 3: Producer Inventory View

**Story 3.1** (Producer Inventory Table)
- Shows packages for their facility (to_party_id = producer's organisation)
- Same columns as admin view
- Read-only

### Epic 4: Production Entry & Tracking

**Story 4.2** (Add Production Inputs from Inventory)
- Select packages as inputs (not products)
- Each input line references a package
- Quantity consumed from that package

**Story 4.3** (Add Production Outputs)
- Outputs create new packages
- Auto-generate package numbers for outputs
- Inherit attributes from inputs where appropriate

---

## Summary

This specification replaces the original product-based inventory model with a flat shipment/package model that:

1. Eliminates the product catalog (no separate products table)
2. Uses admin-managed dropdown reference tables
3. Auto-generates shipment codes and package numbers
4. Supports spreadsheet-like horizontal data entry
5. Handles dimension ranges and uncountable pieces
6. Auto-calculates volume when possible

**Next Steps:**
1. Update Architecture document with new schema
2. Rewrite Epic 2 stories
3. Update Epic 3 and 4 for compatibility
4. Implement new database migration
