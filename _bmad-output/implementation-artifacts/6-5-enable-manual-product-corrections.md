# Story 6.5: Enable Manual Product Corrections

Status: ready-for-dev

## Story

As a **Content Manager**,
I want **to manually edit individual product records**,
so that **I can make quick corrections without a full CSV upload** (FR40).

## Acceptance Criteria

1. **Given** an admin navigates to /admin/products
   **When** the product list displays
   **Then** products are shown in a searchable, sortable table

2. **Given** a product in the list
   **When** clicking on it
   **Then** an edit form opens with all fields

3. **Given** the edit form is open
   **When** viewing editable fields
   **Then** editable fields include: pricing, stock quantity, stock status, specifications

4. **Given** the edit form
   **When** entering invalid data
   **Then** form validation matches CSV validation rules

5. **Given** valid changes in the form
   **When** clicking "Save"
   **Then** changes apply immediately to the database

6. **Given** changes are saved
   **When** public site loads
   **Then** changes reflect on the public catalog (FR41)

7. **Given** any edit action
   **When** performed
   **Then** edit history is logged for audit purposes

8. **Given** an edit in progress
   **When** clicking "Cancel"
   **Then** changes are discarded and returns to list

## Tasks / Subtasks

- [ ] Task 1: Build Product List Page (AC: 1)
  - [ ] 1.1: Create `src/app/admin/products/page.tsx`
  - [ ] 1.2: Implement DataTable with columns: SKU, Species, Dimensions, Price, Stock, Status
  - [ ] 1.3: Add search input (searches SKU, species)
  - [ ] 1.4: Add column sorting (click headers)
  - [ ] 1.5: Add pagination (20 items per page)

- [ ] Task 2: Create Edit Form (AC: 2, 3)
  - [ ] 2.1: Create ProductEditDialog component (modal or slide-over)
  - [ ] 2.2: Include all editable fields with current values
  - [ ] 2.3: Group fields logically (Pricing, Inventory, Specifications)
  - [ ] 2.4: Use React Hook Form for form state

- [ ] Task 3: Implement Validation (AC: 4)
  - [ ] 3.1: Apply same Zod schema as CSV validation
  - [ ] 3.2: Show inline validation errors
  - [ ] 3.3: Prevent save if validation fails

- [ ] Task 4: Save and Cancel Actions (AC: 5, 6, 8)
  - [ ] 4.1: Create Server Action `updateProduct`
  - [ ] 4.2: Update Supabase record
  - [ ] 4.3: Show success toast on save
  - [ ] 4.4: Refresh table data after save
  - [ ] 4.5: Cancel discards form state

- [ ] Task 5: Audit Logging (AC: 7)
  - [ ] 5.1: Log each edit to audit_logs table
  - [ ] 5.2: Store: product_id, changed_fields, old_values, new_values
  - [ ] 5.3: Display edit history in product detail (optional)

## Dev Notes

### Architecture Compliance

**File Structure:**
```
src/
├── app/admin/products/
│   ├── page.tsx                    # Product list with DataTable
│   └── [id]/
│       └── page.tsx                # (Optional) Dedicated edit page
├── components/features/admin/
│   ├── ProductTable.tsx            # Admin product table
│   ├── ProductEditDialog.tsx       # Edit modal
│   └── ProductEditForm.tsx         # Form fields
├── lib/
│   └── actions/
│       └── products.ts             # updateProduct action
```

### Technical Requirements

**DataTable Columns:**
```typescript
const columns: ColumnDef<Product>[] = [
  { accessorKey: 'sku', header: 'SKU', sortable: true },
  { accessorKey: 'species', header: 'Species', sortable: true },
  {
    id: 'dimensions',
    header: 'Dimensions',
    cell: ({ row }) => `${row.width}×${row.length}×${row.thickness}mm`
  },
  {
    accessorKey: 'unit_price_m3',
    header: 'Price/m³',
    cell: ({ row }) => formatPrice(row.unit_price_m3)
  },
  { accessorKey: 'stock_quantity', header: 'Stock' },
  { accessorKey: 'stock_status', header: 'Status' },
  { id: 'actions', cell: EditButton },
]
```

**Edit Form Schema:**
```typescript
const productEditSchema = z.object({
  unit_price_m3: z.coerce.number().positive(),
  unit_price_piece: z.coerce.number().positive(),
  unit_price_m2: z.coerce.number().positive(),
  stock_quantity: z.coerce.number().int().min(0),
  stock_status: z.enum(['in_stock', 'low_stock', 'out_of_stock']),
  species: z.string().min(1),
  width: z.coerce.number().positive(),
  length: z.coerce.number().positive(),
  thickness: z.coerce.number().positive(),
  quality_grade: z.string(),
  type: z.enum(['FJ', 'FS']),
  moisture_content: z.coerce.number().min(0).max(100),
  finish: z.string(),
  fsc_certified: z.boolean(),
})
```

**Server Action:**
```typescript
export async function updateProduct(
  id: string,
  data: z.infer<typeof productEditSchema>
): Promise<ActionResult<Product>> {
  // 1. Validate input
  // 2. Get current values for audit
  // 3. Update in Supabase
  // 4. Log to audit_logs
  // 5. Return updated product
}
```

### UI Components

**Product List Table:**
- Use shadcn/ui DataTable component
- Include search input above table
- Pagination at bottom
- Click row or edit button to open form

**Edit Dialog:**
- Use shadcn/ui Dialog or Sheet (slide-over)
- Form grouped into sections:
  - Pricing (3 price fields)
  - Inventory (quantity, status)
  - Specifications (species, dimensions, grade, etc.)
- Save and Cancel buttons at bottom

### Search Implementation

```typescript
// Server-side search query
const { data } = await supabase
  .from('products')
  .select('*')
  .or(`sku.ilike.%${search}%,species.ilike.%${search}%`)
  .order(sortBy, { ascending: sortOrder === 'asc' })
  .range(offset, offset + pageSize - 1)
```

### Dependencies

- **Story 1.2**: Products table with all columns
- **Story 6.4**: Audit logging infrastructure (reuse audit_logs table)

### References

- [Source: prd.md#FR40] - Manual corrections requirement
- [Source: prd.md#FR41] - Public catalog update
- [Source: architecture.md#Implementation-Patterns] - Server Action pattern

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

