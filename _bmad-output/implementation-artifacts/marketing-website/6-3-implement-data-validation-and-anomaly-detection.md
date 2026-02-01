# Story 6.3: Implement Data Validation and Anomaly Detection

Status: ready-for-dev

## Story

As a **Content Manager**,
I want **uploaded data to be validated with anomalies flagged**,
so that **I can catch errors before they affect the public catalog** (FR37).

## Acceptance Criteria

1. **Given** a CSV file has been uploaded
   **When** validation runs
   **Then** the system checks for: required fields present, valid data types, reasonable value ranges

2. **Given** validation is complete
   **When** anomalies exist
   **Then** anomalies are flagged: unusually low/high prices, unexpected stock changes, missing SKUs

3. **Given** validation results exist
   **When** displayed to user
   **Then** a clear summary shows: valid rows, warnings, errors

4. **Given** flagged items exist
   **When** viewing details
   **Then** each flagged item shows the issue and affected row number

5. **Given** anomalies are displayed
   **When** user reviews them
   **Then** the admin can review each anomaly and approve or reject

6. **Given** critical errors exist
   **When** attempting to import
   **Then** critical errors block import until resolved

7. **Given** only warnings exist
   **When** attempting to import
   **Then** warnings allow import with acknowledgment checkbox

## Tasks / Subtasks

- [ ] Task 1: Implement Validation Engine (AC: 1)
  - [ ] 1.1: Create `lib/validations/csv-validation.ts`
  - [ ] 1.2: Validate required fields (sku, quantities, prices)
  - [ ] 1.3: Validate data types (numbers are numbers, etc.)
  - [ ] 1.4: Validate reasonable ranges (price > 0, quantity >= 0)

- [ ] Task 2: Build Anomaly Detection (AC: 2)
  - [ ] 2.1: Detect price anomalies (>50% change from current, unusually low/high)
  - [ ] 2.2: Detect stock anomalies (large sudden changes)
  - [ ] 2.3: Detect missing SKUs (in upload but not in database)
  - [ ] 2.4: Detect orphan SKUs (in database but missing from upload)

- [ ] Task 3: Create Validation Results UI (AC: 3, 4)
  - [ ] 3.1: Create ValidationSummary component (counts by severity)
  - [ ] 3.2: Create ValidationDetails component (expandable list)
  - [ ] 3.3: Color-code: green (valid), yellow (warning), red (error)
  - [ ] 3.4: Show row number and specific issue for each problem

- [ ] Task 4: Implement Approve/Reject Flow (AC: 5, 6, 7)
  - [ ] 4.1: Add individual approve/reject buttons for warnings
  - [ ] 4.2: Block "Proceed" button if unresolved errors exist
  - [ ] 4.3: Add acknowledgment checkbox for proceeding with warnings
  - [ ] 4.4: Store approval decisions for audit log

## Dev Notes

### Architecture Compliance

**File Structure:**
```
src/
├── lib/
│   └── validations/
│       ├── csv-validation.ts       # Validation logic
│       └── anomaly-detection.ts    # Anomaly detection rules
├── components/features/admin/
│   ├── ValidationSummary.tsx       # Overview counts
│   ├── ValidationDetails.tsx       # Detailed issues list
│   └── AnomalyReview.tsx          # Approve/reject interface
```

### Technical Requirements

**Validation Rules:**
```typescript
interface ValidationResult {
  valid: boolean
  errors: ValidationIssue[]    // Block import
  warnings: ValidationIssue[]  // Allow with acknowledgment
  validRows: number
  totalRows: number
}

interface ValidationIssue {
  row: number
  field: string
  value: unknown
  issue: string
  severity: 'error' | 'warning'
  suggestion?: string
}
```

**Anomaly Detection Thresholds:**
```typescript
const ANOMALY_THRESHOLDS = {
  priceChangePercent: 50,      // Flag if price changes >50%
  minPrice: 10,                // Flag if price < €10/m³
  maxPrice: 10000,             // Flag if price > €10,000/m³
  stockChangeThreshold: 500,   // Flag if stock changes by >500 units
}
```

**Error Types (Block Import):**
- Missing required field (sku)
- Invalid data type (non-numeric price)
- Duplicate SKU in upload
- SKU format invalid

**Warning Types (Allow with Acknowledgment):**
- Price change > threshold
- Stock change > threshold
- New SKU (not in database)
- Price below minimum threshold
- Price above maximum threshold

### UI Components

**ValidationSummary:**
```tsx
<Card>
  <div className="grid grid-cols-3 gap-4">
    <MetricCard label="Valid" value={120} color="green" />
    <MetricCard label="Warnings" value={5} color="yellow" />
    <MetricCard label="Errors" value={2} color="red" />
  </div>
</Card>
```

**ValidationDetails:**
- Expandable accordion for each issue
- Show: Row #, Field, Current Value, New Value, Issue
- Approve/Ignore button for warnings

### Dependencies

- **Story 6.2**: CSV upload and parsing must work
- **Story 1.2**: Products table for comparison queries

### References

- [Source: prd.md#FR37] - Validation requirements
- [Source: architecture.md#NFR52] - Validation before import
- [Source: epics.md#Story-6.3] - Acceptance criteria

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

