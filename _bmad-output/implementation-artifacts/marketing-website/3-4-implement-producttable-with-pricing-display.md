# Story 3.4: Implement ProductTable with Pricing Display

Status: ready-for-dev

## Story

As a **visitor**,
I want **to see products displayed with clear pricing and availability information**,
So that **I can compare options and make informed decisions**.

## Acceptance Criteria

1. **Given** products are loaded from the API, **When** the ProductTable component renders, **Then** products display in a table with columns: Product/SKU, Dimensions, Quality, Stock Status, €/m³, €/piece, €/m²

2. **Given** the table is displayed, **Then** stock pricing is clearly visible without login (FR14)

3. **Given** the table is displayed, **Then** stock availability shows status indicator (In Stock, Low Stock, Out of Stock) (FR15)

4. **Given** column headers, **Then** columns are sortable by clicking headers

5. **Given** sorting is active, **Then** current sort column shows ascending/descending indicator

6. **Given** no products match filters, **Then** empty state shows friendly message when no products match filters

7. **Given** pricing data, **Then** prices are formatted with € symbol and appropriate decimals

8. **Given** table rows, **Then** table rows have hover state for visual feedback

## Tasks / Subtasks

- [ ] Task 1: Create ProductTable Component (AC: #1, #8)
  - [ ] Create `src/components/features/products/ProductTable.tsx`
  - [ ] Use shadcn/ui Table component
  - [ ] Define columns: Product/SKU, Dimensions, Quality, Stock Status, €/m³, €/piece, €/m²
  - [ ] Add hover state to rows

- [ ] Task 2: Create ProductRow Component (AC: #1)
  - [ ] Create `src/components/features/products/ProductRow.tsx`
  - [ ] Display SKU and product name
  - [ ] Display dimensions (W x L x T)
  - [ ] Display quality grade
  - [ ] Include checkbox for selection (prep for Story 3.5)

- [ ] Task 3: Implement Price Display (AC: #2, #7)
  - [ ] Create `src/components/features/products/PriceDisplay.tsx`
  - [ ] Format prices with € symbol
  - [ ] Convert from cents to euros with 2 decimals
  - [ ] Display all three pricing units
  - [ ] Handle null/undefined prices gracefully

- [ ] Task 4: Implement Stock Status Indicator (AC: #3)
  - [ ] Create `src/components/features/products/StockBadge.tsx`
  - [ ] "In Stock" - Green badge
  - [ ] "Low Stock" - Orange/yellow badge
  - [ ] "Out of Stock" - Red/gray badge
  - [ ] Include stock quantity if relevant

- [ ] Task 5: Implement Column Sorting (AC: #4, #5)
  - [ ] Add onClick to column headers
  - [ ] Update URL params with sortBy/sortOrder
  - [ ] Show ascending/descending arrow indicator
  - [ ] Default to created_at desc

- [ ] Task 6: Create Empty State (AC: #6)
  - [ ] Create `src/components/features/products/EmptyState.tsx`
  - [ ] Show friendly message
  - [ ] Suggest clearing filters
  - [ ] Add illustration or icon

- [ ] Task 7: Add Price Formatting Utility
  - [ ] Create `src/lib/utils/formatters.ts`
  - [ ] Implement `formatPrice(cents: number): string`
  - [ ] Handle currency formatting per locale

## Dev Notes

### ProductTable Component

```tsx
'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useProductFilters } from '@/hooks/useProductFilters'
import { ProductRow } from './ProductRow'
import { SortIndicator } from './SortIndicator'
import { EmptyState } from './EmptyState'
import { Product } from '@/types/product'

interface ProductTableProps {
  products: Product[]
  total: number
}

export function ProductTable({ products, total }: ProductTableProps) {
  const { filters, updateFilter } = useProductFilters()

  const handleSort = (column: string) => {
    const newOrder =
      filters.sortBy === column && filters.sortOrder === 'asc'
        ? 'desc'
        : 'asc'
    updateFilter('sortBy', [column])
    updateFilter('sortOrder', [newOrder])
  }

  if (products.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              {/* Checkbox column */}
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => handleSort('sku')}
            >
              Product / SKU
              <SortIndicator column="sku" current={filters.sortBy} order={filters.sortOrder} />
            </TableHead>
            <TableHead>Dimensions</TableHead>
            <TableHead>Quality</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead
              className="text-right cursor-pointer hover:bg-gray-50"
              onClick={() => handleSort('unit_price_m3')}
            >
              €/m³
              <SortIndicator column="unit_price_m3" current={filters.sortBy} order={filters.sortOrder} />
            </TableHead>
            <TableHead className="text-right">€/piece</TableHead>
            <TableHead className="text-right">€/m²</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <ProductRow key={product.id} product={product} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

### Price Formatting

```typescript
// src/lib/utils/formatters.ts
export function formatPrice(cents: number, locale = 'en-EU'): string {
  const euros = cents / 100
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros)
}

// Usage: formatPrice(280000) → "€2,800.00"
```

### Stock Badge Component

```tsx
// src/components/features/products/StockBadge.tsx
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface StockBadgeProps {
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
  quantity?: number
}

export function StockBadge({ status, quantity }: StockBadgeProps) {
  const config = {
    in_stock: {
      label: 'In Stock',
      className: 'bg-green-100 text-green-800 border-green-200',
    },
    low_stock: {
      label: 'Low Stock',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    },
    out_of_stock: {
      label: 'Out of Stock',
      className: 'bg-gray-100 text-gray-600 border-gray-200',
    },
  }

  const { label, className } = config[status]

  return (
    <Badge variant="outline" className={cn('font-normal', className)}>
      {label}
      {quantity !== undefined && status !== 'out_of_stock' && (
        <span className="ml-1 text-xs">({quantity})</span>
      )}
    </Badge>
  )
}
```

### Empty State

```tsx
// src/components/features/products/EmptyState.tsx
import { SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProductFilters } from '@/hooks/useProductFilters'

export function EmptyState() {
  const { clearFilters } = useProductFilters()

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <SearchX className="h-16 w-16 text-gray-300 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        No products found
      </h3>
      <p className="text-gray-500 mb-6 max-w-sm">
        Try adjusting your filters to find what you're looking for.
      </p>
      <Button variant="outline" onClick={clearFilters}>
        Clear all filters
      </Button>
    </div>
  )
}
```

### Table Styling

- White background with subtle border
- Header row with light gray background
- Hover state on data rows (bg-gray-50)
- Right-aligned price columns
- Proper spacing and padding

### References

- [Source: _bmad-output/planning-artifacts/marketing-website/prd.md#FR14-FR15]
- [Source: _bmad-output/planning-artifacts/marketing-website/architecture.md#Format-Patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Product-Table]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
