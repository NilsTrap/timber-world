# Story 7.4: Show Engagement and Conversion Metrics

Status: ready-for-dev

## Story

As an **Analytics Admin**,
I want **to see how visitors engage with key pages**,
so that **I can optimize the user experience** (FR44, FR45, FR46, FR47).

## Acceptance Criteria

1. **Given** the analytics dashboard is displayed
   **When** engagement metrics are rendered
   **Then** production journey metrics show: average time on page, scroll completion rate (FR44)

2. **Given** catalog metrics are displayed
   **When** viewing engagement
   **Then** catalog engagement shows: page views, filter usage, products viewed (FR45)

3. **Given** quote metrics are displayed
   **When** viewing submissions
   **Then** quote metrics show: total submissions, submissions by type (stock/custom) (FR46)

4. **Given** funnel data is available
   **When** viewing conversion
   **Then** quote funnel shows: started vs submitted, with conversion rate (FR47)

5. **Given** metrics are displayed
   **When** comparing to previous period
   **Then** each metric includes trend indicator (up/down vs previous period)

6. **Given** a metric card is displayed
   **When** clicking on it
   **Then** clicking a metric shows more detailed breakdown

## Tasks / Subtasks

- [ ] Task 1: Production Journey Metrics (AC: 1)
  - [ ] 1.1: Track journey stage views (custom event)
  - [ ] 1.2: Calculate average time on journey page
  - [ ] 1.3: Track scroll completion (reached stage 8)
  - [ ] 1.4: Create JourneyMetrics component

- [ ] Task 2: Catalog Engagement Metrics (AC: 2)
  - [ ] 2.1: Track catalog page views
  - [ ] 2.2: Track filter applications (by filter type)
  - [ ] 2.3: Track products viewed (click-through)
  - [ ] 2.4: Create CatalogMetrics component

- [ ] Task 3: Quote Submission Metrics (AC: 3)
  - [ ] 3.1: Query quote_requests by date range
  - [ ] 3.2: Group by type (stock/custom)
  - [ ] 3.3: Create QuoteMetrics component

- [ ] Task 4: Quote Funnel Visualization (AC: 4)
  - [ ] 4.1: Track quote_started events
  - [ ] 4.2: Calculate: started, submitted, conversion rate
  - [ ] 4.3: Create FunnelChart component
  - [ ] 4.4: Show funnel visualization (bar or stages)

- [ ] Task 5: Trend Indicators (AC: 5)
  - [ ] 5.1: Fetch previous period data for comparison
  - [ ] 5.2: Calculate percentage change
  - [ ] 5.3: Display trend arrow (↑/↓) with color

- [ ] Task 6: Metric Detail Expansion (AC: 6)
  - [ ] 6.1: Make metric cards clickable
  - [ ] 6.2: Show expanded view with breakdown
  - [ ] 6.3: Add close/collapse action

## Dev Notes

### Architecture Compliance

**File Structure:**
```
src/
├── components/features/admin/
│   ├── JourneyMetrics.tsx          # Journey engagement
│   ├── CatalogMetrics.tsx          # Catalog engagement
│   ├── QuoteMetrics.tsx            # Quote submissions
│   ├── FunnelChart.tsx             # Conversion funnel
│   └── TrendIndicator.tsx          # Reusable trend display
├── lib/
│   └── actions/
│       └── analytics.ts            # Extended queries
```

### Technical Requirements

**Event Tracking (from Story 7.1):**
```typescript
// Journey events
analytics.journeyStageViewed(stageNumber)
analytics.journeyCompleted()

// Catalog events
analytics.filterApplied(filterType)
analytics.productViewed(sku)

// Quote events
analytics.quoteStarted(method) // 'form' | 'chat'
analytics.quoteSubmitted(type) // 'stock' | 'custom'
```

**Engagement Data Structure:**
```typescript
interface EngagementMetrics {
  journey: {
    pageViews: number
    avgTimeOnPage: number  // seconds
    completionRate: number // 0-100%
  }
  catalog: {
    pageViews: number
    filterUsage: Record<string, number>
    productsViewed: number
  }
  quotes: {
    total: number
    byType: { stock: number, custom: number }
    started: number
    submitted: number
    conversionRate: number // 0-100%
  }
}
```

**Funnel Calculation:**
```typescript
function calculateFunnel(events: AnalyticsEvent[]): FunnelData {
  const started = events.filter(e => e.event_name === 'quote_started').length
  const submitted = events.filter(e => e.event_name === 'quote_submitted').length

  return {
    started,
    submitted,
    conversionRate: started > 0 ? (submitted / started) * 100 : 0,
  }
}
```

### UI Components

**Engagement Metrics Grid:**
```
┌────────────────────────────────────────────────────────┐
│  📊 Engagement Metrics                                  │
├───────────────────────┬────────────────────────────────┤
│                       │                                │
│  🎬 Production Journey │  📦 Product Catalog           │
│  ─────────────────── │  ───────────────────           │
│  Views: 2,450        │  Views: 1,890                  │
│  Avg Time: 2m 34s    │  Filters Used: 456             │
│  Completion: 68%     │  Products Viewed: 234          │
│                      │                                │
├───────────────────────┴────────────────────────────────┤
│                                                        │
│  📝 Quote Funnel                                       │
│  ═══════════════════════════════════════════          │
│  Started: 120  ████████████████████████████           │
│  Submitted: 45 ██████████░░░░░░░░░░░░░░░░░░  37.5%    │
│                                                        │
│  By Type: Stock (32) | Custom (13)                    │
└────────────────────────────────────────────────────────┘
```

**Trend Indicator:**
```tsx
<TrendIndicator
  value={12.5}      // +12.5%
  positive={true}   // Up is good for this metric
/>
// Renders: ↑ 12.5% (green)

<TrendIndicator
  value={-8.2}
  positive={false}  // Down is bad for this metric
/>
// Renders: ↓ 8.2% (red)
```

**FunnelChart:**
- Horizontal bar chart showing progression
- Started → Submitted with % labels
- Color gradient from light to dark

### Custom Event Queries

**If using Supabase custom tracking:**
```typescript
// Quote funnel
const { data: funnelData } = await supabase
  .from('analytics_events')
  .select('event_name')
  .in('event_name', ['quote_started', 'quote_submitted'])
  .gte('created_at', from)
  .lte('created_at', to)

const started = funnelData.filter(e => e.event_name === 'quote_started').length
const submitted = funnelData.filter(e => e.event_name === 'quote_submitted').length
```

### Dependencies

- **Story 7.1**: Custom event tracking must be in place
- **Story 7.2**: Base analytics dashboard page
- **Story 4.5**: Quote submissions table for query

### References

- [Source: prd.md#FR44] - Time on production journey
- [Source: prd.md#FR45] - Catalog engagement metrics
- [Source: prd.md#FR46] - Quote submission counts
- [Source: prd.md#FR47] - Quote completion funnel

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

