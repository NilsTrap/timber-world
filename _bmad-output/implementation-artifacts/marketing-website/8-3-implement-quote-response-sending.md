# Story 8.3: Implement Quote Response Sending

Status: ready-for-dev

## Story

As a **Quote Handler**,
I want **to send quote responses to customers**,
so that **they receive pricing information promptly** (FR51, FR52, FR53).

## Acceptance Criteria

1. **Given** a quote request in pending status
   **When** the handler clicks "Create Quote Response"
   **Then** a quote builder form opens with customer and product context

2. **Given** the quote builder is open
   **When** filling in pricing
   **Then** the handler can enter prices, lead times, and validity period

3. **Given** a custom quote request
   **When** needing production input
   **Then** the handler can add internal notes/mark for production review (FR52)

4. **Given** quote details are complete
   **When** clicking "Send Quote"
   **Then** an email is sent to the customer with the quote (FR53)

5. **Given** a quote is sent
   **When** email succeeds
   **Then** the request status updates to "quoted" and the timeline records the action

6. **Given** the quote response
   **When** viewing the email
   **Then** the email includes: pricing, lead time, validity, contact for questions

7. **Given** a sent quote
   **When** viewing the quote detail
   **Then** the sent quote details are viewable from the admin interface

## Tasks / Subtasks

- [ ] Task 1: Create Quote Builder Form (AC: 1, 2)
  - [ ] 1.1: Create QuoteBuilder component (modal or page)
  - [ ] 1.2: Pre-populate with customer info and products
  - [ ] 1.3: Add price input fields per product
  - [ ] 1.4: Add lead time input (days or date)
  - [ ] 1.5: Add quote validity period (default 30 days)

- [ ] Task 2: Production Review Feature (AC: 3)
  - [ ] 2.1: Add "Request Production Review" checkbox
  - [ ] 2.2: Add internal notes field (not sent to customer)
  - [ ] 2.3: Mark request as "needs_review" status
  - [ ] 2.4: Notify production team (optional)

- [ ] Task 3: Send Quote Email (AC: 4, 6)
  - [ ] 3.1: Create Server Action `sendQuoteResponse`
  - [ ] 3.2: Generate email using Resend
  - [ ] 3.3: Include: greeting, products with prices, lead time, validity
  - [ ] 3.4: Include contact info for questions

- [ ] Task 4: Update Status and Timeline (AC: 5)
  - [ ] 4.1: Update quote_requests status to 'quoted'
  - [ ] 4.2: Add timeline entry with quote details
  - [ ] 4.3: Store sent quote for reference

- [ ] Task 5: View Sent Quote (AC: 7)
  - [ ] 5.1: Store quote response in database
  - [ ] 5.2: Display sent quote in detail view
  - [ ] 5.3: Allow resending quote if needed

## Dev Notes

### Architecture Compliance

**File Structure:**
```
src/
├── app/admin/quotes/[id]/
│   └── page.tsx                    # Detail page with quote builder
├── components/features/admin/
│   ├── QuoteBuilder.tsx            # Quote response form
│   ├── PriceInput.tsx              # Per-product pricing
│   └── QuotePreview.tsx            # Preview before sending
├── lib/
│   ├── actions/
│   │   └── quotes.ts               # sendQuoteResponse action
│   └── email/
│       └── templates.tsx           # Quote email template
```

### Technical Requirements

**Quote Response Structure:**
```typescript
interface QuoteResponse {
  id: string
  quote_request_id: string
  products: QuotedProduct[]
  lead_time_days: number
  validity_days: number
  valid_until: string
  total_price?: number
  currency: string
  notes_to_customer?: string
  internal_notes?: string
  created_at: string
  sent_at?: string
  created_by: string
}

interface QuotedProduct {
  product_name: string
  specifications: string
  quantity: number
  unit: string
  unit_price: number
  total_price: number
}
```

**Server Action:**
```typescript
export async function sendQuoteResponse(
  quoteRequestId: string,
  response: Omit<QuoteResponse, 'id' | 'created_at' | 'sent_at'>
): Promise<ActionResult<{ emailSent: boolean }>> {
  // 1. Validate input
  // 2. Save quote response to database
  // 3. Generate email content
  // 4. Send via Resend
  // 5. Update quote_requests status
  // 6. Add timeline entry
  // 7. Return result
}
```

**Email Template:**
```typescript
// src/lib/email/templates.tsx
export function QuoteEmailTemplate({
  customerName,
  products,
  leadTime,
  validUntil,
}: QuoteEmailProps) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Heading>Your Quote from Timber International</Heading>
          <Text>Dear {customerName},</Text>
          <Text>
            Thank you for your inquiry. Please find our quote below:
          </Text>

          <Section>
            <Heading as="h2">Products</Heading>
            {products.map(p => (
              <Row key={p.name}>
                <Column>{p.name}</Column>
                <Column>{p.quantity} {p.unit}</Column>
                <Column>€{p.unitPrice}/{p.unit}</Column>
                <Column>€{p.totalPrice}</Column>
              </Row>
            ))}
          </Section>

          <Text>Lead Time: {leadTime} days</Text>
          <Text>Quote Valid Until: {validUntil}</Text>
          <Text>
            Questions? Reply to this email or call +358 XX XXX XXXX
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

### UI Components

**Quote Builder Form:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  📝 Create Quote Response                                      [X] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Customer: Nordic Furniture AB (Erik Lindqvist)                    │
│                                                                     │
│  Products                                                          │
│  ───────────────────────────────────────────────────────────────   │
│  │ Product              │ Qty   │ Unit Price │ Total      │       │
│  ├──────────────────────┼───────┼────────────┼────────────┤       │
│  │ Oak Panel FJ 22×1200 │ 50 pc │ €[45.00  ] │ €2,250.00  │       │
│  │ Oak Panel FS 27×2400 │ 25 pc │ €[52.00  ] │ €1,300.00  │       │
│  └──────────────────────┴───────┴────────────┴────────────┘       │
│                                           Subtotal: €3,550.00      │
│                                                                     │
│  Lead Time: [6-8 weeks ▼]        Validity: [30 days ▼]            │
│                                                                     │
│  Notes to Customer (included in email):                            │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Delivery to Gothenburg included. Contact us if you need    │  │
│  │ a different delivery location.                              │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ☐ Request Production Review (for custom specs)                    │
│                                                                     │
│  Internal Notes (not sent to customer):                            │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Check with production about FS 27 availability              │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  [Preview Email]                    [Cancel]  [Send Quote →]       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Email Service (Resend)

```typescript
import { Resend } from 'resend'
import { QuoteEmailTemplate } from './templates'

const resend = new Resend(process.env.RESEND_API_KEY)

async function sendQuoteEmail(to: string, subject: string, props: QuoteEmailProps) {
  const { data, error } = await resend.emails.send({
    from: 'quotes@timber-international.com',
    to,
    subject,
    react: QuoteEmailTemplate(props),
  })

  return { success: !error, messageId: data?.id }
}
```

### Dependencies

- **Story 8.2**: Quote detail view
- **Story 4.5**: Quote request data structure
- Resend API key configured

### References

- [Source: prd.md#FR51] - Generate quotes for standard products
- [Source: prd.md#FR52] - Coordinate for custom quotes
- [Source: prd.md#FR53] - Send quote responses
- [Source: architecture.md#Email] - Resend integration

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

