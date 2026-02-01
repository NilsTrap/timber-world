# Story 5.3: Create Contact Page

Status: ready-for-dev

## Story

As a **visitor**,
I want **to find contact information and see regions served**,
So that **I can reach Timber International or verify they serve my area** (FR30, FR31).

## Acceptance Criteria

1. **Given** a visitor navigates to /[locale]/contact, **When** the page loads, **Then** company contact details are displayed: address, phone, email (FR30)

2. **Given** the contact page, **Then** a map or visual shows regions/countries served (FR31)

3. **Given** the contact page, **Then** a list of served countries is provided (Nordic, European markets)

4. **Given** the contact page, **Then** a simple contact form is available for general inquiries

5. **Given** the contact page, **Then** the "Request Quote" CTA is prominently displayed

6. **Given** the contact page, **Then** business hours or response expectations are shown

7. **Given** all content, **Then** all content is translatable via i18n keys

## Tasks / Subtasks

- [ ] Task 1: Create Contact Page Route (AC: #1, #7)
  - [ ] Create `src/app/[locale]/contact/page.tsx`
  - [ ] Set up page layout with solid header
  - [ ] Add page header with title

- [ ] Task 2: Create Contact Info Section (AC: #1, #6)
  - [ ] Create `src/components/features/contact/ContactInfo.tsx`
  - [ ] Display company address
  - [ ] Display phone number
  - [ ] Display email address
  - [ ] Add business hours

- [ ] Task 3: Create Regions Served Section (AC: #2, #3)
  - [ ] Create `src/components/features/contact/RegionsServed.tsx`
  - [ ] List all served countries
  - [ ] Add simple map visual or country grid
  - [ ] Group by region (Nordic, Western Europe, etc.)

- [ ] Task 4: Create Contact Form (AC: #4)
  - [ ] Create `src/components/features/contact/ContactForm.tsx`
  - [ ] Add name, email, subject, message fields
  - [ ] Add form validation with Zod
  - [ ] Create submit action
  - [ ] Send notification email

- [ ] Task 5: Add Quote CTA (AC: #5)
  - [ ] Add prominent quote request section
  - [ ] Link to /quote page
  - [ ] Style as highlighted action

- [ ] Task 6: Add SEO Meta Tags
  - [ ] Set title and description
  - [ ] Add hreflang for all locales
  - [ ] Add structured data (ContactPoint schema)

- [ ] Task 7: Add Translation Keys (AC: #7)
  - [ ] Contact information labels
  - [ ] Form field labels
  - [ ] Countries and regions
  - [ ] Meta tags

## Dev Notes

### Contact Page Route

```tsx
// src/app/[locale]/contact/page.tsx
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ContactInfo } from '@/components/features/contact/ContactInfo'
import { RegionsServed } from '@/components/features/contact/RegionsServed'
import { ContactForm } from '@/components/features/contact/ContactForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowRight, MessageSquare } from 'lucide-react'

interface ContactPageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: ContactPageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'contact' })

  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: {
      languages: {
        en: '/en/contact',
        fi: '/fi/contact',
        sv: '/sv/contact',
        no: '/no/contact',
        da: '/da/contact',
        nl: '/nl/contact',
        de: '/de/contact',
        es: '/es/contact',
      },
    },
  }
}

export default async function ContactPage({ params }: ContactPageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'contact' })

  return (
    <main className="min-h-screen bg-warm-cream">
      {/* Hero Section */}
      <section className="bg-forest-500 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold font-playfair mb-4">
              {t('title')}
            </h1>
            <p className="text-xl opacity-90">
              {t('subtitle')}
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Left Column: Contact Info & Regions */}
          <div className="space-y-12">
            <ContactInfo />
            <RegionsServed />
          </div>

          {/* Right Column: Form & CTA */}
          <div className="space-y-8">
            {/* Quote CTA Card */}
            <Card className="bg-forest-500 text-white border-0">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white/20 rounded-lg">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">
                      {t('quote_cta.title')}
                    </h3>
                    <p className="opacity-90 mb-4">
                      {t('quote_cta.description')}
                    </p>
                    <Button asChild className="bg-white text-forest-600 hover:bg-cream-50">
                      <Link href={`/${locale}/quote`}>
                        {t('quote_cta.button')}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Form */}
            <Card>
              <CardContent className="p-8">
                <h2 className="text-2xl font-semibold font-playfair mb-6">
                  {t('form.title')}
                </h2>
                <ContactForm />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
```

### ContactInfo Component

```tsx
// src/components/features/contact/ContactInfo.tsx
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MapPin, Phone, Mail, Clock } from 'lucide-react'

export function ContactInfo() {
  const t = useTranslations('contact.info')

  const contactDetails = [
    {
      icon: MapPin,
      label: t('address_label'),
      value: t('address'),
      href: null,
    },
    {
      icon: Phone,
      label: t('phone_label'),
      value: t('phone'),
      href: `tel:${t('phone').replace(/\s/g, '')}`,
    },
    {
      icon: Mail,
      label: t('email_label'),
      value: t('email'),
      href: `mailto:${t('email')}`,
    },
    {
      icon: Clock,
      label: t('hours_label'),
      value: t('hours'),
      href: null,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-playfair">
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {contactDetails.map((detail) => (
          <div key={detail.label} className="flex items-start gap-4">
            <div className="p-2 bg-forest-50 rounded-lg text-forest-600">
              <detail.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-stone-500">{detail.label}</p>
              {detail.href ? (
                <a
                  href={detail.href}
                  className="font-medium text-charcoal hover:text-forest-600 transition-colors"
                >
                  {detail.value}
                </a>
              ) : (
                <p className="font-medium text-charcoal whitespace-pre-line">
                  {detail.value}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Response time note */}
        <div className="pt-4 border-t">
          <p className="text-sm text-stone-500">
            {t('response_note')}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
```

### RegionsServed Component

```tsx
// src/components/features/contact/RegionsServed.tsx
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Check } from 'lucide-react'

const REGIONS = {
  nordic: ['Finland', 'Sweden', 'Norway', 'Denmark'],
  western: ['Netherlands', 'Belgium', 'Germany', 'France'],
  southern: ['Spain', 'Portugal', 'Italy'],
  other: ['United Kingdom', 'Ireland', 'Austria', 'Poland', 'Estonia', 'Latvia', 'Lithuania'],
}

export function RegionsServed() {
  const t = useTranslations('contact.regions')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-playfair">
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-stone-600 mb-6">{t('description')}</p>

        <div className="space-y-6">
          {Object.entries(REGIONS).map(([region, countries]) => (
            <div key={region}>
              <h4 className="font-medium text-charcoal mb-3">
                {t(`region_${region}`)}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {countries.map((country) => (
                  <div key={country} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-forest-500" />
                    <span className="text-sm text-stone-600">{country}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-cream-50 rounded-lg">
          <p className="text-sm text-stone-600">
            {t('other_regions_note')}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
```

### ContactForm Component

```tsx
// src/components/features/contact/ContactForm.tsx
'use client'

import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { submitContactForm } from '@/lib/actions/contact'

const contactSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Please enter a valid email'),
  subject: z.string().min(1, 'Please select a subject'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
})

type ContactFormData = z.infer<typeof contactSchema>

export function ContactForm() {
  const t = useTranslations('contact.form')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  })

  const subject = watch('subject')

  const onSubmit = async (data: ContactFormData) => {
    const result = await submitContactForm(data)

    if (result.success) {
      toast.success(t('success_message'))
      reset()
    } else {
      toast.error(result.error)
    }
  }

  const subjects = [
    { value: 'general', label: t('subject_general') },
    { value: 'products', label: t('subject_products') },
    { value: 'delivery', label: t('subject_delivery') },
    { value: 'partnership', label: t('subject_partnership') },
    { value: 'other', label: t('subject_other') },
  ]

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">{t('name_label')}</Label>
        <Input
          id="name"
          {...register('name')}
          placeholder={t('name_placeholder')}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">{t('email_label')}</Label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          placeholder={t('email_placeholder')}
          aria-invalid={!!errors.email}
        />
        {errors.email && (
          <p className="text-sm text-red-500">{errors.email.message}</p>
        )}
      </div>

      {/* Subject */}
      <div className="space-y-2">
        <Label htmlFor="subject">{t('subject_label')}</Label>
        <Select value={subject} onValueChange={(v) => setValue('subject', v)}>
          <SelectTrigger id="subject" aria-invalid={!!errors.subject}>
            <SelectValue placeholder={t('subject_placeholder')} />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.subject && (
          <p className="text-sm text-red-500">{errors.subject.message}</p>
        )}
      </div>

      {/* Message */}
      <div className="space-y-2">
        <Label htmlFor="message">{t('message_label')}</Label>
        <Textarea
          id="message"
          {...register('message')}
          placeholder={t('message_placeholder')}
          rows={5}
          aria-invalid={!!errors.message}
        />
        {errors.message && (
          <p className="text-sm text-red-500">{errors.message.message}</p>
        )}
      </div>

      {/* Submit */}
      <Button
        type="submit"
        className="w-full bg-forest-500 hover:bg-forest-600"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('sending')}
          </>
        ) : (
          t('submit')
        )}
      </Button>
    </form>
  )
}
```

### Contact Form Action

```typescript
// src/lib/actions/contact.ts
'use server'

import { resend, EMAIL_FROM, INTERNAL_EMAIL } from '@/lib/email/resend'

interface ContactFormData {
  name: string
  email: string
  subject: string
  message: string
}

export async function submitContactForm(data: ContactFormData) {
  try {
    // Send notification to team
    await resend.emails.send({
      from: EMAIL_FROM,
      to: INTERNAL_EMAIL,
      subject: `Contact Form: ${data.subject}`,
      text: `
Name: ${data.name}
Email: ${data.email}
Subject: ${data.subject}

Message:
${data.message}
      `,
    })

    return { success: true }
  } catch (error) {
    console.error('[Contact Form] Error:', error)
    return { success: false, error: 'Failed to send message. Please try again.' }
  }
}
```

### Translation Keys

```json
{
  "contact": {
    "title": "Contact Us",
    "subtitle": "Get in touch with our team for questions, quotes, or partnership inquiries.",

    "meta": {
      "title": "Contact Timber International | European Oak Supplier",
      "description": "Contact Timber International for oak panels, custom production, and quotes. We serve customers across Europe with premium wood products."
    },

    "info": {
      "title": "Get in Touch",
      "address_label": "Address",
      "address": "Timber International Oy\nTehtaankatu 123\n00100 Helsinki\nFinland",
      "phone_label": "Phone",
      "phone": "+358 9 123 4567",
      "email_label": "Email",
      "email": "info@timber-international.com",
      "hours_label": "Business Hours",
      "hours": "Monday - Friday\n8:00 - 17:00 (EET)",
      "response_note": "We typically respond to inquiries within one business day."
    },

    "regions": {
      "title": "Regions We Serve",
      "description": "We deliver premium oak products throughout Europe.",
      "region_nordic": "Nordic Countries",
      "region_western": "Western Europe",
      "region_southern": "Southern Europe",
      "region_other": "Other European Markets",
      "other_regions_note": "Don't see your country? Contact us - we may be able to arrange delivery to additional locations."
    },

    "quote_cta": {
      "title": "Need a Quote?",
      "description": "Get competitive pricing for stock products or custom production orders.",
      "button": "Request a Quote"
    },

    "form": {
      "title": "Send us a Message",
      "name_label": "Your Name",
      "name_placeholder": "John Smith",
      "email_label": "Email Address",
      "email_placeholder": "john@company.com",
      "subject_label": "Subject",
      "subject_placeholder": "Select a subject",
      "subject_general": "General Inquiry",
      "subject_products": "Product Questions",
      "subject_delivery": "Delivery & Shipping",
      "subject_partnership": "Partnership Opportunity",
      "subject_other": "Other",
      "message_label": "Message",
      "message_placeholder": "How can we help you?",
      "submit": "Send Message",
      "sending": "Sending...",
      "success_message": "Your message has been sent. We'll get back to you soon!"
    }
  }
}
```

### Project Structure Notes

Files to create:
- `src/app/[locale]/contact/page.tsx`
- `src/components/features/contact/ContactInfo.tsx`
- `src/components/features/contact/RegionsServed.tsx`
- `src/components/features/contact/ContactForm.tsx`
- `src/lib/actions/contact.ts`

### References

- [Source: _bmad-output/planning-artifacts/marketing-website/epics.md#Epic-5-Story-5.3]
- [Source: _bmad-output/planning-artifacts/marketing-website/prd.md#FR30-FR31]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
