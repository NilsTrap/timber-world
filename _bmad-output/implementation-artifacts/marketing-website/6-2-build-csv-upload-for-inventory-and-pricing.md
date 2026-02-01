# Story 6.2: Build CSV Upload for Inventory and Pricing

Status: ready-for-dev

## Story

As a **Content Manager**,
I want **to upload CSV files to update product inventory and pricing**,
so that **the catalog stays current with minimal effort** (FR36, FR39).

## Acceptance Criteria

1. **Given** an admin navigates to /admin/products/upload
   **When** the upload page loads
   **Then** a file upload zone accepts CSV files (drag-drop or click to browse)

2. **Given** the upload page is displayed
   **When** the user views upload options
   **Then** upload type selection is available: "Inventory Update" or "Pricing Update"

3. **Given** the upload interface
   **When** user needs help with format
   **Then** a sample CSV template is downloadable for reference

4. **Given** a file is being uploaded
   **When** the file exceeds size limit
   **Then** file size limit is enforced (10MB max) with clear error message

5. **Given** a file is uploading
   **When** processing is in progress
   **Then** upload progress indicator shows during processing

6. **Given** a CSV file has been uploaded
   **When** parsing completes
   **Then** the system parses CSV and displays preview of changes

7. **Given** the upload page
   **When** viewing upload history
   **Then** recent uploads show with status (success/failed/pending)

## Tasks / Subtasks

- [ ] Task 1: Create Upload Page Structure (AC: 1, 2)
  - [ ] 1.1: Create `src/app/admin/products/upload/page.tsx`
  - [ ] 1.2: Implement file drop zone with react-dropzone or native input
  - [ ] 1.3: Add upload type radio selection (Inventory/Pricing)
  - [ ] 1.4: Style drop zone with dashed border, hover states

- [ ] Task 2: Implement File Handling (AC: 3, 4, 5)
  - [ ] 2.1: Create downloadable CSV templates for inventory and pricing
  - [ ] 2.2: Implement file size validation (10MB limit)
  - [ ] 2.3: Add file type validation (only .csv accepted)
  - [ ] 2.4: Implement upload progress indicator

- [ ] Task 3: CSV Parsing and Preview (AC: 6)
  - [ ] 3.1: Create `lib/utils/csv-parser.ts` for parsing logic
  - [ ] 3.2: Implement CSV to JSON conversion
  - [ ] 3.3: Create UploadPreview component showing parsed data
  - [ ] 3.4: Display row count, column mapping, sample rows

- [ ] Task 4: Upload History (AC: 7)
  - [ ] 4.1: Create `upload_history` table in Supabase (or use existing audit log)
  - [ ] 4.2: Display recent uploads with timestamp, type, status, row count
  - [ ] 4.3: Allow viewing details of past uploads

## Dev Notes

### Architecture Compliance

**File Structure per Architecture:**
```
src/
├── app/admin/products/
│   ├── page.tsx                    # Product list (Story 6.5)
│   └── upload/
│       └── page.tsx                # CSV upload page
├── components/features/admin/
│   ├── DataUpload.tsx              # Drop zone component
│   ├── UploadPreview.tsx           # Preview parsed data
│   └── UploadHistory.tsx           # Recent uploads list
├── lib/
│   ├── utils/
│   │   └── csv-parser.ts           # CSV parsing utility
│   └── validations/
│       └── product.ts              # uploadSchema for validation
```

### Technical Requirements

**CSV Template Structure - Inventory:**
```csv
sku,stock_quantity,stock_status
OAK-FJ-22-1200,150,in_stock
OAK-FS-27-2400,45,low_stock
```

**CSV Template Structure - Pricing:**
```csv
sku,unit_price_m3,unit_price_piece,unit_price_m2
OAK-FJ-22-1200,2500,45.50,125.00
OAK-FS-27-2400,2800,52.00,140.00
```

**Zod Schema for Upload:**
```typescript
const inventoryRowSchema = z.object({
  sku: z.string().min(1),
  stock_quantity: z.coerce.number().int().min(0),
  stock_status: z.enum(['in_stock', 'low_stock', 'out_of_stock']),
})

const pricingRowSchema = z.object({
  sku: z.string().min(1),
  unit_price_m3: z.coerce.number().positive(),
  unit_price_piece: z.coerce.number().positive(),
  unit_price_m2: z.coerce.number().positive(),
})
```

**API Route for Upload:**
```typescript
// POST /api/admin/upload
// Content-Type: multipart/form-data
// Body: { file: File, type: 'inventory' | 'pricing' }
// Response: { success: true, data: { rows: number, preview: Row[] } }
```

### Library & Framework Requirements

| Package | Usage |
|---------|-------|
| papaparse | CSV parsing (or native implementation) |
| react-dropzone | File drop zone (optional, can use native) |
| zod | Schema validation for CSV rows |
| shadcn/ui | Card, Button, Table, Progress, RadioGroup |
| lucide-react | Upload, FileSpreadsheet, Download, Check, X icons |

### File Size & Performance

- Max file size: 10MB
- Parse files client-side for preview
- Chunked processing for large files (>1000 rows)
- Show progress during parsing

### Security Considerations

- Validate file type on both client and server
- Sanitize CSV content before processing
- Admin authentication required
- Log all upload attempts for audit

### Dependencies

- **Story 6.1**: Admin dashboard and navigation must exist
- **Story 1.2**: Products table must exist in Supabase

### References

- [Source: architecture.md#Project-Structure] - File organization
- [Source: prd.md#FR36-FR39] - Upload requirements
- [Source: architecture.md#NFR51-53] - CSV import/validation/rollback

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

