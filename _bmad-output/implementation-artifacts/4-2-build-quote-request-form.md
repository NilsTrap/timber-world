# Story 4.2: Build Quote Request Form

Status: ready-for-dev

## Story

As a **visitor**,
I want **to submit a quote request via a structured form**,
So that **I can provide my requirements in a clear format** (FR17).

## Acceptance Criteria

1. **Given** the form tab is active on the quote page, **When** the form renders, **Then** required fields include: contact name, email, phone, company name

2. **Given** the form is displayed, **Then** product specification fields include: selected products (from catalog or manual entry), quantities

3. **Given** the form is displayed, **Then** delivery location field with country/region selection is available (FR21)

4. **Given** the form is displayed, **Then** optional fields include: project description, timeline, special requirements

5. **Given** form input, **Then** form validation uses Zod schemas with inline error messages

6. **Given** all form fields, **Then** all fields have proper labels and accessibility attributes

7. **Given** user switches tabs, **Then** form state persists if user switches tabs (not lost)

## Tasks / Subtasks

- [ ] Task 1: Create Quote Form Schema (AC: #1, #2, #3, #4, #5)
  - [ ] Create `src/lib/validations/quote.ts`
  - [ ] Define Zod schema for quote request form
  - [ ] Include all required fields validation
  - [ ] Include optional fields
  - [ ] Add phone number validation pattern
  - [ ] Add email validation

- [ ] Task 2: Create Contact Information Section (AC: #1, #6)
  - [ ] Create `src/components/features/quote/QuoteContactFields.tsx`
  - [ ] Add contact name input (required)
  - [ ] Add email input (required)
  - [ ] Add phone input (required)
  - [ ] Add company name input (required)
  - [ ] Add proper labels and error messages

- [ ] Task 3: Create Product Specification Section (AC: #2)
  - [ ] Create `src/components/features/quote/QuoteProductFields.tsx`
  - [ ] Display selected products from URL params
  - [ ] Add quantity input for each product
  - [ ] Add "Add another product" option for manual entry
  - [ ] Create product search/select component

- [ ] Task 4: Create Delivery Location Section (AC: #3)
  - [ ] Create `src/components/features/quote/QuoteDeliveryFields.tsx`
  - [ ] Add country selector (dropdown)
  - [ ] Add region/city input
  - [ ] Add delivery address textarea
  - [ ] Include EU countries served by Timber International

- [ ] Task 5: Create Optional Details Section (AC: #4)
  - [ ] Create `src/components/features/quote/QuoteOptionalFields.tsx`
  - [ ] Add project description textarea
  - [ ] Add timeline/urgency selector
  - [ ] Add special requirements textarea

- [ ] Task 6: Build QuoteForm Component (AC: #5, #6, #7)
  - [ ] Create `src/components/features/quote/QuoteForm.tsx`
  - [ ] Integrate React Hook Form with Zod resolver
  - [ ] Compose all field sections
  - [ ] Add form submission handler (placeholder for Story 4.5)
  - [ ] Persist form state to sessionStorage
  - [ ] Add loading state for submit button

- [ ] Task 7: Add Translation Keys
  - [ ] Add form field labels to translations
  - [ ] Add error messages to translations
  - [ ] Add placeholder text to translations

## Dev Notes

### Quote Form Schema

```typescript
// src/lib/validations/quote.ts
import { z } from 'zod'

export const quoteProductSchema = z.object({
  productId: z.string().optional(),
  sku: z.string().optional(),
  description: z.string().min(1, 'Product description is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unit: z.enum(['m2', 'm3', 'pieces']).default('pieces'),
})

export const quoteRequestSchema = z.object({
  // Contact Information (required)
  contactName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(6, 'Please enter a valid phone number'),
  companyName: z.string().min(2, 'Company name is required'),

  // Product Specifications
  products: z.array(quoteProductSchema).min(1, 'At least one product is required'),

  // Delivery Location (required)
  deliveryCountry: z.string().min(1, 'Please select a country'),
  deliveryRegion: z.string().optional(),
  deliveryAddress: z.string().optional(),

  // Optional Details
  projectDescription: z.string().optional(),
  timeline: z.enum(['urgent', 'standard', 'flexible']).optional(),
  specialRequirements: z.string().optional(),
})

export type QuoteRequestFormData = z.infer<typeof quoteRequestSchema>
export type QuoteProduct = z.infer<typeof quoteProductSchema>
```

### QuoteForm Component

```tsx
// src/components/features/quote/QuoteForm.tsx
'use client'

import { useEffect } from 'react'
import { useForm, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { quoteRequestSchema, QuoteRequestFormData } from '@/lib/validations/quote'
import { QuoteContactFields } from './QuoteContactFields'
import { QuoteProductFields } from './QuoteProductFields'
import { QuoteDeliveryFields } from './QuoteDeliveryFields'
import { QuoteOptionalFields } from './QuoteOptionalFields'

interface QuoteFormProps {
  selectedProductIds?: string[]
  onSubmit?: (data: QuoteRequestFormData) => Promise<void>
}

const FORM_STORAGE_KEY = 'timber-quote-form-draft'

export function QuoteForm({ selectedProductIds = [], onSubmit }: QuoteFormProps) {
  const t = useTranslations('quote.form')

  const methods = useForm<QuoteRequestFormData>({
    resolver: zodResolver(quoteRequestSchema),
    defaultValues: {
      contactName: '',
      email: '',
      phone: '',
      companyName: '',
      products: selectedProductIds.map(id => ({
        productId: id,
        description: '',
        quantity: 1,
        unit: 'pieces' as const,
      })),
      deliveryCountry: '',
      deliveryRegion: '',
      deliveryAddress: '',
      projectDescription: '',
      timeline: undefined,
      specialRequirements: '',
    },
  })

  const { handleSubmit, watch, formState: { isSubmitting } } = methods

  // Persist form state to sessionStorage
  useEffect(() => {
    const subscription = watch((value) => {
      sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(value))
    })
    return () => subscription.unsubscribe()
  }, [watch])

  // Restore form state on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(FORM_STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        methods.reset(parsed)
      } catch (e) {
        console.error('Failed to restore form state:', e)
      }
    }
  }, [methods])

  const handleFormSubmit = async (data: QuoteRequestFormData) => {
    if (onSubmit) {
      await onSubmit(data)
      sessionStorage.removeItem(FORM_STORAGE_KEY)
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('contact_title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <QuoteContactFields />
          </CardContent>
        </Card>

        {/* Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('products_title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <QuoteProductFields selectedProductIds={selectedProductIds} />
          </CardContent>
        </Card>

        {/* Delivery */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('delivery_title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <QuoteDeliveryFields />
          </CardContent>
        </Card>

        {/* Optional Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('optional_title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <QuoteOptionalFields />
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button
          type="submit"
          size="lg"
          className="w-full bg-forest-500 hover:bg-forest-600"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('submitting')}
            </>
          ) : (
            t('submit')
          )}
        </Button>
      </form>
    </FormProvider>
  )
}
```

### QuoteContactFields Component

```tsx
// src/components/features/quote/QuoteContactFields.tsx
'use client'

import { useFormContext } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTranslations } from 'next-intl'
import { QuoteRequestFormData } from '@/lib/validations/quote'

export function QuoteContactFields() {
  const t = useTranslations('quote.form')
  const { register, formState: { errors } } = useFormContext<QuoteRequestFormData>()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Contact Name */}
      <div className="space-y-2">
        <Label htmlFor="contactName">
          {t('contact_name')} <span className="text-red-500">*</span>
        </Label>
        <Input
          id="contactName"
          {...register('contactName')}
          placeholder={t('contact_name_placeholder')}
          aria-invalid={!!errors.contactName}
          aria-describedby={errors.contactName ? 'contactName-error' : undefined}
        />
        {errors.contactName && (
          <p id="contactName-error" className="text-sm text-red-500">
            {errors.contactName.message}
          </p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">
          {t('email')} <span className="text-red-500">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          placeholder={t('email_placeholder')}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-red-500">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="phone">
          {t('phone')} <span className="text-red-500">*</span>
        </Label>
        <Input
          id="phone"
          type="tel"
          {...register('phone')}
          placeholder={t('phone_placeholder')}
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? 'phone-error' : undefined}
        />
        {errors.phone && (
          <p id="phone-error" className="text-sm text-red-500">
            {errors.phone.message}
          </p>
        )}
      </div>

      {/* Company Name */}
      <div className="space-y-2">
        <Label htmlFor="companyName">
          {t('company_name')} <span className="text-red-500">*</span>
        </Label>
        <Input
          id="companyName"
          {...register('companyName')}
          placeholder={t('company_name_placeholder')}
          aria-invalid={!!errors.companyName}
          aria-describedby={errors.companyName ? 'companyName-error' : undefined}
        />
        {errors.companyName && (
          <p id="companyName-error" className="text-sm text-red-500">
            {errors.companyName.message}
          </p>
        )}
      </div>
    </div>
  )
}
```

### QuoteDeliveryFields Component

```tsx
// src/components/features/quote/QuoteDeliveryFields.tsx
'use client'

import { useFormContext } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useTranslations } from 'next-intl'
import { QuoteRequestFormData } from '@/lib/validations/quote'

const SERVED_COUNTRIES = [
  { code: 'FI', name: 'Finland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'DE', name: 'Germany' },
  { code: 'ES', name: 'Spain' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'FR', name: 'France' },
  { code: 'BE', name: 'Belgium' },
  { code: 'AT', name: 'Austria' },
  { code: 'PL', name: 'Poland' },
  { code: 'EE', name: 'Estonia' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LT', name: 'Lithuania' },
]

export function QuoteDeliveryFields() {
  const t = useTranslations('quote.form')
  const { register, setValue, watch, formState: { errors } } = useFormContext<QuoteRequestFormData>()
  const deliveryCountry = watch('deliveryCountry')

  return (
    <div className="space-y-4">
      {/* Country */}
      <div className="space-y-2">
        <Label htmlFor="deliveryCountry">
          {t('delivery_country')} <span className="text-red-500">*</span>
        </Label>
        <Select
          value={deliveryCountry}
          onValueChange={(value) => setValue('deliveryCountry', value)}
        >
          <SelectTrigger
            id="deliveryCountry"
            aria-invalid={!!errors.deliveryCountry}
          >
            <SelectValue placeholder={t('select_country')} />
          </SelectTrigger>
          <SelectContent>
            {SERVED_COUNTRIES.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                {country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.deliveryCountry && (
          <p className="text-sm text-red-500">{errors.deliveryCountry.message}</p>
        )}
      </div>

      {/* Region/City */}
      <div className="space-y-2">
        <Label htmlFor="deliveryRegion">{t('delivery_region')}</Label>
        <Input
          id="deliveryRegion"
          {...register('deliveryRegion')}
          placeholder={t('delivery_region_placeholder')}
        />
      </div>

      {/* Full Address (optional) */}
      <div className="space-y-2">
        <Label htmlFor="deliveryAddress">{t('delivery_address')}</Label>
        <Textarea
          id="deliveryAddress"
          {...register('deliveryAddress')}
          placeholder={t('delivery_address_placeholder')}
          rows={3}
        />
        <p className="text-sm text-stone-500">{t('delivery_address_hint')}</p>
      </div>
    </div>
  )
}
```

### Translation Keys

```json
// src/messages/en.json - quote.form section
{
  "quote": {
    "form": {
      "contact_title": "Contact Information",
      "contact_name": "Your Name",
      "contact_name_placeholder": "John Smith",
      "email": "Email Address",
      "email_placeholder": "john@company.com",
      "phone": "Phone Number",
      "phone_placeholder": "+358 40 123 4567",
      "company_name": "Company Name",
      "company_name_placeholder": "Your Company Ltd",

      "products_title": "Products",
      "add_product": "Add another product",
      "product_description": "Product Description",
      "quantity": "Quantity",
      "unit": "Unit",

      "delivery_title": "Delivery Location",
      "delivery_country": "Country",
      "select_country": "Select a country",
      "delivery_region": "City / Region",
      "delivery_region_placeholder": "e.g., Helsinki",
      "delivery_address": "Full Delivery Address",
      "delivery_address_placeholder": "Street address (optional)",
      "delivery_address_hint": "Provide full address for accurate shipping estimates",

      "optional_title": "Additional Details (Optional)",
      "project_description": "Project Description",
      "project_description_placeholder": "Tell us about your project...",
      "timeline": "Timeline",
      "timeline_urgent": "Urgent (ASAP)",
      "timeline_standard": "Standard (2-4 weeks)",
      "timeline_flexible": "Flexible",
      "special_requirements": "Special Requirements",
      "special_requirements_placeholder": "Any specific requirements or questions...",

      "submit": "Submit Quote Request",
      "submitting": "Submitting..."
    }
  }
}
```

### Project Structure Notes

Files to create:
- `src/lib/validations/quote.ts` - Zod schema
- `src/components/features/quote/QuoteForm.tsx` - Main form component
- `src/components/features/quote/QuoteContactFields.tsx` - Contact section
- `src/components/features/quote/QuoteProductFields.tsx` - Products section
- `src/components/features/quote/QuoteDeliveryFields.tsx` - Delivery section
- `src/components/features/quote/QuoteOptionalFields.tsx` - Optional section

### Architecture Compliance

| Pattern | Compliance |
|---------|------------|
| React Hook Form | Used with zodResolver for validation |
| Zod schemas | All form validation via Zod |
| Server Actions return shape | onSubmit will use { success, data/error } |
| sessionStorage | Form state persisted for tab switching |
| i18n | All labels/messages use translations |

### Accessibility Notes

- All inputs have associated labels
- Required fields marked with asterisk
- aria-invalid set on error state
- aria-describedby links to error messages
- Focus management on validation errors

### Dependencies on Other Stories

- Story 4.1: QuotePageContainer to render this form
- Story 4.5: Form submission and notification logic

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-4-Story-4.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Forms]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Form-Patterns]
- [Source: _bmad-output/project-context.md#React-Hook-Form-Rules]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
