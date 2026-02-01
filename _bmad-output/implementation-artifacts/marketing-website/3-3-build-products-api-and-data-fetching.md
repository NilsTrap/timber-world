# Story 3.3: Build Products API and Data Fetching

Status: ready-for-dev

## Story

As a **developer**,
I want **an API endpoint for fetching filtered products**,
So that **the catalog can display products based on user selections**.

## Acceptance Criteria

1. **Given** the products table exists with sample data, **When** GET /api/products is called, **Then** it returns products matching the provided filter query parameters

2. **Given** the API is called, **Then** the response includes: id, sku, species, dimensions, quality_grade, type, moisture_content, finish, fsc_certified, unit_price_m3, unit_price_piece, unit_price_m2, stock_quantity, stock_status

3. **Given** the API is called with pagination, **Then** pagination is supported via `page` and `pageSize` parameters

4. **Given** the API is called with sorting, **Then** sorting is supported via `sortBy` and `sortOrder` parameters

5. **Given** the API response, **Then** the response follows the standard API format: `{ data: Product[], meta: { total, page, pageSize } }`

6. **Given** frequent catalog queries, **Then** database queries are optimized with appropriate indexes (NFR23)

7. **Given** public API access, **Then** rate limiting is applied to prevent abuse (NFR17)

8. **Given** the products table, **Then** seed data includes at least 20 sample products for testing

## Tasks / Subtasks

