---
project_name: 'Timber-World-Platform'
user_name: 'Nils'
date: '2026-01-21'
status: 'complete'
sections_completed: ['technology_stack', 'permissions', 'server_actions', 'multi_tenant', 'data_transform', 'supabase', 'react_nextjs', 'file_organization', 'naming', 'i18n', 'testing', 'critical_rules', 'realtime']
architecture_ref: '_bmad-output/planning-artifacts/architecture.md'
---

# Project Context for AI Agents

_Critical rules and patterns for implementing code in the Timber World Platform. Focus on unobvious details that agents might miss._

---

## Technology Stack & Versions

| Technology | Version | Critical Notes |
|------------|---------|----------------|
| Next.js | 16.1.1 | App Router, Turbopack, Server Components default |
| React | 19.2.3 | Server Components - no "use client" unless needed |
| TypeScript | 5.x | Strict mode - no `any` types |
| Tailwind CSS | 4.x | Utility-first, no inline styles |
| Supabase | Latest | PostgreSQL + Auth + RLS + Realtime + Storage |
| shadcn/ui | Latest | Radix primitives, accessible by default |
| React Hook Form | 7.70.0 | Always pair with Zod validation |
| Zod | Latest | Runtime validation required on all inputs |
| next-intl | 4.7.0 | All user text must use translations |
| Resend | Latest | Transactional email |
| @react-pdf/renderer | Latest | PDF generation |

## Critical Implementation Rules

### Permission Checking (MANDATORY)

Every Server Action MUST check permissions at the start:

```typescript
export async function updateOrder(orderId: string, data: UpdateOrderInput) {
  const { user, hasFunction } = await getAuthContext()

  if (!user) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" }
  }

  if (!hasFunction("orders.edit")) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" }
  }

  // Only then proceed with business logic...
}
```

### Server Action Return Type (MANDATORY)

All Server Actions MUST return this exact shape:

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }
```

### Multi-Tenant Data Isolation (MANDATORY)

- Every table has `organization_id` column
- Supabase RLS filters ALL queries by organization
- Never query without RLS - it's your security layer
- Admin users (Timber World staff) have cross-org access via RLS policies

### Data Transformation (MANDATORY)

- Database uses `snake_case` (Supabase/PostgreSQL)
- TypeScript uses `camelCase`
- Transform at data layer boundary in `@timber/database`
- Never mix cases in the same layer

### Supabase Client Usage

```typescript
// Browser/Client Components
import { createClient } from '@/lib/supabase/client'

// Server Components/Server Actions
import { createClient } from '@/lib/supabase/server'

// NEVER import from '@supabase/supabase-js' directly
```

### React/Next.js Rules

- **Server Components by default** - Only add `"use client"` for hooks, events, browser APIs
- **Never add "use client" to page.tsx** - Only to specific components that need it
- **URL state for filters** - Use `searchParams` for filter/sort state, not useState
- **Loading states** - Use `loading.tsx` for Suspense, `useTransition` for mutations
- **Errors** - Toast notifications via sonner for user errors, error boundaries for unexpected

### File Organization

```
apps/portal/src/features/{feature-name}/
├── components/     # Feature-specific components
├── actions/        # Server Actions (one per file)
├── hooks/          # Feature hooks
└── types.ts        # Feature types
```

- Co-locate tests: `ComponentName.test.tsx` next to `ComponentName.tsx`
- Shared UI: Import from `@timber/ui`
- Shared portal components: `src/components/`

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| DB tables | snake_case plural | `client_orders` |
| DB columns | snake_case | `organization_id` |
| Components | PascalCase | `OrderList.tsx` |
| Hooks/utils | camelCase | `usePermissions.ts` |
| Server Actions | camelCase | `createOrder.ts` |
| API routes | kebab-case | `/api/pdf/generate-quote` |
| JSON fields | camelCase | `{ orderId, createdAt }` |

### i18n Rules (next-intl)

- All user-facing strings MUST use `useTranslations()`
- Never hardcode text - even "Loading...", "Save", "Cancel"
- Translation keys: dot notation `"orders.status.pending"`
- Default locale: `en`

### Testing Rules

- Co-locate tests with source files
- Mock Supabase client - never hit real database
- Test Server Actions with permission scenarios
- Test both success and error paths

## Critical Don't-Miss Rules

**NEVER:**
- Skip permission check in Server Actions
- Query database without RLS (organization isolation)
- Use `any` or `// @ts-ignore`
- Import Supabase client directly from package
- Hardcode user-facing text
- Add `"use client"` to page files
- Store secrets in code - use environment variables
- Skip Zod validation on form inputs

