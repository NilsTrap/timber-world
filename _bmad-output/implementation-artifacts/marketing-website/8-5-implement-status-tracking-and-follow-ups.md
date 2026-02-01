# Story 8.5: Implement Status Tracking and Follow-ups

Status: ready-for-dev

## Story

As a **Quote Handler**,
I want **to track quote statuses and send follow-up messages**,
so that **no leads fall through the cracks** (FR55, FR56).

## Acceptance Criteria

1. **Given** a quote has been sent
   **When** viewing the quote
   **Then** the status can be updated (pending response, closed-won, closed-lost) (FR55)

2. **Given** the quotes queue
   **When** filtering by status
   **Then** quotes can be filtered by their current status

3. **Given** a quote was sent several days ago
   **When** no customer response received
   **Then** the quote is highlighted as needing follow-up

4. **Given** a quote needs follow-up
   **When** clicking "Send Follow-up"
   **Then** a follow-up message can be sent to the customer (FR56)

5. **Given** follow-up templates
   **When** selecting one
   **Then** pre-written follow-up templates are available (with customization)

6. **Given** a follow-up is sent
   **When** viewing the timeline
   **Then** the timeline records the follow-up action

7. **Given** the quote queue
   **When** viewing pending items
   **Then** quotes older than X days (configurable) are visually flagged

## Tasks / Subtasks

- [ ] Task 1: Implement Status Updates (AC: 1)
  - [ ] 1.1: Add status dropdown/buttons to quote detail
  - [ ] 1.2: Create status options: quoted, follow_up_sent, closed_won, closed_lost
  - [ ] 1.3: Create Server Action `updateQuoteStatus`
  - [ ] 1.4: Record status change in timeline

- [ ] Task 2: Status Filter Enhancement (AC: 2)
  - [ ] 2.1: Update queue filter to include new statuses
  - [ ] 2.2: Add count badges per status
  - [ ] 2.3: Allow multi-select filtering

- [ ] Task 3: Follow-up Identification (AC: 3, 7)
  - [ ] 3.1: Calculate days since last activity
  - [ ] 3.2: Highlight quotes needing follow-up (>3 days, configurable)
  - [ ] 3.3: Add visual indicator (badge, color, icon)
  - [ ] 3.4: Sort by urgency option

- [ ] Task 4: Follow-up Message Feature (AC: 4, 5)
  - [ ] 4.1: Create FollowUpDialog component
  - [ ] 4.2: Create follow-up templates
  - [ ] 4.3: Allow customization before sending
  - [ ] 4.4: Send via Resend

- [ ] Task 5: Timeline Recording (AC: 6)
  - [ ] 5.1: Record follow-up sent in timeline
  - [ ] 5.2: Show follow-up count in queue
  - [ ] 5.3: Track follow-up sequence number

## Dev Notes

### Architecture Compliance

**File Structure:**
```
src/
├── app/admin/quotes/
│   ├── page.tsx                    # Enhanced queue with follow-up flags
│   └── [id]/
│       └── page.tsx                # Status controls, follow-up button
├── components/features/admin/
│   ├── StatusSelector.tsx          # Status update dropdown
│   ├── FollowUpDialog.tsx          # Follow-up message form
│   ├── FollowUpIndicator.tsx       # Visual flag for follow-up needed
│   └── QuoteTimeline.tsx           # Enhanced with follow-ups
├── config/
│   └── follow-up-templates.ts      # Follow-up message templates
```

### Technical Requirements

**Extended Quote Status:**
```typescript
type QuoteStatus =
  | 'pending'           // Initial, awaiting processing
  | 'acknowledged'      // Acknowledgment sent
  | 'quoted'            // Quote sent, awaiting customer response
  | 'follow_up_sent'    // Follow-up sent (can repeat)
  | 'closed_won'        // Customer accepted, order placed
  | 'closed_lost'       // Customer declined or no response
  | 'expired'           // Quote validity expired

interface QuoteStatusConfig {
  status: QuoteStatus
  label: string
  color: string
  allowedTransitions: QuoteStatus[]
}

const STATUS_CONFIG: QuoteStatusConfig[] = [
  {
    status: 'pending',
    label: 'Pending',
    color: 'yellow',
    allowedTransitions: ['acknowledged', 'quoted', 'closed_lost'],
  },
  {
    status: 'quoted',
    label: 'Quoted',
    color: 'blue',
    allowedTransitions: ['follow_up_sent', 'closed_won', 'closed_lost', 'expired'],
  },
  // ...
]
```