- [ ] Task 1: Create Products API Route (AC: #1, #2, #5)
  - [ ] Create `src/app/api/products/route.ts`
  - [ ] Implement GET handler
  - [ ] Parse query parameters for filters
  - [ ] Return standardized response format

- [ ] Task 2: Implement Filter Logic (AC: #1)
  - [ ] Filter by species (multiple values)
  - [ ] Filter by width range
  - [ ] Filter by length range
  - [ ] Filter by thickness (multiple values)
  - [ ] Filter by quality grade (multiple values)
  - [ ] Filter by type (FJ/FS)
  - [ ] Filter by moisture content range
  - [ ] Filter by finish type
  - [ ] Filter by FSC certification

- [ ] Task 3: Implement Pagination (AC: #3)
  - [ ] Accept `page` parameter (default: 1)
  - [ ] Accept `pageSize` parameter (default: 20, max: 100)
  - [ ] Calculate offset and limit
  - [ ] Return total count in meta

- [ ] Task 4: Implement Sorting (AC: #4)
  - [ ] Accept `sortBy` parameter
  - [ ] Accept `sortOrder` parameter (asc/desc)
  - [ ] Support sorting by: price, name, stock_status, created_at
  - [ ] Default sort: created_at desc

- [ ] Task 5: Add Database Indexes (AC: #6)
  - [ ] Create index on species
  - [ ] Create index on stock_status
  - [ ] Create composite index for common filter combinations
  - [ ] Add to migration file

- [ ] Task 6: Implement Rate Limiting (AC: #7)
  - [ ] Add rate limiting middleware
  - [ ] Configure limits (e.g., 100 requests/minute)
  - [ ] Return 429 on limit exceeded

- [ ] Task 7: Create Seed Data (AC: #8)
  - [ ] Create `supabase/seed.sql`
  - [ ] Add 20+ sample products
  - [ ] Include variety of species, sizes, grades
  - [ ] Include different stock statuses

- [ ] Task 8: Create TypeScript Types
  - [ ] Define Product type
  - [ ] Define ProductFilter type
  - [ ] Define API response types

## Dev Notes

### API Route Implementation

```typescript
// src/app/api/products/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { productFilterSchema } from '@/lib/validations/product'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  // Parse and validate filters
  const filters = {
    species: searchParams.getAll('species'),
    width: searchParams.getAll('width'),
    thickness: searchParams.getAll('thickness'),
    type: searchParams.getAll('type'),
    qualityGrade: searchParams.getAll('qualityGrade'),
    fscCertified: searchParams.get('fscCertified'),
    page: Number(searchParams.get('page')) || 1,
    pageSize: Math.min(Number(searchParams.get('pageSize')) || 20, 100),
    sortBy: searchParams.get('sortBy') || 'created_at',
    sortOrder: searchParams.get('sortOrder') || 'desc',
  }

  const supabase = await createClient()

  // Build query
  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })

  // Apply filters
  if (filters.species.length > 0) {
    query = query.in('species', filters.species)
  }

  if (filters.thickness.length > 0) {
    query = query.in('thickness', filters.thickness.map(Number))
  }

  if (filters.type.length > 0) {
    query = query.in('type', filters.type)
  }

  if (filters.qualityGrade.length > 0) {
    query = query.in('quality_grade', filters.qualityGrade)
  }

  if (filters.fscCertified === 'true') {
    query = query.eq('fsc_certified', true)
  }

  // Apply sorting
  query = query.order(filters.sortBy, {
    ascending: filters.sortOrder === 'asc'
  })

  // Apply pagination
  const from = (filters.page - 1) * filters.pageSize
  const to = from + filters.pageSize - 1
  query = query.range(from, to)

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json(
      { error: { message: 'Failed to fetch products', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    )
  }

  return NextResponse.json({
    data,
    meta: {
      total: count || 0,
      page: filters.page,
      pageSize: filters.pageSize,
    }
  })
}
```

### Product Type Definition

```typescript
// src/types/product.ts
export interface Product {
  id: string
  sku: string
  species: string
  width: number
  length: number
  thickness: number
  quality_grade: string
  type: 'FJ' | 'FS'
  moisture_content: number
  finish: string | null
  fsc_certified: boolean
  unit_price_m3: number
  unit_price_piece: number
  unit_price_m2: number
  stock_quantity: number
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock'
  created_at: string
  updated_at: string
}

export interface ProductFilters {
  species?: string[]
  width?: string[]
  thickness?: string[]
  type?: string[]
  qualityGrade?: string[]
  fscCertified?: boolean
}

export interface ProductsResponse {
  data: Product[]
  meta: {
    total: number
    page: number
    pageSize: number
  }
}
```

### Seed Data Example

```sql
-- supabase/seed.sql
INSERT INTO products (sku, species, width, length, thickness, quality_grade, type, moisture_content, finish, fsc_certified, unit_price_m3, unit_price_piece, unit_price_m2, stock_quantity, stock_status) VALUES
('OAK-FJ-2040-A', 'oak', 200, 4000, 20, 'A', 'FJ', 8.5, 'unfinished', true, 280000, 4480, 3500, 150, 'in_stock'),
('OAK-FS-3040-AB', 'oak', 300, 4000, 26, 'AB', 'FS', 9.0, 'oiled', false, 320000, 9984, 4000, 45, 'in_stock'),
('OAK-FJ-2540-B', 'oak', 250, 4000, 22, 'B', 'FJ', 8.0, 'unfinished', true, 240000, 5280, 3000, 8, 'low_stock'),
-- ... more products
```

### Database Indexes

```sql
-- Add to migration
CREATE INDEX idx_products_species ON products(species);
CREATE INDEX idx_products_type ON products(type);
CREATE INDEX idx_products_stock_status ON products(stock_status);
CREATE INDEX idx_products_quality_grade ON products(quality_grade);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
```

### Rate Limiting

Consider using:
- Vercel Edge Middleware with rate limiting
- Or implement simple in-memory rate limiting for MVP
- Target: 100 requests per minute per IP

### References

- [Source: _bmad-output/planning-artifacts/marketing-website/architecture.md#API-Patterns]
- [Source: _bmad-output/planning-artifacts/marketing-website/architecture.md#Data-Architecture]
- [Source: _bmad-output/planning-artifacts/marketing-website/prd.md#NFR17-NFR23]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### File List
