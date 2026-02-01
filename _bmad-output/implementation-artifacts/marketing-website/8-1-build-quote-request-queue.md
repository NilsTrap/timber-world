# Story 8.1: Build Quote Request Queue

Status: ready-for-dev

## Story

As a **Quote Handler**,
I want **to see all incoming quote requests in a queue**,
so that **I can prioritize and manage responses** (FR49).

## Acceptance Criteria

1. **Given** an admin navigates to /admin/quotes
   **When** the quotes page loads
   **Then** a list/table of quote requests is displayed, sorted by submission date (newest first)

2. **Given** the quotes list is displayed
   **When** viewing each request
   **Then** each request shows: company name, contact, submission date, type (stock/custom), status

3. **Given** the quotes list
   **When** filtering options are used
   **Then** requests can be filtered by status (pending, responded, closed)

4. **Given** the quotes list
   **When** a new request arrives
   **Then** the queue updates to show new requests (on page refresh)

5. **Given** a request in the queue
   **When** clicking on it
   **Then** it navigates to the detailed view for that request

6. **Given** the quote queue
   **When** viewing counts
   **Then** a count of pending requests is displayed prominently

## Tasks / Subtasks

- [ ] Task 1: Create Quotes List Page (AC: 1, 2)
  - [ ] 1.1: Create `src/app/admin/quotes/page.tsx`
  - [ ] 1.2: Implement DataTable with quote columns
  - [ ] 1.3: Sort by created_at descending by default
  - [ ] 1.4: Add pagination (20 items per page)

- [ ] Task 2: Display Request Details (AC: 2)
  - [ ] 2.1: Show company name column
  - [ ] 2.2: Show contact name and email
  - [ ] 2.3: Show submission timestamp (relative: "2 hours ago")
  - [ ] 2.4: Show quote type badge (Stock / Custom)
  - [ ] 2.5: Show status badge with color coding

- [ ] Task 3: Implement Status Filter (AC: 3)
  - [ ] 3.1: Create StatusFilter component
  - [ ] 3.2: Options: All, Pending, Responded, Closed
  - [ ] 3.3: Store filter in URL params
  - [ ] 3.4: Apply filter to Supabase query

- [ ] Task 4: Data Refresh (AC: 4)
  - [ ] 4.1: Fetch fresh data on page load
  - [ ] 4.2: Add manual "Refresh" button
  - [ ] 4.3: (Optional) Auto-refresh every 60 seconds

- [ ] Task 5: Navigation to Detail (AC: 5)
  - [ ] 5.1: Make row clickable
  - [ ] 5.2: Navigate to /admin/quotes/[id]

- [ ] Task 6: Pending Count Badge (AC: 6)
  - [ ] 6.1: Display pending count in page header
  - [ ] 6.2: Update count when filter changes
  - [ ] 6.3: Add badge to sidebar navigation

## Dev Notes

### Architecture Compliance

**File Structure:**
```
src/
├── app/admin/quotes/
│   ├── page.tsx                    # Quote queue list
│   └── [id]/
│       └── page.tsx                # Quote detail (Story 8.2)
├── components/features/admin/
│   ├── QuoteQueue.tsx              # Queue table component
│   ├── QuoteRow.tsx                # Row component
│   └── StatusBadge.tsx             # Status display
├── lib/
│   └── actions/
│       └── quotes.ts               # getQuotes action
```

### Technical Requirements

**Quote Status Enum:**
```typescript
type QuoteStatus = 'pending' | 'acknowledged' | 'quoted' | 'closed' | 'expired'
```

**Quote Request Data:**
```typescript
interface QuoteRequest {
  id: string
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone?: string
  quote_type: 'stock' | 'custom'
  status: QuoteStatus
  products: QuoteProduct[]
  notes?: string
  created_at: string
  updated_at: string
}
```

**Server Action:**
```typescript
export async function getQuotes(
  filter: { status?: QuoteStatus },
  pagination: { page: number, pageSize: number }
): Promise<ActionResult<{ quotes: QuoteRequest[], total: number }>> {
  let query = supabase
    .from('quote_requests')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filter.status) {
    query = query.eq('status', filter.status)
  }

  const { data, count, error } = await query
    .range(offset, offset + pageSize - 1)

  return { success: true, data: { quotes: data, total: count } }
}
```

### UI Components

**Quote Queue Table:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  📝 Quote Requests                    Pending: 12                  │
│  [All ▼] [Pending] [Responded] [Closed]              [🔄 Refresh] │
├───────────┬──────────────┬──────────┬──────────┬──────────┬────────┤
│ Company   │ Contact      │ Date     │ Type     │ Status   │        │
├───────────┼──────────────┼──────────┼──────────┼──────────┼────────┤
│ Nordic    │ Erik L.      │ 2h ago   │ 🟦 Custom │ 🟡 Pending│  →    │
│ Furniture │ erik@nf.se   │          │          │          │        │
├───────────┼──────────────┼──────────┼──────────┼──────────┼────────┤
│ Stairs AS │ Anna K.      │ 1d ago   │ 🟩 Stock │ 🟢 Quoted│  →    │
│           │ anna@st.no   │          │          │          │        │
├───────────┴──────────────┴──────────┴──────────┴──────────┴────────┤
│                        [← 1 2 3 ... 10 →]                          │
└─────────────────────────────────────────────────────────────────────┘
```

**Status Badge Colors:**
```typescript
const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  acknowledged: 'bg-blue-100 text-blue-800',
  quoted: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
  expired: 'bg-red-100 text-red-800',
}
```

**Type Badge:**
```typescript
const TYPE_BADGES = {
  stock: { label: 'Stock', color: 'bg-emerald-100 text-emerald-700' },
  custom: { label: 'Custom', color: 'bg-blue-100 text-blue-700' },
}
```

### Relative Date Formatting

```typescript
import { formatDistanceToNow } from 'date-fns'

function formatRelativeDate(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
  // "2 hours ago", "1 day ago", etc.
}
```

### Dependencies

- **Story 4.5**: Quote requests table must exist with submissions
- **Story 6.1**: Admin dashboard layout/navigation

### References

- [Source: prd.md#FR49] - View queue of quote requests
- [Source: architecture.md#Admin-Routes] - /admin/quotes route
- [Source: ux-design.md] - Lisa persona (Quote Handler)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