**ALWAYS:**
- Check `hasFunction()` before operations
- Return `ActionResult<T>` from Server Actions
- Transform snake_case → camelCase at data boundary
- Use `@timber/*` shared packages
- Handle loading states (Skeleton, isPending)
- Handle errors with toast notifications
- Use `next/image` for all images
- Add aria-labels for accessibility

## Real-Time Patterns

For inventory, orders, production status:

```typescript
// Subscribe to organization-specific changes
const { data } = useRealtimeSubscription('inventory', {
  filter: `organization_id=eq.${orgId}`,
  event: '*'
})
```

- Subscribe only to relevant data (don't subscribe to all tables)
- Handle connection drops gracefully
- Use optimistic updates for better UX

## Standard Inventory/Package Table Pattern

All tables displaying inventory packages (shipments, production, inventory overview, etc.) MUST use the `DataEntryTable` component from `@timber/ui` with the same column structure. Use `readOnly` prop for non-editable views.

### Standard Column Order (MANDATORY)

When displaying package data, always use these columns in this order:

| # | Column | Type | Notes |
|---|--------|------|-------|
| 1 | Shipment | readonly | `shipment_code` |
| 2 | Package | readonly | `package_number`, totalType: "count" |
| 3 | Product | dropdown, collapsible | `ref_product_names` |
| 4 | Species | dropdown, collapsible | `ref_wood_species` |
| 5 | Humidity | dropdown, collapsible | `ref_humidity` |
| 6 | Type | dropdown, collapsible | `ref_types` |
| 7 | Processing | dropdown, collapsible | `ref_processing` |
| 8 | FSC | dropdown, collapsible | `ref_fsc` |
| 9 | Quality | dropdown, collapsible | `ref_quality` |
| 10 | Thickness | text | placeholder "mm" |
| 11 | Width | text | placeholder "mm" |
| 12 | Length | text | placeholder "mm" |
| 13 | Pieces | text, numeric | totalType: "sum" |
| 14 | Vol m³ | custom/numeric | Auto-calculated or manual, totalType: "sum" |

### Editable Table (DataEntryTable)

Use `DataEntryTable<PackageRow>` from `@timber/ui` for any view where users can add/edit/delete packages:
- New Shipment form
- Shipment Detail edit view
- Production input (future)

Key props: `columns`, `rows`, `onRowsChange`, `createRow`, `copyRow`, `renumberRows`, `onCellChange`

### Read-Only Table (DataEntryTable with `readOnly`)

For overview/list views, use `DataEntryTable` with the `readOnly` prop:
- `<DataEntryTable<PackageListItem> columns={...} rows={data} getRowKey={(r) => r.id} readOnly />`
- `createRow`, `copyRow`, `onRowsChange` props are optional in readOnly mode
- For dropdown columns: set `type: "dropdown"`, `collapsible: true`, `getValue` returns resolved display string (no `options` array needed)
- Retains: collapsible columns, sort/filter menus, totals footer
- Hides: add button, copy/delete actions, input fields
- Sort is display-only (doesn't mutate source data)
- Display "—" for null/empty values, volume to 3 decimal places

### Reference Data (7 Dropdowns)

All 7 dropdown columns reference admin-managed tables (`ref_*`). When querying:
- Use explicit FK names: `ref_product_names!inventory_packages_product_name_id_fkey(value)`
- Fetch active options only for edit forms: `.eq("is_active", true).order("sort_order")`
- For read-only display, resolve UUID → display value via FK join

### Volume Calculation

Volume auto-calculates when all conditions are met:
- Thickness, Width, Length are all single numbers (not ranges like "40-50")
- Pieces is a positive number (not "-")
- Formula: `(thickness × width × length × pieces) / 1,000,000,000` (mm³ → m³)
- When conditions aren't met, user enters volume manually
- Display format: Latvian locale with 3 decimal places (`0,000`) for both input and display

## Architecture Reference

For complete architectural decisions, patterns, and project structure, see:
`_bmad-output/planning-artifacts/architecture.md`
