# Story 8.4: Add Acknowledgment Messages

Status: ready-for-dev

## Story

As a **Quote Handler**,
I want **to send quick acknowledgment messages**,
so that **customers know we received their request and are working on it** (FR54).

## Acceptance Criteria

1. **Given** a quote request is pending
   **When** the handler clicks "Send Acknowledgment"
   **Then** a quick acknowledgment form opens

2. **Given** the acknowledgment form
   **When** viewing message options
   **Then** pre-written templates are available (e.g., "Received, responding within X hours")

3. **Given** an acknowledgment template is selected
   **When** reviewing the message
   **Then** the message can be customized before sending

4. **Given** the acknowledgment is ready
   **When** clicking "Send"
   **Then** an email is sent to the customer immediately

5. **Given** an acknowledgment is sent
   **When** viewing the quote
   **Then** the status updates to "acknowledged" and timeline records the action

6. **Given** a complex request
   **When** longer response time is needed
   **Then** the handler can indicate expected response time (24h, 48h, etc.)

## Tasks / Subtasks

- [ ] Task 1: Create Acknowledgment Form (AC: 1)
  - [ ] 1.1: Create AcknowledgmentDialog component
  - [ ] 1.2: Add "Send Acknowledgment" button to quote detail
  - [ ] 1.3: Pre-populate customer email

- [ ] Task 2: Template Selection (AC: 2)
  - [ ] 2.1: Create acknowledgment templates
  - [ ] 2.2: Display as selectable options
  - [ ] 2.3: Preview selected template

- [ ] Task 3: Message Customization (AC: 3)
  - [ ] 3.1: Allow editing the selected template
  - [ ] 3.2: Provide variables: {{name}}, {{company}}, {{response_time}}
  - [ ] 3.3: Real-time preview of final message

- [ ] Task 4: Send Acknowledgment Email (AC: 4)
  - [ ] 4.1: Create Server Action `sendAcknowledgment`
  - [ ] 4.2: Send email via Resend
  - [ ] 4.3: Handle send failures gracefully

- [ ] Task 5: Update Status and Timeline (AC: 5)
  - [ ] 5.1: Update status to 'acknowledged'
  - [ ] 5.2: Add timeline entry
  - [ ] 5.3: Record expected response time

- [ ] Task 6: Response Time Selection (AC: 6)
  - [ ] 6.1: Add response time selector (1h, 4h, 24h, 48h)
  - [ ] 6.2: Include in acknowledgment message
  - [ ] 6.3: Set reminder/alert for handler (optional)

## Dev Notes

### Architecture Compliance

**File Structure:**
```
src/
├── components/features/admin/
│   ├── AcknowledgmentDialog.tsx    # Acknowledgment form
│   └── TemplateSelector.tsx        # Template selection
├── lib/
│   ├── actions/
│   │   └── quotes.ts               # sendAcknowledgment action
│   └── email/
│       └── templates.tsx           # Acknowledgment template
├── config/
│   └── acknowledgment-templates.ts # Template definitions
```

### Technical Requirements

**Acknowledgment Templates:**
```typescript
// src/config/acknowledgment-templates.ts
export const ACKNOWLEDGMENT_TEMPLATES = [
  {
    id: 'standard',
    name: 'Standard (1 hour)',
    responseTime: '1h',
    subject: 'We received your quote request',
    body: `Dear {{name}},

Thank you for your quote request. We have received your inquiry and are reviewing it now.

You can expect a detailed quote from us within 1 hour.

If you have any immediate questions, please don't hesitate to contact us.

Best regards,
Timber International Team`,
  },
  {
    id: 'complex',
    name: 'Complex Request (24h)',
    responseTime: '24h',
    subject: 'We received your custom quote request',
    body: `Dear {{name}},

Thank you for your detailed quote request. We have received your inquiry for custom specifications.

Our team is reviewing your requirements and consulting with our production department. You can expect a comprehensive quote within 24 hours.

If you have any immediate questions, please don't hesitate to contact us.

Best regards,
Timber International Team`,
  },
  {
    id: 'weekend',
    name: 'Weekend Response',
    responseTime: '48h',
    subject: 'We received your quote request',
    body: `Dear {{name}},

Thank you for your quote request. We have received your inquiry.

As it's currently the weekend, you can expect our detailed quote by Monday end of day.

Best regards,
Timber International Team`,
  },
]
```

**Server Action:**
```typescript
interface AcknowledgmentInput {
  quoteRequestId: string
  templateId: string
  customMessage?: string
  expectedResponseTime: '1h' | '4h' | '24h' | '48h'
}

export async function sendAcknowledgment(
  input: AcknowledgmentInput
): Promise<ActionResult<{ sent: boolean }>> {
  // 1. Get quote request details
  // 2. Get/customize template
  // 3. Replace variables
  // 4. Send email
  // 5. Update status to 'acknowledged'
  // 6. Add timeline entry
  return { success: true, data: { sent: true } }
}
```

**Variable Replacement:**
```typescript
function replaceVariables(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => data[key] || match)
}

// Usage
const message = replaceVariables(template.body, {
  name: quoteRequest.contact_name,
  company: quoteRequest.company_name,
  response_time: '1 hour',
})
```

### UI Components

**Acknowledgment Dialog:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  📧 Send Acknowledgment                                        [X] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  To: erik@nordicfurn.se (Erik Lindqvist)                          │
│                                                                     │
│  Select Template:                                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ ○ Standard Response (1 hour)                                 │  │
│  │ ● Complex Request (24 hours)                                 │  │
│  │ ○ Weekend Response (Monday)                                  │  │
│  │ ○ Custom Message                                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Expected Response Time: [24 hours ▼]                              │
│                                                                     │
│  Message Preview:                                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Subject: We received your custom quote request               │  │
│  │                                                               │  │
│  │ Dear Erik,                                                    │  │
│  │                                                               │  │
│  │ Thank you for your detailed quote request. We have received  │  │
│  │ your inquiry for custom specifications.                      │  │
│  │                                                               │  │
│  │ Our team is reviewing your requirements and consulting with  │  │
│  │ our production department. You can expect a comprehensive    │  │
│  │ quote within 24 hours.                                       │  │
│  │                                                               │  │
│  │ [Edit Message]                                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│                                      [Cancel]  [Send Acknowledgment]│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Status Flow

```
pending → acknowledged → quoted → closed
                ↓
           (can skip to quoted if quick response)
```

### Dependencies

- **Story 8.2**: Quote detail view with action buttons
- Resend API configured

### References

- [Source: prd.md#FR54] - Send acknowledgment messages
- [Source: ux-design.md#Response-Commitments] - Response time expectations
- [Source: epics.md#Story-8.4] - Acceptance criteria

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

