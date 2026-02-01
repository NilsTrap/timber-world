# Story 4.6: Display Quote Confirmation with Response Timeline

Status: ready-for-dev

## Story

As a **visitor**,
I want **to see confirmation with a specific response timeline**,
So that **I know when to expect a reply**.

## Acceptance Criteria

1. **Given** a quote has been successfully submitted, **When** the confirmation page displays, **Then** a success message confirms receipt with quote reference number

2. **Given** the confirmation page, **Then** response timeline is calculated dynamically:
   - Standard quote, weekday before 4pm: "We'll respond by this evening"
   - Weekday after 4pm: "We'll respond by tomorrow evening"
   - Friday after 4pm / weekend: "We'll respond by Monday evening"
   - Custom/complex quote: "We'll respond within 24 hours"

3. **Given** the confirmation page, **Then** "What happens next" section explains the process

4. **Given** the confirmation page, **Then** links to return to homepage or browse products are provided

5. **Given** the confirmation, **Then** the confirmation is translatable (i18n keys)

## Tasks / Subtasks

- [ ] Task 1: Create Confirmation Page Route (AC: #1, #4)
  - [ ] Create `src/app/[locale]/quote/confirmation/page.tsx`
  - [ ] Read reference number from URL params
  - [ ] Display confirmation content
  - [ ] Add navigation links

- [ ] Task 2: Create QuoteConfirmation Component (AC: #1, #2, #3)
  - [ ] Create `src/components/features/quote/QuoteConfirmation.tsx`
  - [ ] Display success icon and message
  - [ ] Show reference number prominently
  - [ ] Calculate and display response timeline
  - [ ] Add "What happens next" section

- [ ] Task 3: Implement Timeline Calculation (AC: #2)
  - [ ] Create `src/lib/utils/response-timeline.ts`
  - [ ] Implement dynamic calculation logic
  - [ ] Handle weekdays, weekends, Friday afternoon
  - [ ] Handle custom quote type

- [ ] Task 4: Add Navigation Links (AC: #4)
  - [ ] Add "Return to Homepage" button
  - [ ] Add "Browse Products" button
  - [ ] Style as secondary actions

- [ ] Task 5: Add SEO Meta Tags
  - [ ] noindex for confirmation page
  - [ ] Appropriate title

- [ ] Task 6: Add Translation Keys (AC: #5)
  - [ ] Success message
  - [ ] Timeline variations
  - [ ] What happens next steps
  - [ ] Button labels

## Dev Notes

### Confirmation Page Route

```tsx
// src/app/[locale]/quote/confirmation/page.tsx
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { QuoteConfirmation } from '@/components/features/quote/QuoteConfirmation'

interface ConfirmationPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ ref?: string; type?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Quote Request Confirmed | Timber International',
    robots: 'noindex, nofollow', // Don't index confirmation pages
  }
}

export default async function ConfirmationPage({
  params,
  searchParams,
}: ConfirmationPageProps) {
  const { locale } = await params
  const { ref, type } = await searchParams

  // Redirect if no reference number
  if (!ref) {
    redirect(`/${locale}/quote`)
  }

  const quoteType = type === 'custom' ? 'custom' : 'stock'
  const submittedAt = new Date() // In real implementation, fetch from DB or pass as param

  return (
    <main className="min-h-screen bg-warm-cream">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-[600px] mx-auto">
          <QuoteConfirmation
            referenceNumber={ref}
            quoteType={quoteType}
            submittedAt={submittedAt}
          />
        </div>
      </div>
    </main>
  )
}
```

### QuoteConfirmation Component

```tsx
// src/components/features/quote/QuoteConfirmation.tsx
'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { CheckCircle, Home, Package } from 'lucide-react'
import { calculateResponseTimeline } from '@/lib/utils/response-timeline'

interface QuoteConfirmationProps {
  referenceNumber: string
  quoteType: 'stock' | 'custom'
  submittedAt: Date
}

export function QuoteConfirmation({
  referenceNumber,
  quoteType,
  submittedAt,
}: QuoteConfirmationProps) {
  const t = useTranslations('quote.confirmation')

  const timeline = calculateResponseTimeline(submittedAt, quoteType === 'custom')
  const timelineMessage = t(`timeline.${timeline.key}`, timeline.params)

  return (
    <div className="text-center">
      {/* Success Icon */}
      <div className="mb-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
      </div>

      {/* Success Message */}
      <h1 className="text-3xl font-bold font-playfair text-charcoal mb-4">
        {t('title')}
      </h1>

      <p className="text-lg text-stone-600 mb-8">
        {t('subtitle')}
      </p>

      {/* Reference Number Card */}
      <Card className="mb-8 bg-forest-500 text-white">
        <CardContent className="py-6">
          <p className="text-sm opacity-80 mb-2">{t('reference_label')}</p>
          <p className="text-2xl font-bold tracking-wide">{referenceNumber}</p>
        </CardContent>
      </Card>

      {/* Response Timeline */}
      <div className="mb-8 p-6 bg-white rounded-lg border">
        <p className="text-lg font-medium text-charcoal mb-2">
          {t('when_response')}
        </p>
        <p className="text-xl font-bold text-forest-600">
          {timelineMessage}
        </p>
      </div>

      {/* What Happens Next */}
      <div className="mb-8 text-left">
        <h2 className="text-lg font-semibold text-charcoal mb-4">
          {t('next_steps_title')}
        </h2>
        <ol className="space-y-3">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-forest-100 text-forest-600 flex items-center justify-center text-sm font-medium">
              1
            </span>
            <span className="text-stone-600">{t('next_step_1')}</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-forest-100 text-forest-600 flex items-center justify-center text-sm font-medium">
              2
            </span>
            <span className="text-stone-600">{t('next_step_2')}</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-forest-100 text-forest-600 flex items-center justify-center text-sm font-medium">
              3
            </span>
            <span className="text-stone-600">{t('next_step_3')}</span>
          </li>
        </ol>
      </div>

      {/* Email Confirmation Note */}
      <p className="text-sm text-stone-500 mb-8">
        {t('email_sent')}
      </p>

      {/* Navigation Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button asChild variant="outline" size="lg">
          <Link href="/">
            <Home className="w-4 h-4 mr-2" />
            {t('return_home')}
          </Link>
        </Button>
        <Button asChild size="lg" className="bg-forest-500 hover:bg-forest-600">
          <Link href="/products">
            <Package className="w-4 h-4 mr-2" />
            {t('browse_products')}
          </Link>
        </Button>
      </div>
    </div>
  )
}
```

### Response Timeline Calculation

```typescript
// src/lib/utils/response-timeline.ts

interface TimelineResult {
  key: string
  params?: Record<string, string>
}

export function calculateResponseTimeline(
  submittedAt: Date,
  isCustom: boolean
): TimelineResult {
  // Custom quotes always get 24-hour timeline
  if (isCustom) {
    return { key: 'custom' }
  }

  const day = submittedAt.getDay() // 0 = Sunday, 6 = Saturday
  const hour = submittedAt.getHours()

  // Weekend (Saturday or Sunday)
  if (day === 0 || day === 6) {
    return { key: 'weekend' }
  }

  // Friday after 4pm
  if (day === 5 && hour >= 16) {
    return { key: 'friday_evening' }
  }

  // Any weekday after 4pm
  if (hour >= 16) {
    return { key: 'tomorrow' }
  }

  // Weekday before 4pm
  return { key: 'today' }
}

// For displaying specific times based on business logic
export function getExpectedResponseTime(submittedAt: Date, isCustom: boolean): string {
  if (isCustom) {
    return 'within 24 hours'
  }

  const day = submittedAt.getDay()
  const hour = submittedAt.getHours()

  if (day === 0 || day === 6 || (day === 5 && hour >= 16)) {
    return 'by Monday evening'
  }

  if (hour >= 16) {
    return 'by tomorrow evening'
  }

  return 'by this evening'
}
```

### Translation Keys

```json
{
  "quote": {
    "confirmation": {
      "title": "Quote Request Received!",
      "subtitle": "Thank you for your interest in Timber International.",
      "reference_label": "Your Reference Number",
      "when_response": "When will you hear from us?",

      "timeline": {
        "today": "We'll respond by this evening",
        "tomorrow": "We'll respond by tomorrow evening",
        "friday_evening": "We'll respond by Monday evening",
        "weekend": "We'll respond by Monday evening",
        "custom": "We'll respond within 24 hours"
      },

      "next_steps_title": "What happens next?",
      "next_step_1": "Our team reviews your request and prepares pricing",
      "next_step_2": "We send you a detailed quote via email",
      "next_step_3": "You review and we discuss any questions",

      "email_sent": "A confirmation email has been sent to your inbox.",

      "return_home": "Return to Homepage",
      "browse_products": "Browse Products"
    }
  }
}
```

### Accessibility Notes

- Success icon has descriptive role
- Clear heading hierarchy
- Reference number uses monospace for readability
- Buttons are keyboard accessible
- Color contrast meets AA standards

### Design System Tokens

| Element | Token/Class |
|---------|-------------|
| Success icon | bg-green-100 text-green-600 |
| Reference card | bg-forest-500 text-white |
| Timeline | text-forest-600 font-bold |
| Step numbers | bg-forest-100 text-forest-600 |
| Page background | bg-warm-cream |

### Testing Considerations

- Test all timeline scenarios (weekday/weekend/evening)
- Test with missing reference number (should redirect)
- Test translation keys in all locales
- Test mobile responsiveness
- Test button navigation

### Project Structure Notes

Files to create:
- `src/app/[locale]/quote/confirmation/page.tsx`
- `src/components/features/quote/QuoteConfirmation.tsx`
- `src/lib/utils/response-timeline.ts`

### References

- [Source: _bmad-output/planning-artifacts/marketing-website/epics.md#Epic-4-Story-4.6]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#QuoteConfirmation]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Dynamic-Response-Commitments]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
