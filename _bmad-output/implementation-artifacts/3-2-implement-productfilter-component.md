# Story 3.2: Implement ProductFilter Component

Status: ready-for-dev

## Story

As a **visitor**,
I want **to filter products by multiple criteria**,
So that **I can quickly find products matching my specifications**.

## Acceptance Criteria

1. **Given** the catalog page is displayed, **When** filter options are rendered, **Then** the following filter groups are available as collapsible sections with checkboxes:
   - Species (oak, etc.) - FR7
   - Width (mm ranges) - FR8
   - Length (mm ranges) - FR8
   - Thickness (mm options) - FR8
   - Quality grade - FR9
   - Type (FJ - finger jointed, FS - full stave) - FR10
   - Moisture content (%) - FR11
   - Finish type - FR12
   - FSC certification (yes/no) - FR13

2. **Given** filters are applied, **Then** each filter group shows active filter count badge

3. **Given** filters are applied, **Then** a "Clear all filters" button resets all selections

4. **Given** filters change, **Then** filter state is reflected in URL query parameters (shareable)

5. **Given** filters are applied, **Then** filter changes apply within 500ms (NFR5)

6. **Given** keyboard users, **Then** all filter controls are keyboard accessible

## Tasks / Subtasks

- [ ] Task 1: Create ProductFilter Component Structure (AC: #1)
  - [ ] Create `src/components/features/products/ProductFilter.tsx`
  - [ ] Set up collapsible accordion structure
  - [ ] Use shadcn/ui Accordion component
  - [ ] Create FilterSection child component

- [ ] Task 2: Implement Individual Filter Groups (AC: #1)
  - [ ] Species filter (checkbox list)
  - [ ] Width filter (range checkboxes: 100-200mm, 200-300mm, etc.)
  - [ ] Length filter (range checkboxes)
  - [ ] Thickness filter (checkbox list: 18mm, 20mm, 22mm, etc.)
  - [ ] Quality grade filter (checkbox list)
  - [ ] Type filter (FJ/FS checkboxes)
  - [ ] Moisture content filter (range checkboxes)
  - [ ] Finish type filter (checkbox list)
  - [ ] FSC certification filter (yes/no toggle)

- [ ] Task 3: Create Filter Configuration (AC: #1)
  - [ ] Create `src/config/product-filters.ts`
  - [ ] Define all filter options with labels
  - [ ] Include translation keys
  - [ ] Define default values

- [ ] Task 4: Implement Filter State Management (AC: #4, #5)
  - [ ] Use URL search params for state
  - [ ] Create useProductFilters hook
  - [ ] Implement debounced updates (500ms)
  - [ ] Parse/serialize filter state to URL

- [ ] Task 5: Add Active Filter Badges (AC: #2)
  - [ ] Count active filters per group
  - [ ] Display badge next to group title
  - [ ] Update on filter change

- [ ] Task 6: Implement Clear Filters (AC: #3)
  - [ ] Add "Clear all filters" button
  - [ ] Reset all filters to default
  - [ ] Clear URL parameters

- [ ] Task 7: Ensure Accessibility (AC: #6)
  - [ ] Keyboard navigation for all controls
  - [ ] Proper aria labels
  - [ ] Focus management
  - [ ] Screen reader support

## Dev Notes

### Filter Configuration

```typescript
// src/config/product-filters.ts
export const productFilters = {
  species: {
    key: 'species',
    labelKey: 'filters.species.label',
    type: 'checkbox',
    options: [
      { value: 'oak', labelKey: 'filters.species.oak' },
      { value: 'ash', labelKey: 'filters.species.ash' },
      // ... more species
    ],
  },
  width: {
    key: 'width',
    labelKey: 'filters.width.label',
    type: 'range',
    options: [
      { value: '100-200', labelKey: 'filters.width.100-200' },
      { value: '200-300', labelKey: 'filters.width.200-300' },
      { value: '300-400', labelKey: 'filters.width.300-400' },
      { value: '400+', labelKey: 'filters.width.400+' },
    ],
  },
  thickness: {
    key: 'thickness',
    labelKey: 'filters.thickness.label',
    type: 'checkbox',
    options: [
      { value: '18', labelKey: '18mm' },
      { value: '20', labelKey: '20mm' },
      { value: '22', labelKey: '22mm' },
      { value: '26', labelKey: '26mm' },
      { value: '30', labelKey: '30mm' },
      { value: '40', labelKey: '40mm' },
    ],
  },
  type: {
    key: 'type',
    labelKey: 'filters.type.label',
    type: 'checkbox',
    options: [
      { value: 'FJ', labelKey: 'filters.type.fj' },
      { value: 'FS', labelKey: 'filters.type.fs' },
    ],
  },
  qualityGrade: {
    key: 'qualityGrade',
    labelKey: 'filters.qualityGrade.label',
    type: 'checkbox',
    options: [
      { value: 'A', labelKey: 'Grade A' },
      { value: 'AB', labelKey: 'Grade AB' },
      { value: 'B', labelKey: 'Grade B' },
      { value: 'C', labelKey: 'Grade C' },
    ],
  },
  fscCertified: {
    key: 'fscCertified',
    labelKey: 'filters.fsc.label',
    type: 'toggle',
    options: [
      { value: 'true', labelKey: 'filters.fsc.yes' },
    ],
  },
} as const
```

### useProductFilters Hook

```typescript
// src/hooks/useProductFilters.ts
'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback, useMemo, useTransition } from 'react'
import { useDebouncedCallback } from 'use-debounce'

export function useProductFilters() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const filters = useMemo(() => ({
    species: searchParams.getAll('species'),
    width: searchParams.getAll('width'),
    thickness: searchParams.getAll('thickness'),
    type: searchParams.getAll('type'),
    qualityGrade: searchParams.getAll('qualityGrade'),
    fscCertified: searchParams.get('fscCertified') === 'true',
    // ... more filters
  }), [searchParams])

  const updateFilter = useDebouncedCallback((key: string, values: string[]) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(key)
    values.forEach(v => params.append(key, v))

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }, 300) // 300ms debounce for <500ms NFR5

  const clearFilters = useCallback(() => {
    startTransition(() => {
      router.push(pathname, { scroll: false })
    })
  }, [router, pathname])

  return { filters, updateFilter, clearFilters, isPending }
}
```

### Component Structure

```tsx
'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useProductFilters } from '@/hooks/useProductFilters'
import { productFilters } from '@/config/product-filters'

export function ProductFilter() {
  const { filters, updateFilter, clearFilters } = useProductFilters()

  const activeCount = Object.values(filters).flat().filter(Boolean).length

  return (
    <div className="bg-white rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg">Filters</h2>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all ({activeCount})
          </Button>
        )}
      </div>

      <Accordion type="multiple" defaultValue={['species', 'type']}>
        {Object.entries(productFilters).map(([key, config]) => (
          <FilterSection
            key={key}
            config={config}
            values={filters[key]}
            onChange={(values) => updateFilter(key, values)}
          />
        ))}
      </Accordion>
    </div>
  )
}
```

### Performance Requirements

- NFR5: Filter application in catalog < 500ms
- Use URL state for shareability
- Debounce filter updates to prevent excessive re-renders

### Accessibility

- All checkboxes keyboard accessible
- Accordion sections navigable with Enter/Space
- aria-expanded on accordion triggers
- Form labels associated with inputs

### References

- [Source: _bmad-output/planning-artifacts/prd.md#FR7-FR13]
- [Source: _bmad-output/planning-artifacts/architecture.md#State-Management]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Filter-Panel]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
