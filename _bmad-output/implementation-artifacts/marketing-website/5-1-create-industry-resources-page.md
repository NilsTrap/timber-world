# Story 5.1: Create Industry Resources Page

Status: ready-for-dev

## Story

As a **visitor**,
I want **to access educational content about wood products**,
So that **I can make informed purchasing decisions** (FR27).

## Acceptance Criteria

1. **Given** a visitor navigates to /[locale]/resources, **When** the page loads, **Then** an Industry Resources page displays with organized educational content

2. **Given** the resources page, **Then** the page has a clear heading and introduction

3. **Given** the resources page, **Then** content is organized into logical sections (species, quality, processes)

4. **Given** the resources page, **Then** internal links connect to relevant product catalog filters

5. **Given** the resources page, **Then** SEO meta tags optimize for industry search terms

6. **Given** the resources page, **Then** the page is fully translatable via i18n keys

7. **Given** the resources page, **Then** the page follows the solid header navigation style

## Tasks / Subtasks

- [ ] Task 1: Create Resources Page Route (AC: #1, #7)
  - [ ] Create `src/app/[locale]/resources/page.tsx`
  - [ ] Set up page layout with solid header
  - [ ] Add page header with title and introduction

- [ ] Task 2: Create Content Sections Component (AC: #2, #3)
  - [ ] Create `src/components/features/resources/ResourceSection.tsx`
  - [ ] Add section heading and body content
  - [ ] Add optional image/illustration
  - [ ] Create collapsible FAQ-style sections

- [ ] Task 3: Build Resources Page Content (AC: #3, #6)
  - [ ] Create sections: Wood Species, Quality Grades, Production Process, FAQ
  - [ ] Add educational content for each section
  - [ ] Store content in translation files

- [ ] Task 4: Add Catalog Links (AC: #4)
  - [ ] Link species sections to catalog with species filter
  - [ ] Link quality sections to catalog with grade filter
  - [ ] Style as prominent call-to-action links

- [ ] Task 5: Add SEO Meta Tags (AC: #5)
  - [ ] Set title with industry keywords
  - [ ] Set description for search
  - [ ] Add hreflang for all locales
  - [ ] Add structured data (FAQPage schema)

- [ ] Task 6: Add Translation Keys (AC: #6)
  - [ ] Page title and introduction
  - [ ] All section headings and content
  - [ ] Link labels
  - [ ] Meta tags

## Dev Notes

### Resources Page Route

```tsx
// src/app/[locale]/resources/page.tsx
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ResourceSection } from '@/components/features/resources/ResourceSection'
import { ResourceFAQ } from '@/components/features/resources/ResourceFAQ'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface ResourcesPageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: ResourcesPageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'resources' })

  return {
    title: t('meta.title'),
    description: t('meta.description'),
    keywords: t('meta.keywords'),
    alternates: {
      languages: {
        en: '/en/resources',
        fi: '/fi/resources',
        sv: '/sv/resources',
        no: '/no/resources',
        da: '/da/resources',
        nl: '/nl/resources',
        de: '/de/resources',
        es: '/es/resources',
      },
    },
  }
}

export default async function ResourcesPage({ params }: ResourcesPageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'resources' })

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

      {/* Content Sections */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto space-y-16">
          {/* Wood Species Section */}
          <ResourceSection
            id="species"
            title={t('species.title')}
            description={t('species.intro')}
          >
            <div className="prose prose-lg max-w-none">
              <h3>{t('species.oak.title')}</h3>
              <p>{t('species.oak.description')}</p>

              <h4>{t('species.oak.characteristics_title')}</h4>
              <ul>
                <li>{t('species.oak.char_1')}</li>
                <li>{t('species.oak.char_2')}</li>
                <li>{t('species.oak.char_3')}</li>
                <li>{t('species.oak.char_4')}</li>
              </ul>

              <h4>{t('species.oak.applications_title')}</h4>
              <p>{t('species.oak.applications')}</p>
            </div>

            <div className="mt-6">
              <Button asChild variant="outline">
                <Link href={`/${locale}/products?species=oak`}>
                  {t('species.view_oak_products')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </ResourceSection>

          {/* Quality Grades Section */}
          <ResourceSection
            id="quality"
            title={t('quality.title')}
            description={t('quality.intro')}
          >
            <div className="grid md:grid-cols-3 gap-6">
              {/* Grade A */}
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-forest-600 mb-3">
                  {t('quality.grade_a.title')}
                </h3>
                <p className="text-stone-600 mb-4">
                  {t('quality.grade_a.description')}
                </p>
                <Button asChild variant="link" className="p-0">
                  <Link href={`/${locale}/products?grade=A`}>
                    {t('quality.view_grade')}
                  </Link>
                </Button>
              </div>

              {/* Grade B */}
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-forest-600 mb-3">
                  {t('quality.grade_b.title')}
                </h3>
                <p className="text-stone-600 mb-4">
                  {t('quality.grade_b.description')}
                </p>
                <Button asChild variant="link" className="p-0">
                  <Link href={`/${locale}/products?grade=B`}>
                    {t('quality.view_grade')}
                  </Link>
                </Button>
              </div>

              {/* Grade C */}
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-forest-600 mb-3">
                  {t('quality.grade_c.title')}
                </h3>
                <p className="text-stone-600 mb-4">
                  {t('quality.grade_c.description')}
                </p>
                <Button asChild variant="link" className="p-0">
                  <Link href={`/${locale}/products?grade=C`}>
                    {t('quality.view_grade')}
                  </Link>
                </Button>
              </div>
            </div>
          </ResourceSection>

          {/* Production Process Section */}
          <ResourceSection
            id="process"
            title={t('process.title')}
            description={t('process.intro')}
          >
            <div className="prose prose-lg max-w-none">
              <p>{t('process.description')}</p>

              <div className="not-prose my-8">
                <Button asChild size="lg">
                  <Link href={`/${locale}#journey`}>
                    {t('process.view_journey')}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </ResourceSection>

          {/* FAQ Section */}
          <ResourceSection
            id="faq"
            title={t('faq.title')}
            description={t('faq.intro')}
          >
            <ResourceFAQ />
          </ResourceSection>
        </div>
      </div>

      {/* CTA Section */}
      <section className="bg-forest-500 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold font-playfair mb-4">
            {t('cta.title')}
          </h2>
          <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
            {t('cta.description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" variant="secondary">
              <Link href={`/${locale}/products`}>
                {t('cta.browse_products')}
              </Link>
            </Button>
            <Button asChild size="lg" className="bg-white text-forest-600 hover:bg-cream-50">
              <Link href={`/${locale}/quote`}>
                {t('cta.request_quote')}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
```

### ResourceSection Component

```tsx
// src/components/features/resources/ResourceSection.tsx
import { ReactNode } from 'react'

interface ResourceSectionProps {
  id: string
  title: string
  description: string
  children: ReactNode
}

export function ResourceSection({ id, title, description, children }: ResourceSectionProps) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-3xl font-bold font-playfair text-charcoal mb-4">
        {title}
      </h2>
      <p className="text-lg text-stone-600 mb-8">
        {description}
      </p>
      {children}
    </section>
  )
}
```

### ResourceFAQ Component

```tsx
// src/components/features/resources/ResourceFAQ.tsx
'use client'

import { useTranslations } from 'next-intl'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const FAQ_ITEMS = [
  'faq_1',
  'faq_2',
  'faq_3',
  'faq_4',
  'faq_5',
] as const

export function ResourceFAQ() {
  const t = useTranslations('resources.faq')

  return (
    <Accordion type="single" collapsible className="w-full">
      {FAQ_ITEMS.map((item, index) => (
        <AccordionItem key={item} value={item}>
          <AccordionTrigger className="text-left text-lg font-medium">
            {t(`${item}.question`)}
          </AccordionTrigger>
          <AccordionContent className="text-stone-600">
            {t(`${item}.answer`)}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
```

### Translation Keys

```json
{
  "resources": {
    "title": "Industry Resources",
    "subtitle": "Learn about wood species, quality standards, and our production process to make informed decisions.",

    "meta": {
      "title": "Wood Industry Resources & Guides | Timber International",
      "description": "Educational resources about oak panels, wood quality grades, and production processes. Learn from Europe's trusted timber supplier.",
      "keywords": "oak panels guide, wood quality grades, timber production, FSC certified wood"
    },

    "species": {
      "title": "Wood Species",
      "intro": "Understanding wood species characteristics helps you choose the right material for your project.",
      "oak": {
        "title": "European Oak",
        "description": "European Oak is prized for its durability, beautiful grain patterns, and versatility across applications.",
        "characteristics_title": "Key Characteristics",
        "char_1": "Hardness: Very hard and durable (Janka hardness ~1360 lbf)",
        "char_2": "Grain: Distinctive open grain with medullary rays",
        "char_3": "Color: Light to medium brown with warm undertones",
        "char_4": "Workability: Excellent for machining, finishing, and CNC operations",
        "applications_title": "Common Applications",
        "applications": "Furniture, flooring, cabinetry, interior paneling, stair components, and architectural millwork."
      },
      "view_oak_products": "View Oak Products"
    },

    "quality": {
      "title": "Quality Grades",
      "intro": "Our grading system ensures consistent quality and helps you select the right grade for your application.",
      "grade_a": {
        "title": "Grade A (Premium)",
        "description": "Minimal defects, uniform color, ideal for visible surfaces requiring the finest appearance."
      },
      "grade_b": {
        "title": "Grade B (Standard)",
        "description": "Minor natural characteristics allowed, excellent balance of quality and value for most applications."
      },
      "grade_c": {
        "title": "Grade C (Rustic)",
        "description": "Natural character marks, knots, and color variation for rustic or industrial aesthetics."
      },
      "view_grade": "View Products →"
    },

    "process": {
      "title": "Our Production Process",
      "intro": "From forest to finished product, we control every step to ensure quality.",
      "description": "Our vertically integrated production allows us to maintain strict quality control from the selection of raw materials through drying, processing, and finishing. This means consistent quality, reliable supply, and competitive pricing.",
      "view_journey": "Explore Our Production Journey"
    },

    "faq": {
      "title": "Frequently Asked Questions",
      "intro": "Common questions about our products and services.",
      "faq_1": {
        "question": "What is the difference between finger-jointed and full stave panels?",
        "answer": "Finger-jointed panels are made from shorter pieces joined end-to-end, offering stability and efficient material use. Full stave panels use continuous lengths of wood for a more traditional appearance with longer grain lines."
      },
      "faq_2": {
        "question": "Are your products FSC certified?",
        "answer": "Yes, we offer FSC certified products. Look for the FSC filter in our product catalog to find certified options. FSC certification ensures responsible forest management."
      },
      "faq_3": {
        "question": "What moisture content should I expect?",
        "answer": "Our kiln-dried products typically have 8-12% moisture content, suitable for interior applications. We can accommodate specific moisture requirements for your project."
      },
      "faq_4": {
        "question": "Do you offer custom dimensions and CNC machining?",
        "answer": "Yes, we offer custom production including specific dimensions, special finishes, and CNC machining services. Request a custom quote to discuss your requirements."
      },
      "faq_5": {
        "question": "Which countries do you deliver to?",
        "answer": "We deliver throughout Europe including Finland, Sweden, Norway, Denmark, Netherlands, Germany, Spain, and the UK. Contact us for delivery to other locations."
      }
    },

    "cta": {
      "title": "Ready to Get Started?",
      "description": "Browse our product catalog or request a custom quote for your project.",
      "browse_products": "Browse Products",
      "request_quote": "Request a Quote"
    }
  }
}
```

### SEO Structured Data

```tsx
// Add to page.tsx
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  'mainEntity': [
    // Generate from translation keys
  ],
}

// Add to head via metadata
export async function generateMetadata() {
  return {
    // ... other metadata
    other: {
      'script:ld+json': JSON.stringify(faqSchema),
    },
  }
}
```

### Project Structure Notes

Files to create:
- `src/app/[locale]/resources/page.tsx`
- `src/components/features/resources/ResourceSection.tsx`
- `src/components/features/resources/ResourceFAQ.tsx`

### References

- [Source: _bmad-output/planning-artifacts/marketing-website/epics.md#Epic-5-Story-5.1]
- [Source: _bmad-output/planning-artifacts/marketing-website/prd.md#FR27]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
