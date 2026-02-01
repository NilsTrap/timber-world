# Story 7.2: Build Analytics Dashboard Page

Status: ready-for-dev

## Story

As an **Analytics Admin**,
I want **a dashboard showing key website metrics**,
so that **I can monitor performance at a glance** (FR42).

## Acceptance Criteria

1. **Given** an authenticated admin navigates to /admin/analytics
   **When** the dashboard loads
   **Then** key metrics display in card format: total visitors, page views, quote submissions

2. **Given** the analytics dashboard is displayed
   **When** selecting date range
   **Then** a date range selector allows filtering (today, 7 days, 30 days, custom)

3. **Given** a date range is selected
   **When** the selection changes
   **Then** metrics update based on selected date range

4. **Given** data is being fetched
   **When** loading
   **Then** loading states show while data fetches (skeleton loaders)

5. **Given** the dashboard is rendered
   **When** viewing the layout
   **Then** the dashboard layout is clean and scannable

6. **Given** the dashboard page
   **When** data is displayed
   **Then** data refreshes on page load (no real-time requirement)

## Tasks / Subtasks

- [ ] Task 1: Create Analytics Page (AC: 1)
  - [ ] 1.1: Create `src/app/admin/analytics/page.tsx`
  - [ ] 1.2: Add page to admin sidebar navigation
  - [ ] 1.3: Create page header with title "Analytics"

- [ ] Task 2: Build Metric Cards (AC: 1, 5)
  - [ ] 2.1: Create AnalyticsCard component
  - [ ] 2.2: Display: Total Visitors, Page Views, Quote Submissions
  - [ ] 2.3: Include trend indicator (optional for MVP)
  - [ ] 2.4: Use grid layout (3 columns on desktop)

- [ ] Task 3: Implement Date Range Selector (AC: 2, 3)
  - [ ] 3.1: Create DateRangeSelector component
  - [ ] 3.2: Preset options: Today, Last 7 Days, Last 30 Days
  - [ ] 3.3: Custom date range picker (optional for MVP)
  - [ ] 3.4: Store selection in URL params for shareability

- [ ] Task 4: Data Fetching (AC: 3, 6)
  - [ ] 4.1: Create Server Action or API route for analytics data
  - [ ] 4.2: Query Vercel Analytics API or custom Supabase events
  - [ ] 4.3: Query quote_requests table for submission counts
  - [ ] 4.4: Aggregate data by date range

- [ ] Task 5: Loading States (AC: 4)
  - [ ] 5.1: Add Skeleton components for cards
  - [ ] 5.2: Show loading state during data fetch
  - [ ] 5.3: Handle error states gracefully

## Dev Notes

### Architecture Compliance

**File Structure:**
```
src/
├── app/admin/analytics/
│   └── page.tsx                    # Analytics dashboard
├── components/features/admin/
│   ├── AnalyticsCard.tsx           # Metric display card
│   ├── DateRangeSelector.tsx       # Date range picker
│   └── AnalyticsChart.tsx          # (For later stories)
├── lib/
│   └── actions/
│       └── analytics.ts            # getAnalyticsData action
```

### Technical Requirements

**Analytics Data Structure:**
```typescript
interface AnalyticsData {
  visitors: {
    total: number
    trend?: number  // % change vs previous period
  }
  pageViews: {
    total: number
    trend?: number
  }
  quoteSubmissions: {
    total: number
    byType: { stock: number, custom: number }
    trend?: number
  }
  dateRange: {
    from: Date
    to: Date
  }
}
```

**Server Action:**
```typescript
export async function getAnalyticsData(
  from: Date,
  to: Date
): Promise<ActionResult<AnalyticsData>> {
  // 1. Get visitor/page view data from Vercel or custom tracking
  // 2. Query quote_requests for submission counts
  const { count: quoteCount } = await supabase
    .from('quote_requests')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString())

  // 3. Return aggregated data
}
```

**Date Range Options:**
```typescript
const DATE_RANGES = [
  { label: 'Today', value: 'today', days: 0 },
  { label: 'Last 7 Days', value: '7d', days: 7 },
  { label: 'Last 30 Days', value: '30d', days: 30 },
  { label: 'Custom', value: 'custom' },
]
```

### UI Layout

```
┌─────────────────────────────────────────────────────┐
│  📊 Analytics               [Today ▼] [Last 7d ▼]  │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  👥 Visitors │  │  📄 Views   │  │  📝 Quotes  │ │
│  │    1,234    │  │    5,678    │  │      45     │ │
│  │   ↑ 12%     │  │   ↑ 8%      │  │   ↑ 25%    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│                                                     │
│  (Additional charts in stories 7.3-7.5)            │
└─────────────────────────────────────────────────────┘
```

### Data Sources

**Option A: Vercel Analytics API** (Requires Pro plan)
- Use Vercel API for visitor/pageview data
- Requires VERCEL_TOKEN environment variable

**Option B: Custom Tracking in Supabase** (Fallback)
```sql
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_name VARCHAR(100) NOT NULL,
  properties JSONB,
  page_path VARCHAR(255),
  session_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_events_created ON analytics_events(created_at);
CREATE INDEX idx_analytics_events_name ON analytics_events(event_name);
```

### Components

**AnalyticsCard:**
```tsx
interface AnalyticsCardProps {
  title: string
  value: number
  trend?: number
  icon: LucideIcon
  loading?: boolean
}
```

**DateRangeSelector:**
```tsx
interface DateRangeSelectorProps {
  value: string
  onChange: (range: string) => void
  customRange?: { from: Date, to: Date }
}
```

### Dependencies

- **Story 7.1**: Vercel Analytics integration
- **Story 6.1**: Admin dashboard layout/navigation

### References

- [Source: prd.md#FR42] - View visitor counts
- [Source: architecture.md#Analytics] - Vercel Analytics
- [Source: ux-design.md#Johan-Persona] - Analytics Admin journey

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

