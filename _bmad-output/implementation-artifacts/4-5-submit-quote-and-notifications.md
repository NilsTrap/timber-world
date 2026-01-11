# Story 4.5: Submit Quote and Send Notifications

Status: ready-for-dev

## Story

As a **visitor**,
I want **my quote request to be submitted and confirmed**,
So that **I know Timber International received my request** (FR26).

## Acceptance Criteria

1. **Given** a completed quote form (via form or chatbot), **When** the visitor submits the quote, **Then** the quote is saved to the quote_requests table in Supabase

2. **Given** form submission, **Then** submission completes within 2 seconds (NFR6)

3. **Given** successful submission, **Then** an email confirmation is sent to the visitor via Resend

4. **Given** successful submission, **Then** an internal notification email is sent to the quote handling team

5. **Given** successful submission, **Then** the quote is assigned a unique reference number

6. **Given** successful submission, **Then** the visitor is redirected to the confirmation page

7. **Given** submission failure, **Then** a clear error message is shown with retry option

## Tasks / Subtasks

- [ ] Task 1: Create Quote Submission Server Action (AC: #1, #2, #5)
  - [ ] Create `src/lib/actions/quotes.ts`
  - [ ] Implement submitQuote server action
  - [ ] Generate unique reference number (TI-YYYYMMDD-XXXX format)
  - [ ] Validate form data with Zod schema
  - [ ] Insert into quote_requests table
  - [ ] Return success/error response shape

- [ ] Task 2: Set Up Resend Email Client (AC: #3, #4)
  - [ ] Create `src/lib/email/resend.ts`
  - [ ] Configure Resend client
  - [ ] Add RESEND_API_KEY environment variable
  - [ ] Configure from email address

- [ ] Task 3: Create Email Templates (AC: #3, #4)
  - [ ] Create `src/lib/email/templates/quote-confirmation.tsx`
  - [ ] Create `src/lib/email/templates/quote-notification.tsx`
  - [ ] Include quote reference number
  - [ ] Include submitted details summary
  - [ ] Use React Email for templates

- [ ] Task 4: Implement Customer Confirmation Email (AC: #3)
  - [ ] Send email to customer email address
  - [ ] Include quote reference number
  - [ ] Include response timeline
  - [ ] Include submitted details summary

- [ ] Task 5: Implement Internal Notification Email (AC: #4)
  - [ ] Send email to quotes@timber-international.com
  - [ ] Include full quote details
  - [ ] Include customer contact information
  - [ ] Mark as stock or custom type

- [ ] Task 6: Handle File Attachments (AC: #1)
  - [ ] Upload files to Supabase Storage
  - [ ] Store file URLs in quote record
  - [ ] Include attachment links in internal email

- [ ] Task 7: Integrate with Quote Form (AC: #6, #7)
  - [ ] Connect submitQuote action to form
  - [ ] Handle loading state during submission
  - [ ] Redirect to confirmation page on success
  - [ ] Show error toast on failure with retry option

- [ ] Task 8: Add Translation Keys
  - [ ] Error messages
  - [ ] Email subject lines
  - [ ] Email body content

## Dev Notes

### Quote Submission Server Action

```typescript
// src/lib/actions/quotes.ts
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { quoteRequestSchema, QuoteRequestFormData } from '@/lib/validations/quote'
import { sendQuoteConfirmation, sendQuoteNotification } from '@/lib/email/send'
import { uploadQuoteAttachments } from '@/lib/supabase/storage'
import { revalidatePath } from 'next/cache'

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

interface SubmitQuoteResult {
  referenceNumber: string
  quoteId: string
}

// Generate unique reference number
function generateReferenceNumber(): string {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `TI-${dateStr}-${random}`
}

// Calculate response timeline based on submission time
function calculateResponseTimeline(submittedAt: Date, isCustom: boolean): string {
  if (isCustom) {
    return 'within 24 hours'
  }

  const day = submittedAt.getDay() // 0 = Sunday, 6 = Saturday
  const hour = submittedAt.getHours()

  // Weekend
  if (day === 0 || day === 6) {
    return 'by Monday evening'
  }

  // Friday after 4pm
  if (day === 5 && hour >= 16) {
    return 'by Monday evening'
  }

  // Weekday after 4pm
  if (hour >= 16) {
    return 'by tomorrow evening'
  }

  // Weekday before 4pm
  return 'by this evening'
}

export async function submitQuote(
  formData: QuoteRequestFormData
): Promise<ActionResult<SubmitQuoteResult>> {
  try {
    // Validate form data
    const validatedData = quoteRequestSchema.parse(formData)

    const supabase = await createServerClient()
    const referenceNumber = generateReferenceNumber()
    const submittedAt = new Date()
    const isCustom = validatedData.quoteType === 'custom'

    // Handle file attachments if present
    let attachmentUrls: string[] = []
    if (isCustom && 'attachments' in validatedData && validatedData.attachments?.length) {
      attachmentUrls = await uploadQuoteAttachments(
        referenceNumber,
        validatedData.attachments
      )
    }

    // Prepare quote record
    const quoteRecord = {
      reference_number: referenceNumber,
      type: validatedData.quoteType,
      status: 'pending',
      contact_name: validatedData.contactName,
      contact_email: validatedData.email,
      contact_phone: validatedData.phone,
      company_name: validatedData.companyName,
      delivery_country: validatedData.deliveryCountry,
      delivery_region: validatedData.deliveryRegion || null,
      delivery_address: validatedData.deliveryAddress || null,
      products: validatedData.quoteType === 'stock'
        ? (validatedData as any).products
        : null,
      custom_specs: validatedData.quoteType === 'custom'
        ? (validatedData as any).customSpecs
        : null,
      attachments: attachmentUrls,
      project_description: validatedData.projectDescription || null,
      timeline: validatedData.timeline || null,
      special_requirements: validatedData.specialRequirements || null,
      submitted_at: submittedAt.toISOString(),
    }

    // Insert into database
    const { data: quote, error: dbError } = await supabase
      .from('quote_requests')
      .insert(quoteRecord)
      .select('id')
      .single()

    if (dbError) {
      console.error('[Quote Submission] Database error:', dbError)
      throw new Error('Failed to save quote request')
    }

    // Calculate response timeline
    const responseTimeline = calculateResponseTimeline(submittedAt, isCustom)

    // Send confirmation email to customer
    await sendQuoteConfirmation({
      to: validatedData.email,
      customerName: validatedData.contactName,
      referenceNumber,
      responseTimeline,
      quoteType: validatedData.quoteType,
    })

    // Send notification email to internal team
    await sendQuoteNotification({
      referenceNumber,
      quoteType: validatedData.quoteType,
      customerName: validatedData.contactName,
      companyName: validatedData.companyName,
      email: validatedData.email,
      phone: validatedData.phone,
      deliveryCountry: validatedData.deliveryCountry,
      products: validatedData.quoteType === 'stock'
        ? (validatedData as any).products
        : null,
      customSpecs: validatedData.quoteType === 'custom'
        ? (validatedData as any).customSpecs
        : null,
      attachmentUrls,
      projectDescription: validatedData.projectDescription,
    })

    // Revalidate admin quotes page
    revalidatePath('/admin/quotes')

    return {
      success: true,
      data: {
        referenceNumber,
        quoteId: quote.id,
      },
    }
  } catch (error) {
    console.error('[Quote Submission] Error:', error)

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }

    return { success: false, error: 'An unexpected error occurred' }
  }
}
```

### Resend Email Client

```typescript
// src/lib/email/resend.ts
import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not defined')
}

export const resend = new Resend(process.env.RESEND_API_KEY)

export const EMAIL_FROM = 'Timber International <quotes@timber-international.com>'
export const INTERNAL_EMAIL = 'quotes@timber-international.com'
```

### Email Templates

```tsx
// src/lib/email/templates/quote-confirmation.tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface QuoteConfirmationEmailProps {
  customerName: string
  referenceNumber: string
  responseTimeline: string
  quoteType: 'stock' | 'custom'
}

export function QuoteConfirmationEmail({
  customerName,
  referenceNumber,
  responseTimeline,
  quoteType,
}: QuoteConfirmationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Quote Request Received - {referenceNumber}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Thank You for Your Quote Request</Heading>

          <Text style={text}>Dear {customerName},</Text>

          <Text style={text}>
            We have received your {quoteType === 'custom' ? 'custom production' : 'stock products'} quote request.
          </Text>

          <Section style={referenceBox}>
            <Text style={referenceLabel}>Your Reference Number</Text>
            <Text style={referenceValue}>{referenceNumber}</Text>
          </Section>

          <Text style={text}>
            <strong>We'll respond {responseTimeline}.</strong>
          </Text>

          <Text style={text}>What happens next:</Text>
          <ul style={list}>
            <li>Our team will review your request</li>
            <li>We'll prepare a detailed quote with pricing</li>
            <li>You'll receive an email with your quote</li>
          </ul>

          <Text style={text}>
            If you have any questions, please reply to this email or call us at +358 XXX XXXX.
          </Text>

          <Text style={signature}>
            Best regards,
            <br />
            The Timber International Team
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const main = { backgroundColor: '#FAF6F1', fontFamily: 'Inter, sans-serif' }
const container = { margin: '0 auto', padding: '40px 20px', maxWidth: '600px' }
const h1 = { color: '#1B4332', fontSize: '24px', fontWeight: '700', margin: '0 0 20px' }
const text = { color: '#2D3436', fontSize: '16px', lineHeight: '1.6', margin: '0 0 16px' }
const referenceBox = { backgroundColor: '#1B4332', borderRadius: '8px', padding: '20px', margin: '24px 0' }
const referenceLabel = { color: '#ffffff', fontSize: '14px', margin: '0', opacity: 0.8 }
const referenceValue = { color: '#ffffff', fontSize: '24px', fontWeight: '700', margin: '8px 0 0' }
const list = { color: '#2D3436', fontSize: '16px', lineHeight: '1.8' }
const signature = { color: '#6B7280', fontSize: '14px', marginTop: '32px' }
```

```tsx
// src/lib/email/templates/quote-notification.tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components'

interface QuoteNotificationEmailProps {
  referenceNumber: string
  quoteType: 'stock' | 'custom'
  customerName: string
  companyName: string
  email: string
  phone: string
  deliveryCountry: string
  products?: Array<{ sku: string; quantity: number }> | null
  customSpecs?: Record<string, unknown> | null
  attachmentUrls: string[]
  projectDescription?: string
}

export function QuoteNotificationEmail(props: QuoteNotificationEmailProps) {
  const { referenceNumber, quoteType, customerName, companyName, email, phone } = props

  return (
    <Html>
      <Head />
      <Preview>New Quote Request - {referenceNumber}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={badge}>{quoteType.toUpperCase()}</Text>
            <Heading style={h1}>{referenceNumber}</Heading>
          </Section>

          <Hr />

          <Section>
            <Heading style={h2}>Customer Details</Heading>
            <Text style={field}>
              <strong>Name:</strong> {customerName}
            </Text>
            <Text style={field}>
              <strong>Company:</strong> {companyName}
            </Text>
            <Text style={field}>
              <strong>Email:</strong> {email}
            </Text>
            <Text style={field}>
              <strong>Phone:</strong> {phone}
            </Text>
            <Text style={field}>
              <strong>Delivery:</strong> {props.deliveryCountry}
            </Text>
          </Section>

          <Hr />

          <Section>
            <Heading style={h2}>Request Details</Heading>
            {quoteType === 'stock' && props.products && (
              <div>
                {props.products.map((p, i) => (
                  <Text key={i} style={field}>
                    • {p.sku} - Qty: {p.quantity}
                  </Text>
                ))}
              </div>
            )}
            {quoteType === 'custom' && props.customSpecs && (
              <Text style={field}>
                <pre>{JSON.stringify(props.customSpecs, null, 2)}</pre>
              </Text>
            )}
          </Section>

          {props.attachmentUrls.length > 0 && (
            <>
              <Hr />
              <Section>
                <Heading style={h2}>Attachments</Heading>
                {props.attachmentUrls.map((url, i) => (
                  <Text key={i} style={field}>
                    <a href={url}>Attachment {i + 1}</a>
                  </Text>
                ))}
              </Section>
            </>
          )}

          {props.projectDescription && (
            <>
              <Hr />
              <Section>
                <Heading style={h2}>Project Description</Heading>
                <Text style={field}>{props.projectDescription}</Text>
              </Section>
            </>
          )}
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: '#f4f4f4', fontFamily: 'Inter, sans-serif' }
const container = { margin: '0 auto', padding: '20px', maxWidth: '600px', backgroundColor: '#ffffff' }
const header = { textAlign: 'center' as const }
const badge = { backgroundColor: '#1B4332', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '12px' }
const h1 = { fontSize: '24px', margin: '16px 0' }
const h2 = { fontSize: '16px', fontWeight: '600', margin: '16px 0 8px' }
const field = { fontSize: '14px', margin: '4px 0' }
```

### Send Email Functions

```typescript
// src/lib/email/send.ts
import { resend, EMAIL_FROM, INTERNAL_EMAIL } from './resend'
import { QuoteConfirmationEmail } from './templates/quote-confirmation'
import { QuoteNotificationEmail } from './templates/quote-notification'

interface ConfirmationEmailData {
  to: string
  customerName: string
  referenceNumber: string
  responseTimeline: string
  quoteType: 'stock' | 'custom'
}

export async function sendQuoteConfirmation(data: ConfirmationEmailData) {
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: data.to,
      subject: `Quote Request Received - ${data.referenceNumber}`,
      react: QuoteConfirmationEmail(data),
    })
  } catch (error) {
    console.error('[Email] Failed to send confirmation:', error)
    // Don't throw - email failure shouldn't block quote submission
  }
}

export async function sendQuoteNotification(data: Parameters<typeof QuoteNotificationEmail>[0]) {
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: INTERNAL_EMAIL,
      subject: `New Quote: ${data.referenceNumber} (${data.quoteType.toUpperCase()})`,
      react: QuoteNotificationEmail(data),
    })
  } catch (error) {
    console.error('[Email] Failed to send notification:', error)
    // Don't throw - email failure shouldn't block quote submission
  }
}
```

### Form Integration

```tsx
// Update QuoteForm.tsx
import { submitQuote } from '@/lib/actions/quotes'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const router = useRouter()

const handleFormSubmit = async (data: QuoteRequestFormData) => {
  const result = await submitQuote(data)

  if (result.success) {
    sessionStorage.removeItem(FORM_STORAGE_KEY)
    router.push(`/quote/confirmation?ref=${result.data.referenceNumber}`)
  } else {
    toast.error(result.error, {
      action: {
        label: t('retry'),
        onClick: () => handleFormSubmit(data),
      },
    })
  }
}
```

### Dependencies

```bash
npm install resend @react-email/components
```

### Environment Variables

```env
RESEND_API_KEY=re_xxxxxxxxxxxx
```

### Database Schema Note

Ensure quote_requests table has these columns:
- reference_number (varchar, unique)
- attachments (jsonb, array of URLs)
- submitted_at (timestamp)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-4-Story-4.5]
- [Source: _bmad-output/planning-artifacts/architecture.md#Email-Integration]
- [Source: _bmad-output/planning-artifacts/prd.md#FR26]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Confirmation]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
