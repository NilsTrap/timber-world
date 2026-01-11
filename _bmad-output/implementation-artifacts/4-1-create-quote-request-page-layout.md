# Story 4.1: Create Quote Request Page Layout

Status: ready-for-dev

## Story

As a **visitor**,
I want **to access a quote request page with clear options**,
So that **I can choose how to request a quote**.

## Acceptance Criteria

1. **Given** a visitor navigates to /[locale]/quote, **When** the page loads, **Then** a quote page displays with two input modes: Form and Chat

2. **Given** the quote page is displayed, **Then** tabs or toggle allow switching between modes

3. **Given** products were selected from catalog, **Then** they display in a "Selected Products" section

4. **Given** the quote page layout, **Then** the page uses centered layout (max-width 800px) for focused experience

5. **Given** the quote page, **Then** SEO meta tags are set appropriately for quote request page

6. **Given** the quote page, **Then** the page follows solid header navigation style (cream background, dark text)

## Tasks / Subtasks

- [ ] Task 1: Create Quote Page Route Structure (AC: #1, #4, #6)
  - [ ] Create `src/app/[locale]/quote/page.tsx`
  - [ ] Set up centered layout container with max-width 800px
  - [ ] Add page header with title and description
  - [ ] Verify solid header navigation is applied

- [ ] Task 2: Implement Mode Selector Tabs (AC: #1, #2)
  - [ ] Create `src/components/features/quote/QuoteModeSelector.tsx`
  - [ ] Use shadcn/ui Tabs component
  - [ ] Add "Form" and "Chat" tab options
  - [ ] Style tabs to match design system (forest green active state)
  - [ ] Persist mode selection in URL or session

- [ ] Task 3: Create Selected Products Section (AC: #3)
  - [ ] Create `src/components/features/quote/SelectedProductsList.tsx`
  - [ ] Read selected product IDs from URL params or session storage
  - [ ] Fetch product details for selected items
  - [ ] Display product summary cards with quantities
  - [ ] Add ability to remove products from selection
  - [ ] Show empty state if no products selected

- [ ] Task 4: Create Quote Page Container Component (AC: #1, #4)
  - [ ] Create `src/components/features/quote/QuotePageContainer.tsx`
  - [ ] Compose mode selector, selected products, and content area
  - [ ] Handle conditional rendering based on active tab
  - [ ] Add placeholder content for Form and Chat modes

- [ ] Task 5: Add SEO Meta Tags (AC: #5)
  - [ ] Add generateMetadata function to page.tsx
  - [ ] Set title: "Request a Quote | Timber International"
  - [ ] Set description for SEO
  - [ ] Add hreflang tags for all 8 locales
  - [ ] Add translation keys for meta content

- [ ] Task 6: Add Translation Keys (AC: all)
  - [ ] Add quote page translations to `src/messages/en.json`
  - [ ] Add placeholders to other locale files
  - [ ] Keys: quote.title, quote.description, quote.tab_form, quote.tab_chat, quote.selected_products, etc.

## Dev Notes

### Quote Page Structure

```
/[locale]/quote
├── Page Header (title + subtitle)
├── Selected Products Section (if any products selected)
│   └── Product summary cards with remove option
├── Mode Selector Tabs
│   ├── Form Tab → QuoteForm component (Story 4.2)
│   └── Chat Tab → ChatbotInterface component (Story 4.4)
└── Footer with links/info
```

### Quote Page Implementation

```tsx
// src/app/[locale]/quote/page.tsx
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { QuotePageContainer } from '@/components/features/quote/QuotePageContainer'

interface QuotePageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ products?: string; mode?: string }>
}

export async function generateMetadata({ params }: QuotePageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'quote' })

  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: {
      languages: {
        en: '/en/quote',
        fi: '/fi/quote',
        sv: '/sv/quote',
        no: '/no/quote',
        da: '/da/quote',
        nl: '/nl/quote',
        de: '/de/quote',
        es: '/es/quote',
      },
    },
  }
}

export default async function QuotePage({ params, searchParams }: QuotePageProps) {
  const { locale } = await params
  const { products, mode } = await searchParams
  const t = await getTranslations({ locale, namespace: 'quote' })

  // Parse product IDs from URL if present
  const selectedProductIds = products ? products.split(',') : []

  return (
    <main className="min-h-screen bg-warm-cream">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-[800px] mx-auto">
          {/* Page Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold font-playfair text-charcoal mb-4">
              {t('title')}
            </h1>
            <p className="text-lg text-stone-500">
              {t('description')}
            </p>
          </div>

          {/* Quote Page Container */}
          <QuotePageContainer
            selectedProductIds={selectedProductIds}
            initialMode={mode === 'chat' ? 'chat' : 'form'}
          />
        </div>
      </div>
    </main>
  )
}
```

### QuoteModeSelector Component

```tsx
// src/components/features/quote/QuoteModeSelector.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTranslations } from 'next-intl'
import { FileText, MessageCircle } from 'lucide-react'

interface QuoteModeSelectorProps {
  activeMode: 'form' | 'chat'
  onModeChange: (mode: 'form' | 'chat') => void
}

export function QuoteModeSelector({ activeMode, onModeChange }: QuoteModeSelectorProps) {
  const t = useTranslations('quote')
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleModeChange = (mode: string) => {
    const newMode = mode as 'form' | 'chat'
    onModeChange(newMode)

    // Update URL with mode parameter
    const params = new URLSearchParams(searchParams.toString())
    params.set('mode', newMode)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={activeMode} onValueChange={handleModeChange} className="w-full">
      <TabsList className="grid w-full grid-cols-2 h-14">
        <TabsTrigger
          value="form"
          className="flex items-center gap-2 text-base data-[state=active]:bg-forest-500 data-[state=active]:text-white"
        >
          <FileText className="h-5 w-5" />
          {t('tab_form')}
        </TabsTrigger>
        <TabsTrigger
          value="chat"
          className="flex items-center gap-2 text-base data-[state=active]:bg-forest-500 data-[state=active]:text-white"
        >
          <MessageCircle className="h-5 w-5" />
          {t('tab_chat')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
```

### SelectedProductsList Component

```tsx
// src/components/features/quote/SelectedProductsList.tsx
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Product } from '@/types/product'
import { formatPrice } from '@/lib/utils/formatters'

interface SelectedProductsListProps {
  productIds: string[]
  onRemove: (id: string) => void
}

export function SelectedProductsList({ productIds, onRemove }: SelectedProductsListProps) {
  const t = useTranslations('quote')
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (productIds.length === 0) {
      setProducts([])
      setIsLoading(false)
      return
    }

    async function fetchProducts() {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/products?ids=${productIds.join(',')}`)
        if (response.ok) {
          const data = await response.json()
          setProducts(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch products:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProducts()
  }, [productIds])

  if (productIds.length === 0) {
    return null
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          {t('selected_products')}
          <span className="text-sm font-normal text-stone-500">
            {productIds.length} {productIds.length === 1 ? t('item') : t('items')}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {productIds.map((id) => (
              <Skeleton key={id} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 bg-cream-50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">{product.sku}</p>
                  <p className="text-sm text-stone-500">
                    {product.width} x {product.length} x {product.thickness}mm • {product.species}
                  </p>
                  <p className="text-sm font-medium text-forest-500">
                    {formatPrice(product.unit_price_m3)}/m³
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-stone-400 hover:text-red-500"
                  onClick={() => onRemove(product.id)}
                  aria-label={t('remove_product')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

### QuotePageContainer Component

```tsx
// src/components/features/quote/QuotePageContainer.tsx
'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { QuoteModeSelector } from './QuoteModeSelector'
import { SelectedProductsList } from './SelectedProductsList'
import { Card, CardContent } from '@/components/ui/card'
import { useTranslations } from 'next-intl'

interface QuotePageContainerProps {
  selectedProductIds: string[]
  initialMode: 'form' | 'chat'
}

export function QuotePageContainer({ selectedProductIds, initialMode }: QuotePageContainerProps) {
  const t = useTranslations('quote')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<'form' | 'chat'>(initialMode)
  const [productIds, setProductIds] = useState(selectedProductIds)

  const handleRemoveProduct = useCallback((id: string) => {
    const newIds = productIds.filter(pid => pid !== id)
    setProductIds(newIds)

    // Update URL
    const params = new URLSearchParams(searchParams.toString())
    if (newIds.length > 0) {
      params.set('products', newIds.join(','))
    } else {
      params.delete('products')
    }
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [productIds, searchParams, router])

  return (
    <div className="space-y-6">
      {/* Selected Products */}
      <SelectedProductsList
        productIds={productIds}
        onRemove={handleRemoveProduct}
      />

      {/* Mode Selector */}
      <QuoteModeSelector
        activeMode={mode}
        onModeChange={setMode}
      />

      {/* Content Area */}
      <Card>
        <CardContent className="p-6">
          {mode === 'form' ? (
            <div className="text-center py-12 text-stone-500">
              {/* QuoteForm placeholder - implemented in Story 4.2 */}
              <p>{t('form_placeholder')}</p>
            </div>
          ) : (
            <div className="text-center py-12 text-stone-500">
              {/* ChatbotInterface placeholder - implemented in Story 4.4 */}
              <p>{t('chat_placeholder')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

### Translation Keys

```json
// src/messages/en.json - quote section
{
  "quote": {
    "title": "Request a Quote",
    "description": "Get competitive pricing for stock products or custom production orders",
    "tab_form": "Fill Out Form",
    "tab_chat": "Chat with Us",
    "selected_products": "Selected Products",
    "item": "item",
    "items": "items",
    "remove_product": "Remove product",
    "form_placeholder": "Quote form will be displayed here",
    "chat_placeholder": "AI assistant will be displayed here",
    "meta": {
      "title": "Request a Quote | Timber International",
      "description": "Request a quote for oak panels, elements, and custom CNC production. Get competitive pricing for stock or production orders."
    }
  }
}
```

### Project Structure Notes

Files to create:
- `src/app/[locale]/quote/page.tsx` - Main quote page route
- `src/components/features/quote/QuotePageContainer.tsx` - Container component
- `src/components/features/quote/QuoteModeSelector.tsx` - Tab selector
- `src/components/features/quote/SelectedProductsList.tsx` - Selected products display

### Architecture Compliance

| Pattern | Compliance |
|---------|------------|
| Server Components by default | Page is Server Component, client components isolated |
| URL state for mode | Mode stored in URL params for shareability |
| Centered layout | max-w-[800px] mx-auto as per UX spec |
| Translation keys | All text uses useTranslations/getTranslations |
| shadcn/ui components | Tabs, Card, Button from component library |

### Design System Tokens

| Element | Token/Class |
|---------|-------------|
| Background | bg-warm-cream (#FAF6F1) |
| Headings | font-playfair text-charcoal |
| Active tab | bg-forest-500 text-white |
| Card background | bg-white |
| Product item bg | bg-cream-50 |

### Accessibility Notes

- Tabs component has proper ARIA roles (tablist, tab, tabpanel)
- Remove buttons have aria-label for screen readers
- Focus management between tabs
- Keyboard navigation supported (arrow keys for tabs)

### Testing Considerations

- Test mode switching persists URL state
- Test product removal updates URL correctly
- Test empty state when no products selected
- Test responsive layout at 800px max-width
- Test keyboard navigation between tabs

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-4-Story-4.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project-Structure]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Quote-Form]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Component-Strategy]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
