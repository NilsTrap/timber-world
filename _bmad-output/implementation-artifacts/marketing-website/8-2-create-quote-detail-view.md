# Story 8.2: Create Quote Detail View

Status: ready-for-dev

## Story

As a **Quote Handler**,
I want **to see complete details of a quote request**,
so that **I can prepare an accurate response** (FR50).

## Acceptance Criteria

1. **Given** a quote request is selected from the queue
   **When** the detail view loads
   **Then** the full request details are displayed including all submitted information (FR50)

2. **Given** the detail view is displayed
   **When** viewing customer info
   **Then** contact information shows: company, name, email, phone

3. **Given** products were selected
   **When** viewing the detail
   **Then** requested products are listed with specifications and quantities

4. **Given** a custom quote request
   **When** viewing details
   **Then** custom specifications are displayed (dimensions, finishes, notes)

5. **Given** the detail view
   **When** viewing history
   **Then** submission timestamp and any previous communications are visible

6. **Given** the quote detail
   **When** viewing navigation
   **Then** a back link returns to the quotes queue

7. **Given** the quote detail page
   **When** viewing status
   **Then** current status is displayed prominently

## Tasks / Subtasks

- [ ] Task 1: Create Detail Page (AC: 1, 6)
  - [ ] 1.1: Create `src/app/admin/quotes/[id]/page.tsx`
  - [ ] 1.2: Fetch quote by ID from Supabase
  - [ ] 1.3: Handle not found (404 page)
  - [ ] 1.4: Add back navigation link

- [ ] Task 2: Display Contact Information (AC: 2)
  - [ ] 2.1: Create ContactCard component
  - [ ] 2.2: Show: company_name, contact_name, email, phone
  - [ ] 2.3: Make email/phone clickable (mailto:, tel:)

- [ ] Task 3: Display Requested Products (AC: 3)
  - [ ] 3.1: Create ProductList component for quote view
  - [ ] 3.2: Show each product: SKU, name, specs, quantity
  - [ ] 3.3: Show subtotals if prices available

- [ ] Task 4: Display Custom Specifications (AC: 4)
  - [ ] 4.1: Create CustomSpecifications component
  - [ ] 4.2: Show: dimensions, finish type, CNC requirements
  - [ ] 4.3: Display customer notes/special requests
  - [ ] 4.4: Highlight custom fields that differ from standard

- [ ] Task 5: Display Timeline/History (AC: 5)
  - [ ] 5.1: Create QuoteTimeline component
  - [ ] 5.2: Show: submission date, acknowledgments, quotes sent
  - [ ] 5.3: Display as vertical timeline

- [ ] Task 6: Status Display (AC: 7)
  - [ ] 6.1: Show current status badge prominently
  - [ ] 6.2: Display time since submission
  - [ ] 6.3: Show urgency indicator if pending > 24h

## Dev Notes

### Architecture Compliance

**File Structure:**
```
src/
├── app/admin/quotes/
│   └── [id]/
│       └── page.tsx                # Quote detail page
├── components/features/admin/
│   ├── QuoteDetail.tsx             # Main detail component
│   ├── ContactCard.tsx             # Customer contact info
│   ├── QuoteProductList.tsx        # Requested products
│   ├── CustomSpecifications.tsx    # Custom quote details
│   └── QuoteTimeline.tsx           # Activity timeline
```

### Technical Requirements

**Full Quote Request Structure:**
```typescript
interface QuoteRequest {
  id: string
  // Customer Info
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone?: string
  delivery_country: string
  delivery_city?: string

  // Quote Details
  quote_type: 'stock' | 'custom'
  products: QuoteProduct[]
  custom_specs?: CustomSpecifications

  // Status & Metadata
  status: QuoteStatus
  created_at: string
  updated_at: string

  // Activity
  timeline: TimelineEvent[]
}

interface QuoteProduct {
  product_id?: string
  sku?: string
  name: string
  quantity: number
  unit: 'm³' | 'pieces' | 'm²'
  specifications: Record<string, string>
}

interface CustomSpecifications {
  dimensions?: { width: number, length: number, thickness: number }
  finish?: string
  cnc_requirements?: string
  notes?: string
}

interface TimelineEvent {
  type: 'submitted' | 'acknowledged' | 'quoted' | 'followed_up' | 'closed'
  timestamp: string
  details?: string
  user_id?: string
}
```

**Server Action:**
```typescript
export async function getQuoteById(
  id: string
): Promise<ActionResult<QuoteRequest>> {
  const { data, error } = await supabase
    .from('quote_requests')
    .select(`
      *,
      quote_products (*),
      quote_timeline (*)
    `)
    .eq('id', id)
    .single()

  if (error || !data) {
    return { success: false, error: 'Quote not found' }
  }

  return { success: true, data }
}
```

### UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to Quotes                                                   │
│                                                                     │
│  Quote #QR-2026-0145                         Status: 🟡 Pending     │
│  Submitted: Jan 10, 2026 at 14:32 (2 hours ago)                    │
├─────────────────────────────────┬───────────────────────────────────┤
│                                 │                                   │
│  👤 Customer Information        │  📦 Requested Products           │
│  ──────────────────────        │  ─────────────────────           │
│  Company: Nordic Furniture AB   │                                   │
│  Contact: Erik Lindqvist        │  1. Oak Panel FJ 22×1200         │
│  Email: erik@nordicfurn.se      │     Qty: 50 pieces               │
│  Phone: +46 70 123 4567         │     Grade: A/B, FSC Certified    │
│                                 │                                   │
│  📍 Delivery                    │  2. Oak Panel FS 27×2400         │
│  Country: Sweden                │     Qty: 25 pieces               │
│  City: Gothenburg               │     Grade: A, Natural Finish     │
│                                 │                                   │
├─────────────────────────────────┴───────────────────────────────────┤
│                                                                     │
│  📝 Customer Notes                                                  │
│  ────────────────                                                  │
│  "Need delivery within 6 weeks for upcoming furniture production   │
│   run. Open to alternatives if exact specs not available."         │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📅 Activity Timeline                                               │
│  ─────────────────                                                 │
│  ● Jan 10, 14:32 - Quote submitted via web form                   │
│  ○ Awaiting response...                                            │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Send Acknowledgment]  [Create Quote Response]  [Mark as Closed]  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Urgency Indicator

```typescript
function getUrgencyLevel(createdAt: string): 'normal' | 'warning' | 'urgent' {
  const hoursAgo = differenceInHours(new Date(), new Date(createdAt))

  if (hoursAgo < 4) return 'normal'      // Green
  if (hoursAgo < 24) return 'warning'    // Yellow
  return 'urgent'                         // Red
}
```

### Dependencies

- **Story 8.1**: Quote queue must exist for navigation
- **Story 4.5**: Quote request data structure

### References

- [Source: prd.md#FR50] - See all quote request details
- [Source: ux-design.md] - Lisa persona workflow

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

