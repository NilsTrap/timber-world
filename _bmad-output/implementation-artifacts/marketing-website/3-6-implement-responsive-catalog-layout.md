# Story 3.6: Implement Responsive Catalog Layout

Status: ready-for-dev

## Story

As a **visitor on mobile or tablet**,
I want **the catalog to work well on smaller screens**,
So that **I can browse products from any device**.

## Acceptance Criteria

1. **Given** a visitor accesses the catalog on a mobile device, **When** the page renders, **Then** the sidebar filters collapse into a slide-out drawer (triggered by "Filters" button)

2. **Given** the filter drawer is open, **Then** the filter drawer has a close button and "Apply Filters" action

3. **Given** mobile viewport, **Then** products display as cards in a single column instead of table rows

4. **Given** product cards, **Then** each product card shows: image thumbnail, product name, dimensions, price (primary), stock status

5. **Given** product cards, **Then** product selection works via card tap/checkbox

6. **Given** mobile viewport, **Then** the floating selection bar is positioned for mobile usability

7. **Given** mobile viewport, **Then** touch targets meet 44x44px minimum (NFR33)

8. **Given** tablet view (768px-1023px), **Then** tablet view uses 2-column card grid with collapsible sidebar

## Tasks / Subtasks

- [ ] Task 1: Create Filter Drawer for Mobile (AC: #1, #2)
  - [ ] Create `src/components/features/products/FilterDrawer.tsx`
  - [ ] Use shadcn/ui Sheet component
  - [ ] Add "Filters" trigger button (visible on mobile)
  - [ ] Add close button and "Apply Filters" button
  - [ ] Include all filter components inside drawer

- [ ] Task 2: Create ProductCard Component (AC: #3, #4, #5)
  - [ ] Create `src/components/features/products/ProductCard.tsx`
  - [ ] Add product image thumbnail placeholder
  - [ ] Display product name/SKU
  - [ ] Display dimensions
  - [ ] Display primary price (€/m³)
  - [ ] Add stock status badge
  - [ ] Add checkbox for selection

- [ ] Task 3: Create Responsive Grid (AC: #3, #8)
  - [ ] Update ProductCatalog to detect viewport
  - [ ] Show ProductTable on desktop
  - [ ] Show ProductCard grid on tablet/mobile
  - [ ] Grid: 1 column mobile, 2 columns tablet, 3-4 desktop (table)

- [ ] Task 4: Update Selection Bar for Mobile (AC: #6)
  - [ ] Adjust padding and sizing for mobile
  - [ ] Ensure buttons are easily tappable
  - [ ] Test on various mobile sizes

- [ ] Task 5: Ensure Touch Target Sizes (AC: #7)
  - [ ] Verify all buttons are at least 44x44px
  - [ ] Verify checkboxes have adequate touch area
  - [ ] Test filter controls on touch devices

- [ ] Task 6: Hide Desktop Sidebar on Mobile
  - [ ] Use `hidden lg:block` on sidebar
  - [ ] Show "Filters" button on mobile/tablet

## Dev Notes

### Filter Drawer Component

```tsx
// src/components/features/products/FilterDrawer.tsx
'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { SlidersHorizontal, X } from 'lucide-react'
import { ProductFilter } from './ProductFilter'

export function FilterDrawer() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="lg:hidden">
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:w-80">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="mt-4 h-[calc(100vh-140px)] overflow-y-auto">
          <ProductFilter />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t">
          <Button
            className="w-full"
            onClick={() => setOpen(false)}
          >
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

### ProductCard Component

```tsx
// src/components/features/products/ProductCard.tsx
'use client'

import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { StockBadge } from './StockBadge'
import { formatPrice } from '@/lib/utils/formatters'
import { useProductSelection } from '@/contexts/ProductSelectionContext'
import { Product } from '@/types/product'

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const { isSelected, toggle } = useProductSelection()

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => toggle(product.id)}
    >
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Checkbox */}
          <Checkbox
            checked={isSelected(product.id)}
            className="mt-1 h-5 w-5"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Image Placeholder */}
          <div className="w-20 h-20 bg-gray-100 rounded flex-shrink-0">
            <Image
              src="/images/products/placeholder.webp"
              alt={product.sku}
              width={80}
              height={80}
              className="object-cover rounded"
            />
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{product.sku}</h3>
            <p className="text-sm text-gray-500">
              {product.width} x {product.length} x {product.thickness}mm
            </p>
            <p className="text-sm text-gray-500">
              {product.species} • Grade {product.quality_grade}
            </p>
            <div className="flex items-center justify-between mt-2">
              <span className="font-semibold text-forest-green">
                {formatPrice(product.unit_price_m3)}/m³
              </span>
              <StockBadge status={product.stock_status} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

### Responsive ProductCatalog

```tsx
// src/components/features/products/ProductCatalog.tsx
'use client'

import { useMediaQuery } from '@/hooks/useMediaQuery'
import { ProductTable } from './ProductTable'
import { ProductCard } from './ProductCard'
import { Product } from '@/types/product'

interface ProductCatalogProps {
  products: Product[]
  total: number
}

export function ProductCatalog({ products, total }: ProductCatalogProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  if (isDesktop) {
    return <ProductTable products={products} total={total} />
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
```

### useMediaQuery Hook

```typescript
// src/hooks/useMediaQuery.ts
'use client'

import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    setMatches(media.matches)

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}
```

### Responsive Breakpoints

| Viewport | Layout |
|----------|--------|
| Mobile (<640px) | 1 column cards, filter drawer |
| Tablet (640-1023px) | 2 column cards, filter drawer |
| Desktop (1024px+) | Table view, sidebar filters |

### Touch Target Requirements (NFR33)

- All buttons: min 44x44px
- Checkboxes: increase tap area with padding
- Card selection: entire card is tappable
- Filter controls: adequate spacing

### Mobile Selection Bar

```tsx
// Update SelectionBar for mobile
<div className="bg-forest-green text-white shadow-lg">
  <div className="container mx-auto px-4 py-3 sm:py-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-0 sm:justify-between">
    <span className="font-medium text-sm sm:text-base">
      {count} product{count !== 1 ? 's' : ''} selected
    </span>
    <div className="flex gap-2 w-full sm:w-auto">
      <Button
        variant="ghost"
        size="sm"
        className="text-white hover:text-white/80 flex-1 sm:flex-none"
        onClick={clear}
      >
        Clear
      </Button>
      <Button
        size="sm"
        className="bg-white text-forest-green hover:bg-warm-cream flex-1 sm:flex-none"
        onClick={handleRequestQuote}
      >
        Request Quote
      </Button>
    </div>
  </div>
</div>
```

### References

- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Responsive-Design]
- [Source: _bmad-output/planning-artifacts/marketing-website/prd.md#NFR33]
- [Source: _bmad-output/planning-artifacts/marketing-website/architecture.md#Frontend-Architecture]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
