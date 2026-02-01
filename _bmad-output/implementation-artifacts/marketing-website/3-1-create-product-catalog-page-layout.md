# Story 3.1: Create Product Catalog Page Layout

Status: ready-for-dev

## Story

As a **visitor**,
I want **to access a well-organized product catalog page**,
So that **I can browse Timber International's product offerings**.

## Acceptance Criteria

1. **Given** a visitor navigates to /[locale]/products, **When** the page loads, **Then** a catalog page displays with sidebar filter panel (280px, left) and results area (right)

2. **Given** the catalog page loads, **Then** the page header shows "Product Catalog" title and product count

3. **Given** products are available, **Then** the results area displays products in a responsive grid (3-4 columns on desktop)

4. **Given** any visitor, **Then** the page loads without requiring login (FR6)

5. **Given** the page is indexed, **Then** SEO meta tags are set for the catalog page

6. **Given** the page is rendered, **Then** the page follows the solid header navigation style

7. **Given** data is loading, **Then** loading states show skeleton components while data fetches

## Tasks / Subtasks

- [ ] Task 1: Create Products Page (AC: #1, #4, #6)
  - [ ] Create `src/app/[locale]/products/page.tsx`
  - [ ] Set up Server Component for initial data fetch
  - [ ] Implement two-column layout (sidebar + results)
  - [ ] No authentication required (public access)

- [ ] Task 2: Create Page Header (AC: #2)
  - [ ] Add page title "Product Catalog"
  - [ ] Display product count dynamically
  - [ ] Add breadcrumb navigation
  - [ ] Style with appropriate spacing

- [ ] Task 3: Create Sidebar Layout (AC: #1)
  - [ ] Create filter sidebar container (280px width)
  - [ ] Position fixed or sticky on scroll
  - [ ] Add placeholder for filter components
  - [ ] Handle scroll overflow

- [ ] Task 4: Create Results Grid Layout (AC: #3)
  - [ ] Create responsive grid container
  - [ ] Configure 3-4 columns on desktop
  - [ ] 2 columns on tablet
  - [ ] 1 column on mobile (handled in Story 3.6)

- [ ] Task 5: Add SEO Meta Tags (AC: #5)
  - [ ] Configure page metadata
  - [ ] Add title, description
  - [ ] Add Open Graph tags
  - [ ] Add hreflang for all locales

- [ ] Task 6: Implement Loading States (AC: #7)
  - [ ] Create skeleton loader for sidebar
  - [ ] Create skeleton loader for product grid
  - [ ] Use Suspense boundaries appropriately

## Dev Notes

### Page Structure

```tsx
// src/app/[locale]/products/page.tsx
import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { ProductCatalog } from '@/components/features/products/ProductCatalog'
import { ProductFilter } from '@/components/features/products/ProductFilter'
import { ProductGridSkeleton } from '@/components/features/products/ProductGridSkeleton'

export async function generateMetadata({ params: { locale } }) {
  const t = await getTranslations({ locale, namespace: 'products' })

  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: {
      languages: {
        'en': '/en/products',
        'fi': '/fi/products',
        // ... other locales
      },
    },
  }
}

export default async function ProductsPage() {
  const t = await getTranslations('products')

  return (
    <main className="min-h-screen bg-warm-cream">
      {/* Page Header */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-8">
          <h1 className="font-heading text-3xl md:text-4xl text-charcoal">
            {t('title')}
          </h1>
        </div>
      </div>

      {/* Catalog Layout */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-24">
              <ProductFilter />
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1">
            <Suspense fallback={<ProductGridSkeleton />}>
              <ProductCatalog />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  )
}
```

### Layout Specifications

| Breakpoint | Sidebar | Grid Columns |
|------------|---------|--------------|
| Desktop (1024px+) | 280px fixed | 3-4 columns |
| Tablet (768-1023px) | Hidden (drawer) | 2 columns |
| Mobile (<768px) | Hidden (drawer) | 1 column |

### Skeleton Component

```tsx
// src/components/features/products/ProductGridSkeleton.tsx
import { Skeleton } from '@/components/ui/skeleton'

export function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg p-4">
          <Skeleton className="h-48 w-full mb-4" />
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2 mb-4" />
          <Skeleton className="h-6 w-1/3" />
        </div>
      ))}
    </div>
  )
}
```

### SEO Requirements

- Title: "Product Catalog | Timber International"
- Description: "Browse our premium oak panels, finger jointed boards, and full stave products. Transparent pricing and real-time stock availability."
- Canonical URL
- hreflang tags for all 8 locales

### Translation Keys

```json
{
  "products": {
    "title": "Product Catalog",
    "meta": {
      "title": "Product Catalog | Timber International",
      "description": "Browse our premium oak panels..."
    },
    "resultsCount": "{count} products found",
    "noResults": "No products match your filters"
  }
}
```

### References

- [Source: _bmad-output/planning-artifacts/marketing-website/architecture.md#Project-Structure]
- [Source: _bmad-output/planning-artifacts/marketing-website/prd.md#FR6]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Catalog-Layout]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