**Follow-up Configuration:**
```typescript
// src/config/follow-up-templates.ts
export const FOLLOW_UP_CONFIG = {
  daysBeforeFollowUp: 3,       // Days after quote before flagging
  maxFollowUps: 3,             // Maximum follow-ups before closing
  templates: [
    {
      id: 'gentle-reminder',
      name: 'Gentle Reminder',
      subject: 'Following up on your quote request',
      body: `Dear {{name}},

I wanted to follow up on the quote we sent on {{quote_date}}. Have you had a chance to review it?

If you have any questions or need clarification on any aspect of the quote, please don't hesitate to reach out.

The quote remains valid until {{valid_until}}.

Best regards,
Timber International Team`,
    },
    {
      id: 'final-follow-up',
      name: 'Final Follow-up',
      subject: 'Your quote is expiring soon',
      body: `Dear {{name}},

This is a friendly reminder that the quote we sent for your inquiry will expire on {{valid_until}}.

If you're still interested, we'd be happy to discuss your requirements or adjust the quote if needed.

Please let us know if you have any questions.

Best regards,
Timber International Team`,
    },
  ],
}
```

**Server Actions:**
```typescript
export async function updateQuoteStatus(
  quoteId: string,
  status: QuoteStatus,
  notes?: string
): Promise<ActionResult<QuoteRequest>> {
  // 1. Validate status transition
  // 2. Update quote_requests.status
  // 3. Add timeline entry
  // 4. Return updated quote
}

export async function sendFollowUp(
  quoteId: string,
  templateId: string,
  customMessage?: string
): Promise<ActionResult<{ sent: boolean }>> {
  // 1. Get quote and customer details
  // 2. Get/customize template
  // 3. Send email
  // 4. Update status to 'follow_up_sent'
  // 5. Increment follow_up_count
  // 6. Add timeline entry
}
```

**Follow-up Query:**
```typescript
// Get quotes needing follow-up
const { data: needsFollowUp } = await supabase
  .from('quote_requests')
  .select('*')
  .eq('status', 'quoted')
  .lt('updated_at', subDays(new Date(), FOLLOW_UP_CONFIG.daysBeforeFollowUp).toISOString())
  .lt('follow_up_count', FOLLOW_UP_CONFIG.maxFollowUps)
```

### UI Components

**Status Selector:**
```
┌─────────────────────────────────────┐
│  Status: [Quoted ▼]                 │
│  ┌─────────────────────────────┐   │
│  │ ○ Pending                   │   │
│  │ ○ Acknowledged              │   │
│  │ ● Quoted                    │   │
│  │ ○ Closed (Won) ✓            │   │
│  │ ○ Closed (Lost) ✗           │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Queue with Follow-up Flags:**
```
┌────────────────────────────────────────────────────────────────────┐
│  📝 Quote Requests               Needs Follow-up: 5               │
├───────────┬──────────────┬──────────┬──────────┬──────────────────┤
│ Company   │ Contact      │ Status   │ Age      │ Action           │
├───────────┼──────────────┼──────────┼──────────┼──────────────────┤
│ Nordic    │ Erik L.      │ 🟡 Quoted│ 5d 🔴    │ [Send Follow-up] │
│ Furniture │              │          │          │                  │
├───────────┼──────────────┼──────────┼──────────┼──────────────────┤
│ Stairs AS │ Anna K.      │ 🟢 Won   │ 8d       │ [View Details]   │
└───────────┴──────────────┴──────────┴──────────┴──────────────────┘
```

**Follow-up Indicator:**
```typescript
function FollowUpIndicator({ daysSinceQuote, followUpCount }: Props) {
  if (daysSinceQuote <= 3) return null

  const urgency = daysSinceQuote > 7 ? 'urgent' : 'warning'

  return (
    <Badge variant={urgency}>
      {daysSinceQuote}d ({followUpCount}/3 follow-ups)
    </Badge>
  )
}
```

### Timeline Entry Types

```typescript
type TimelineEventType =
  | 'submitted'       // Customer submitted request
  | 'acknowledged'    // Handler sent acknowledgment
  | 'quoted'          // Handler sent quote
  | 'follow_up_1'     // First follow-up
  | 'follow_up_2'     // Second follow-up
  | 'follow_up_3'     // Final follow-up
  | 'closed_won'      // Customer accepted
  | 'closed_lost'     // Customer declined
  | 'status_changed'  // Manual status change
  | 'note_added'      // Internal note added
```

### Dependencies

- **Story 8.3**: Quote response sending
- **Story 8.4**: Acknowledgment system (template pattern reuse)

### References

- [Source: prd.md#FR55] - Track quote response status
- [Source: prd.md#FR56] - Send follow-up messages
- [Source: ux-design.md] - Lisa persona workflow

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

