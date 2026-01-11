# Story 7.5: Enable Time Period Comparison

Status: ready-for-dev

## Story

As an **Analytics Admin**,
I want **to compare metrics across different time periods**,
so that **I can identify trends and measure campaign impact** (FR48).

## Acceptance Criteria

1. **Given** the analytics dashboard is displayed
   **When** comparison mode is enabled
   **Then** a "Compare to" option allows selecting a previous period

2. **Given** comparison options are available
   **When** viewing choices
   **Then** comparison options include: previous period, same period last month, custom range

3. **Given** comparison is active
   **When** metrics are displayed
   **Then** metrics display current value and comparison value side-by-side

4. **Given** comparison data is shown
   **When** calculating change
   **Then** percentage change is calculated and displayed (e.g., +15%, -8%)

5. **Given** change percentages are displayed
   **When** viewing indicators
   **Then** positive changes show green, negative show red (contextually appropriate)

6. **Given** chart visualizations exist
   **When** comparison is active
   **Then** charts can overlay current and comparison periods

## Tasks / Subtasks

- [ ] Task 1: Add Comparison Toggle (AC: 1)
  - [ ] 1.1: Create ComparisonSelector component
  - [ ] 1.2: Add toggle to enable/disable comparison mode
  - [ ] 1.3: Position near date range selector

- [ ] Task 2: Implement Comparison Options (AC: 2)
  - [ ] 2.1: "Previous Period" - same duration, immediately prior
  - [ ] 2.2: "Same Period Last Month" - same dates, previous month
  - [ ] 2.3: "Custom Range" - allow manual selection
  - [ ] 2.4: Store comparison selection in URL params

- [ ] Task 3: Fetch Comparison Data (AC: 3)
  - [ ] 3.1: Calculate comparison date range based on selection
  - [ ] 3.2: Fetch both current and comparison data
  - [ ] 3.3: Parallel fetch for performance

- [ ] Task 4: Display Comparison Values (AC: 3, 4)
  - [ ] 4.1: Update AnalyticsCard to show comparison
  - [ ] 4.2: Show: Current value, Comparison value, % Change
  - [ ] 4.3: Format: "1,234 vs 1,100 (+12.2%)"

- [ ] Task 5: Contextual Color Coding (AC: 5)
  - [ ] 5.1: Define which metrics "up is good" vs "up is bad"
  - [ ] 5.2: Apply green/red based on metric context
  - [ ] 5.3: Use neutral color for metrics where change is neither good nor bad

- [ ] Task 6: Chart Overlay (AC: 6)
  - [ ] 6.1: Update chart components to accept comparison data
  - [ ] 6.2: Render comparison as dashed/lighter line
  - [ ] 6.3: Add legend distinguishing current vs comparison

## Dev Notes

### Architecture Compliance

**File Structure:**
```
src/
├── components/features/admin/
│   ├── ComparisonSelector.tsx      # Toggle and options
│   ├── ComparisonCard.tsx          # Card with comparison
│   └── ComparisonChart.tsx         # Chart with overlay
├── lib/
│   └── utils/
│       └── date-comparison.ts      # Date range calculations
```

### Technical Requirements

**Comparison Options:**
```typescript
type ComparisonOption =
  | 'previous_period'    // Same duration, immediately before
  | 'same_period_month'  // Same dates, previous month
  | 'custom'             // User-defined range

interface ComparisonRange {
  current: { from: Date, to: Date }
  comparison: { from: Date, to: Date }
}
```

**Date Calculation Logic:**
```typescript
function calculateComparisonRange(
  currentFrom: Date,
  currentTo: Date,
  option: ComparisonOption
): ComparisonRange {
  const duration = currentTo.getTime() - currentFrom.getTime()

  switch (option) {
    case 'previous_period':
      return {
        current: { from: currentFrom, to: currentTo },
        comparison: {
          from: new Date(currentFrom.getTime() - duration),
          to: new Date(currentFrom.getTime() - 1), // Day before current start
        }
      }
    case 'same_period_month':
      return {
        current: { from: currentFrom, to: currentTo },
        comparison: {
          from: subMonths(currentFrom, 1),
          to: subMonths(currentTo, 1),
        }
      }
    // ...
  }
}
```

**Comparison Data Structure:**
```typescript
interface ComparisonMetric {
  current: number
  comparison: number
  change: number        // Absolute change
  changePercent: number // Percentage change
  trend: 'up' | 'down' | 'flat'
}

interface AnalyticsWithComparison {
  visitors: ComparisonMetric
  pageViews: ComparisonMetric
  quoteSubmissions: ComparisonMetric
  // ...
}
```

**Metric Context (for color coding):**
```typescript
// Metrics where UP is GOOD (green)
const UP_IS_GOOD = ['visitors', 'pageViews', 'quoteSubmissions', 'conversionRate']

// Metrics where DOWN is GOOD (green)
const DOWN_IS_GOOD = ['bounceRate', 'avgLoadTime']

// Metrics that are neutral
const NEUTRAL = ['uniqueCountries']
```

### UI Components

**ComparisonCard Layout:**
```
┌──────────────────────────────┐
│  👥 Total Visitors           │
│                              │
│  1,234                       │
│  vs 1,100 last period        │
│                              │
│  ↑ +12.2%     ████████       │
│  (green)                     │
└──────────────────────────────┘
```

**ComparisonSelector:**
```
┌──────────────────────────────────────────┐
│ Date Range: [Last 7 Days ▼]              │
│                                          │
│ ☑ Compare to: [Previous Period ▼]       │
│   ○ Previous Period (Dec 27 - Jan 2)     │
│   ○ Same Period Last Month (Dec 3-9)     │
│   ○ Custom Range...                      │
└──────────────────────────────────────────┘
```

**Chart with Overlay:**
```
Visitors Over Time
    ^
    |     ╭───╮
1.5k|    ╱     ╲    Current (solid)
    |   ╱   ┄┄┄╲┄┄┄┄ Comparison (dashed)
1.0k| ╭╱ ┄┄╱
    |╱┄┄
    └──────────────────→
     Mon  Tue  Wed  Thu  Fri
```

### Percentage Change Calculation

```typescript
function calculateChange(current: number, comparison: number): ComparisonMetric {
  const change = current - comparison
  const changePercent = comparison > 0
    ? ((current - comparison) / comparison) * 100
    : 0

  return {
    current,
    comparison,
    change,
    changePercent: Math.round(changePercent * 10) / 10, // 1 decimal
    trend: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
  }
}
```

### Dependencies

- **Story 7.2**: Base analytics dashboard
- **Story 7.3**: Visitor metrics to compare
- **Story 7.4**: Engagement metrics to compare

### References

- [Source: prd.md#FR48] - Compare metrics across time
- [Source: ux-design.md] - Johan persona tracking campaigns

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

