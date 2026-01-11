# Story 7.3: Display Visitor and Geographic Metrics

Status: ready-for-dev

## Story

As an **Analytics Admin**,
I want **to see visitor counts broken down by country**,
so that **I can understand our geographic reach** (FR42, FR43).

## Acceptance Criteria

1. **Given** the analytics dashboard is displayed
   **When** visitor metrics are rendered
   **Then** total unique visitors count is displayed prominently (FR42)

2. **Given** geographic data is available
   **When** displayed
   **Then** a geographic breakdown shows visitors by country/region (FR43)

3. **Given** country breakdown is shown
   **When** viewing the list
   **Then** data displays as a table or chart (top 10 countries)

4. **Given** country data is displayed
   **When** viewing details
   **Then** percentage of total is shown for each country

5. **Given** date range is selected
   **When** viewing geographic data
   **Then** the breakdown respects the selected date range

6. **Given** some locations cannot be determined
   **When** displaying data
   **Then** unknown/unresolved locations are grouped as "Other"

## Tasks / Subtasks

- [ ] Task 1: Add Unique Visitors Metric (AC: 1)
  - [ ] 1.1: Update analytics data fetch to include unique visitors
  - [ ] 1.2: Display prominent visitor count card
  - [ ] 1.3: Add tooltip explaining "unique visitors"

- [ ] Task 2: Create Geographic Breakdown Component (AC: 2, 3)
  - [ ] 2.1: Create CountryBreakdown component
  - [ ] 2.2: Display as sortable table (Country, Visitors, %)
  - [ ] 2.3: Limit to top 10 countries
  - [ ] 2.4: Add "View All" expansion option

- [ ] Task 3: Calculate Percentages (AC: 4)
  - [ ] 3.1: Calculate percentage of total for each country
  - [ ] 3.2: Format as "X%" with one decimal place
  - [ ] 3.3: Add visual bar indicator for percentage

- [ ] Task 4: Date Range Integration (AC: 5)
  - [ ] 4.1: Pass date range to geographic query
  - [ ] 4.2: Update data when date range changes
  - [ ] 4.3: Show loading state during refresh

- [ ] Task 5: Handle Unknown Locations (AC: 6)
  - [ ] 5.1: Group unresolved/unknown locations as "Other"
  - [ ] 5.2: Display "Other" at bottom of list
  - [ ] 5.3: Include count and percentage for "Other"

## Dev Notes

### Architecture Compliance

**File Structure:**
```
src/
├── app/admin/analytics/
│   └── page.tsx                    # Main dashboard
├── components/features/admin/
│   ├── CountryBreakdown.tsx        # Geographic table
│   └── CountryRow.tsx              # Table row component
├── lib/
│   └── actions/
│       └── analytics.ts            # Extended with geo data
```

### Technical Requirements

**Geographic Data Structure:**
```typescript
interface CountryMetric {
  country: string
  countryCode: string  // ISO 3166-1 alpha-2
  visitors: number
  percentage: number
}

interface GeographicData {
  totalVisitors: number
  uniqueVisitors: number
  byCountry: CountryMetric[]
}
```

**Data Source Options:**

**Option A: Vercel Analytics API**
```typescript
// Vercel provides country breakdown automatically
const geoData = await vercelAnalytics.getCountryBreakdown({
  projectId,
  from,
  to,
})
```

**Option B: Custom Tracking with IP Geolocation**
```typescript
// Store country with events
const country = request.headers.get('x-vercel-ip-country') || 'Unknown'
await supabase.from('analytics_events').insert({
  event_name: 'page_view',
  properties: { country },
})

// Query aggregated
const { data } = await supabase
  .from('analytics_events')
  .select('properties->country')
  .gte('created_at', from)
  .lte('created_at', to)
```

### UI Components

**CountryBreakdown Table:**
```
┌────────────────────────────────────────┐
│  🌍 Visitors by Country                │
├──────────────┬──────────┬──────────────┤
│ Country      │ Visitors │ % of Total   │
├──────────────┼──────────┼──────────────┤
│ 🇫🇮 Finland   │    320   │ ████░░ 26%  │
│ 🇸🇪 Sweden    │    285   │ ███░░░ 23%  │
│ 🇳🇴 Norway    │    198   │ ██░░░░ 16%  │
│ 🇩🇪 Germany   │    156   │ █░░░░░ 13%  │
│ 🇩🇰 Denmark   │    124   │ █░░░░░ 10%  │
│ 🇳🇱 Netherlands│    78   │ █░░░░░  6%  │
│ Other        │    73    │ █░░░░░  6%  │
├──────────────┴──────────┴──────────────┤
│              [View All Countries]       │
└────────────────────────────────────────┘
```

**Country Flags:**
- Use country-flag-emoji package or simple emoji
- Fallback to country code if emoji unavailable

### Country Name Mapping

```typescript
const COUNTRY_NAMES: Record<string, string> = {
  FI: 'Finland',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  NL: 'Netherlands',
  DE: 'Germany',
  ES: 'Spain',
  GB: 'United Kingdom',
  // ... etc
}
```

### Percentage Calculation

```typescript
function calculatePercentages(
  byCountry: { country: string; visitors: number }[],
  total: number
): CountryMetric[] {
  return byCountry
    .map(c => ({
      ...c,
      percentage: Math.round((c.visitors / total) * 1000) / 10, // One decimal
    }))
    .sort((a, b) => b.visitors - a.visitors)
}
```

### Dependencies

- **Story 7.1**: Vercel Analytics collecting geographic data
- **Story 7.2**: Base analytics dashboard page

### References

- [Source: prd.md#FR42] - View visitor counts
- [Source: prd.md#FR43] - Visitor breakdown by country
- [Source: ux-design.md] - Johan persona analytics needs

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

