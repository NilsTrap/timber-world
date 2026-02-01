# Story 7.1: Integrate Vercel Analytics

Status: ready-for-dev

## Story

As a **developer**,
I want **Vercel Analytics integrated into the application**,
so that **visitor data is collected for the analytics dashboard**.

## Acceptance Criteria

1. **Given** the Next.js application is deployed on Vercel
   **When** Vercel Analytics is configured
   **Then** @vercel/analytics package is installed and initialized in the root layout

2. **Given** analytics is active
   **When** users visit pages
   **Then** page views are automatically tracked across all routes

3. **Given** analytics is collecting data
   **When** performance is measured
   **Then** Web Vitals (LCP, FCP, CLS, TTI) are collected

4. **Given** visitors access the site
   **When** their location is determined
   **Then** geographic data is captured based on visitor location

5. **Given** analytics data is collected
   **When** accessed programmatically
   **Then** analytics data is accessible via Vercel Analytics API

6. **Given** privacy requirements
   **When** analytics collects data
   **Then** no personally identifiable information is collected (GDPR compliant)

## Tasks / Subtasks

- [ ] Task 1: Install and Configure Package (AC: 1)
  - [ ] 1.1: Install @vercel/analytics package
  - [ ] 1.2: Add Analytics component to root layout.tsx
  - [ ] 1.3: Verify analytics appears in Vercel dashboard after deploy

- [ ] Task 2: Enable Web Vitals (AC: 2, 3)
  - [ ] 2.1: Install @vercel/speed-insights (optional, for detailed vitals)
  - [ ] 2.2: Add SpeedInsights component to layout
  - [ ] 2.3: Verify Web Vitals are being collected in dashboard

- [ ] Task 3: Configure Custom Events (AC: 2)
  - [ ] 3.1: Create analytics utility: `lib/analytics.ts`
  - [ ] 3.2: Add custom event tracking for key actions:
    - Quote form started
    - Quote form submitted
    - Product filter applied
    - Journey stage viewed
  - [ ] 3.3: Document event naming conventions

- [ ] Task 4: API Access Setup (AC: 5)
  - [ ] 4.1: Note Vercel Analytics API endpoint
  - [ ] 4.2: Create utility for fetching analytics data (for admin dashboard)
  - [ ] 4.3: Test API access with Vercel token

- [ ] Task 5: Privacy Compliance (AC: 6)
  - [ ] 5.1: Verify no PII is collected in events
  - [ ] 5.2: Document what data is collected
  - [ ] 5.3: Update privacy policy if needed

## Dev Notes

### Architecture Compliance

**File Structure:**
```
src/
├── app/
│   └── layout.tsx                  # Add Analytics + SpeedInsights
├── lib/
│   └── analytics.ts                # Custom event tracking utility
```

### Technical Requirements

**Root Layout Integration:**
```tsx
// src/app/layout.tsx
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
```

**Custom Event Tracking:**
```typescript
// src/lib/analytics.ts
import { track } from '@vercel/analytics'

export const analytics = {
  // Quote funnel events
  quoteStarted: (type: 'form' | 'chat') =>
    track('quote_started', { method: type }),

  quoteSubmitted: (type: 'stock' | 'custom') =>
    track('quote_submitted', { quote_type: type }),

  // Catalog events
  filterApplied: (filterType: string) =>
    track('filter_applied', { filter: filterType }),

  productViewed: (sku: string) =>
    track('product_viewed', { sku }),

  // Journey events
  journeyStageViewed: (stage: number) =>
    track('journey_stage', { stage }),

  journeyCompleted: () =>
    track('journey_completed'),
}
```

**Event Naming Convention:**
- Use snake_case for event names
- Use descriptive names: `quote_started`, not `qs`
- Include relevant properties (but no PII)

### Vercel Analytics API

**API Endpoint:**
```
GET https://vercel.com/api/web-analytics
Authorization: Bearer <VERCEL_TOKEN>
```

**Utility for Admin Dashboard:**
```typescript
// src/lib/vercel-analytics-api.ts
export async function getAnalyticsData(
  projectId: string,
  from: Date,
  to: Date
) {
  // Note: This requires Vercel Pro plan for API access
  // For MVP, use Vercel Dashboard directly
  // Build custom tracking with Supabase as alternative
}
```

### Alternative: Custom Analytics (if Vercel API insufficient)

If Vercel Analytics API doesn't provide needed granularity:
```typescript
// Track events in Supabase for custom dashboard
const { error } = await supabase
  .from('analytics_events')
  .insert({
    event_name: 'quote_submitted',
    properties: { quote_type: 'stock' },
    timestamp: new Date().toISOString(),
    session_id: getSessionId(),
  })
```

### Privacy Considerations

**What IS Collected:**
- Page views (URL path, not full URL with query params)
- Web Vitals metrics
- Country/region (from IP, IP not stored)
- Device type, browser, OS
- Custom events (no PII in properties)

**What IS NOT Collected:**
- IP addresses
- User names or emails
- Precise location
- Form field values
- Cookies for tracking across sites

### Dependencies

- **Story 1.1**: Basic Next.js project must exist
- Vercel deployment required for full functionality

### References

- [Source: architecture.md#Analytics] - Vercel Analytics choice
- [Source: prd.md#FR42-FR48] - Analytics requirements
- [Source: architecture.md#NFR45] - Analytics integration

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

