# Story 3.5: Add Product Selection for Quote

Status: ready-for-dev

## Story

As a **visitor**,
I want **to select multiple products to include in a quote request**,
So that **I can request pricing for everything I need in one submission**.

## Acceptance Criteria

1. **Given** products are displayed in the catalog, **When** a visitor selects products, **Then** each product row has a checkbox for selection (FR16)

2. **Given** products are selected, **Then** a floating selection summary bar appears when products are selected

3. **Given** products are selected, **Then** the summary shows: "{N} products selected" and "Request Quote" button

4. **Given** "Request Quote" is clicked, **Then** clicking "Request Quote" navigates to /[locale]/quote with selected product IDs

5. **Given** navigation to quote page, **Then** selected products are passed via URL parameters or session storage

6. **Given** selection options, **Then** "Select all visible" and "Clear selection" options are available

7. **Given** active filters, **Then** selection persists when applying filters (within session)

## Tasks / Subtasks

- [ ] Task 1: Add Checkboxes to ProductTable (AC: #1)
  - [ ] Add checkbox column to table
  - [ ] Create selection state management
  - [ ] Handle individual row selection
  - [ ] Style checkbox with shadcn/ui

- [ ] Task 2: Create Product Selection Context (AC: #7)
  - [ ] Create `src/contexts/ProductSelectionContext.tsx`
  - [ ] Store selected product IDs
  - [ ] Persist across filter changes
  - [ ] Provide select/deselect methods

- [ ] Task 3: Create Selection Summary Bar (AC: #2, #3)
  - [ ] Create `src/components/features/products/SelectionBar.tsx`
  - [ ] Display count of selected products
  - [ ] Add "Request Quote" button
  - [ ] Position fixed at bottom of viewport
  - [ ] Animate in/out based on selection

- [ ] Task 4: Implement "Select All" / "Clear" (AC: #6)
  - [ ] Add "Select all visible" action
  - [ ] Add "Clear selection" action
  - [ ] Update context state accordingly
  - [ ] Add to table header or selection bar

- [ ] Task 5: Navigate to Quote with Products (AC: #4, #5)
  - [ ] On "Request Quote" click, navigate to /quote
  - [ ] Pass product IDs via URL params (for few products)
  - [ ] Or use sessionStorage for many products
  - [ ] Clear selection after navigation

- [ ] Task 6: Style Selection Bar
  - [ ] Forest Green background
  - [ ] White text
  - [ ] Slide-up animation
  - [ ] Shadow for depth

## Dev Notes

### Product Selection Context

```tsx
// src/contexts/ProductSelectionContext.tsx
'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface ProductSelectionContextType {
  selectedIds: Set<string>
  select: (id: string) => void
  deselect: (id: string) => void
  toggle: (id: string) => void
  selectAll: (ids: string[]) => void
  clear: () => void
  isSelected: (id: string) => boolean
}

const ProductSelectionContext = createContext<ProductSelectionContextType | null>(null)

export function ProductSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const select = useCallback((id: string) => {
    setSelectedIds(prev => new Set([...prev, id]))
  }, [])

  const deselect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const toggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids))
  }, [])

  const clear = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds])

  return (
    <ProductSelectionContext.Provider
      value={{ selectedIds, select, deselect, toggle, selectAll, clear, isSelected }}
    >
      {children}
    </ProductSelectionContext.Provider>
  )
}

export function useProductSelection() {
  const context = useContext(ProductSelectionContext)
  if (!context) {
    throw new Error('useProductSelection must be used within ProductSelectionProvider')
  }
  return context
}
```

### Selection Bar Component

```tsx
// src/components/features/products/SelectionBar.tsx
'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useProductSelection } from '@/contexts/ProductSelectionContext'
import { cn } from '@/lib/utils'

export function SelectionBar() {
  const router = useRouter()
  const { selectedIds, clear } = useProductSelection()
  const count = selectedIds.size

  const handleRequestQuote = () => {
    // For small selections, use URL params
    if (count <= 10) {
      const params = new URLSearchParams()
      selectedIds.forEach(id => params.append('product', id))
      router.push(`/quote?${params.toString()}`)
    } else {
      // For larger selections, use sessionStorage
      sessionStorage.setItem('selectedProducts', JSON.stringify([...selectedIds]))
      router.push('/quote')
    }
    clear()
  }

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300',
        count > 0 ? 'translate-y-0' : 'translate-y-full'
      )}
    >
      <div className="bg-forest-green text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-medium">
              {count} product{count !== 1 ? 's' : ''} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:text-white/80"
              onClick={clear}
            >
              Clear selection
            </Button>
          </div>
          <Button
            className="bg-white text-forest-green hover:bg-warm-cream"
            onClick={handleRequestQuote}
          >
            Request Quote
          </Button>
        </div>
      </div>
    </div>
  )
}
```

### Updated ProductRow with Checkbox

```tsx
// Add to ProductRow.tsx
import { Checkbox } from '@/components/ui/checkbox'
import { useProductSelection } from '@/contexts/ProductSelectionContext'

export function ProductRow({ product }: { product: Product }) {
  const { isSelected, toggle } = useProductSelection()

  return (
    <TableRow className="hover:bg-gray-50">
      <TableCell>
        <Checkbox
          checked={isSelected(product.id)}
          onCheckedChange={() => toggle(product.id)}
          aria-label={`Select ${product.sku}`}
        />
      </TableCell>
      {/* ... other cells */}
    </TableRow>
  )
}
```

### Table Header Checkbox (Select All)

```tsx
// In ProductTable header
<TableHead className="w-12">
  <Checkbox
    checked={products.length > 0 && products.every(p => isSelected(p.id))}
    onCheckedChange={(checked) => {
      if (checked) {
        selectAll(products.map(p => p.id))
      } else {
        clear()
      }
    }}
    aria-label="Select all products"
  />
</TableHead>
```

### Session Storage Pattern

```typescript
// On quote page, retrieve selections
useEffect(() => {
  const stored = sessionStorage.getItem('selectedProducts')
  if (stored) {
    const ids = JSON.parse(stored) as string[]
    // Load product details for these IDs
    sessionStorage.removeItem('selectedProducts')
  }
}, [])
```

### References

- [Source: _bmad-output/planning-artifacts/prd.md#FR16]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Selection-Experience]
- [Source: _bmad-output/planning-artifacts/architecture.md#State-Management]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
