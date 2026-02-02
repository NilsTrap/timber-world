---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - '_bmad-output/planning-artifacts/platform/prd.md'
  - '_bmad-output/planning-artifacts/product-brief-Timber-World-2026-01-20.md'
  - '_bmad-output/analysis/platform-deep-analysis-2026-01-20.md'
  - '_bmad-output/analysis/platform-vision-capture-2026-01-20.md'
  - '_bmad-output/analysis/brainstorming-platform-multitenancy-2026-01-25.md'
workflowType: 'architecture'
project_name: 'Timber-World'
user_name: 'Nils'
date: '2026-01-21'
status: 'complete'
completedAt: '2026-01-21'
lastAddendum: '2026-02-01'
addendumNotes: 'Platform Multi-Tenant Architecture v2 Addendum added'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
158 requirements across 14 capability areas:

| Area | FRs | Architectural Impact |
|------|-----|---------------------|
| User Management & Auth | FR1-FR19 | Complex RBAC with function toggles, multi-role users |
| Organization Management | FR20-FR29 | Multi-tenant with strict isolation |
| Inventory Management | FR30-FR39 | Real-time tracking across ALL locations, threshold alerts |
| Production Management | FR40-FR52 | Transformation model (input→output), efficiency calculations |
| Order Management | FR53-FR64 | Multi-stage lifecycle, assignment to production |
| Sales & CRM | FR65-FR77 | Full CRM replacing Pipedrive, quote→order conversion |
| Procurement & Purchasing | FR78-FR87 | PO management, supplier performance tracking |
| Supplier Portal | FR88-FR95 | External party self-service with isolation |
| Document Management | FR96-FR104 | Upload, generate, template management |
| Communication & Notifications | FR105-FR115 | In-app messaging, email notifications, preferences |
| Reporting & Analytics | FR116-FR128 | Dashboards, KPIs, audit trail, exports |
| System Administration | FR129-FR138 | Permission matrix, workflow rules, API management |
| Automation (Phase 4+) | FR139-FR148 | Workflow triggers, document generation, AI assistance |
| API & Integration | FR149-FR158 | RESTful API, OAuth, versioning, rate limiting |

**Non-Functional Requirements:**

| Category | Key Requirements | Architectural Impact |
|----------|-----------------|---------------------|
| **Performance** | Page <3s, API <500ms, real-time <2s | Edge deployment, optimistic updates, Supabase realtime |
| **Security** | Row-level security, TLS 1.3, GDPR, MFA | Supabase RLS, audit logging, data export capability |
| **Scalability** | 500+ orgs, 2000+ users, 100k+ orders/year | Horizontal scaling, efficient queries, caching |
| **Reliability** | 99.5% uptime, daily backups, <4h recovery | Managed services, automated backups |
| **Accessibility** | Mobile responsive, WCAG AA, 44px touch | Responsive design, semantic HTML, ARIA |
| **Integration** | RESTful API, webhooks, versioned endpoints | API-first architecture, event system |

**Scale & Complexity:**

- Primary domain: B2B SaaS Platform (Supply Chain / Manufacturing)
- Complexity level: Medium-High
- Estimated architectural components: ~20-25 (auth, RBAC, 6 role views, inventory, production, orders, CRM, documents, notifications, reporting, API)

### Technical Constraints & Dependencies

**Existing Infrastructure (Must Work With):**
- Turborepo monorepo structure at project root
- Shared packages: `@timber/ui`, `@timber/auth`, `@timber/database`, `@timber/config`, `@timber/utils`
- Supabase project (database + auth)
- Marketing app at `apps/marketing/` (Next.js)

**Required External Integrations:**
1. **Supabase** - Database, Auth, Realtime, Storage (already in use)
2. **Email Service** - Transactional emails, notifications
3. **Gmail API** - CRM email integration (Phase 3)
4. **PDF Generation** - Quotes, POs, invoices

**Data Dependencies:**
- Hub-and-spoke model: All parties connect through Timber World, never directly
- Inventory must be accurate within same day across all locations
- Production efficiency requires input/output/waste tracking

**Deployment Constraints:**
- EU data residency preferred (GDPR)
- Zero-downtime deployments required
- Must support 100+ concurrent users

### Inventory Location Model

**Real-time inventory tracked at ALL location types:**

| Location Type | Examples | Ownership |
|---------------|----------|-----------|
| **Timber World Warehouses** | Central warehouse, regional warehouses (multiple countries) | Timber World owned |
| **Supplier Locations** | Each supplier's yard/warehouse | Supplier owned |
| **Producer Facilities** | Each factory's storage area | Producer owned/partner |
| **In Transit** | Trucks between any locations | Tracked during movement |

**Key Characteristics:**
- Multiple Timber World warehouses possible (different locations, different countries)
- Central warehouse has real-time inventory like all other locations
- All locations use the same inventory tracking system
- Movement between ANY locations creates CMR and updates both source/destination

### Cross-Cutting Concerns Identified

1. **Authentication & Session Management**
   - Supabase Auth for all users
   - Session expiry after 24h inactive
   - MFA available for all users

2. **Authorization (RBAC)**
   - Role → Functions → Sub-permissions hierarchy
   - User-level overrides for function access
   - Every API call must check permissions

3. **Multi-Tenant Data Isolation**
   - Row-level security on all tables
   - organization_id filter on every query
   - API tokens scoped to organization

4. **Real-Time Data Sync**
   - Supabase realtime subscriptions
   - Inventory changes propagate <2 seconds
   - Order status updates push to relevant parties

5. **Audit Trail**
   - All data changes logged with user, timestamp, action
   - Required for GDPR compliance
   - Used for debugging and accountability

6. **Document Workflow**
   - Bi-directional: TW sends and receives same document types
   - PDF generation from templates
   - Storage with order/organization association

7. **Notification System**
   - Email for external notifications
   - In-app for real-time alerts
   - User preferences for notification types

## Starter Template Evaluation

### Primary Technology Domain

**Full-stack B2B SaaS Platform** - The portal will be a Next.js application within the existing Turborepo monorepo, sharing packages with the marketing website.

### Starter Approach: Extend Existing Monorepo

Unlike a greenfield project, Timber World has an established infrastructure. Rather than using an external starter template, the portal app will:
- Follow patterns established in `apps/marketing/`
- Reuse all `@timber/*` shared packages
- Maintain consistency across the platform

### Existing Infrastructure (Already Configured)

| Component | Technology | Version | Status |
|-----------|------------|---------|--------|
| Monorepo | Turborepo | 2.3.3 | ✅ Configured |
| Package Manager | pnpm | 9.15.4 | ✅ Configured |
| Framework | Next.js | 16.1.1 | ✅ In use |
| React | React | 19.2.3 | ✅ In use |
| Language | TypeScript | 5.x | ✅ Configured |
| Styling | Tailwind CSS | 4.x | ✅ Configured |
| i18n | next-intl | 4.7.0 | ✅ Configured |
| Forms | React Hook Form | 7.70.0 | ✅ In use |
| UI Components | shadcn/ui | Latest | ✅ Pattern established |
| Database | Supabase | Latest | ✅ In @timber/database |
| Hosting | Vercel | - | ✅ Selected |

### Portal App Architecture

**Location:** `apps/portal/`

**Package Name:** `@timber/portal`

**Purpose:** Unified portal serving all 6 user roles through function-based access control.

```
apps/
├── marketing/           # Public website (existing)
│   └── @timber/marketing
└── portal/              # NEW: Unified B2B portal
    └── @timber/portal
        ├── All user types access same app
        ├── Permission system determines visible functions
        └── Shares UI, auth, database packages
```

### Architectural Decisions Inherited from Monorepo

**Language & Runtime:**
- TypeScript 5.x with strict mode
- Node.js (Vercel serverless)
- React 19 with Server Components

**Styling Solution:**
- Tailwind CSS 4.x
- shadcn/ui components (Radix primitives)
- CSS variables for theming

**Build Tooling:**
- Turbopack for development
- Next.js build optimization
- Turborepo caching across apps

**Code Organization:**
- Next.js App Router with file-based routing
- `src/` directory structure
- Shared packages via workspace imports (`@timber/*`)

**Development Experience:**
- Fast Refresh
- TypeScript strict mode
- ESLint with Next.js rules
- Turborepo watch mode for package changes

### Portal-Specific Setup Required

**New for Portal (not in marketing website):**

| Concern | Solution | Notes |
|---------|----------|-------|
| Complex RBAC | Custom permission system | Role → Function → Sub-permission |
| Real-time updates | Supabase Realtime | Inventory, order status |
| PDF Generation | react-pdf or similar | Quotes, POs, invoices |
| Email integration | Gmail API | CRM feature (Phase 3) |
| Dashboard layouts | Admin template pattern | Sidebar navigation, role-based menus |

### Initialization Command

```bash
# Create portal app structure (within existing monorepo)
mkdir -p apps/portal
cd apps/portal

# Initialize with Next.js (matching marketing website pattern)
pnpm create next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --turbopack

# Update package.json name to @timber/portal
# Add workspace dependencies: @timber/ui, @timber/auth, @timber/database, @timber/config, @timber/utils
```

**Note:** First implementation story should set up the portal app structure and verify it works within the monorepo.

## Core Architectural Decisions

### Decision Summary

| Category | Decision | Rationale |
|----------|----------|-----------|
| **Database** | Supabase (PostgreSQL) | Already in use, managed service with Auth + Realtime + Storage |
| **Auth** | Supabase Auth | Built-in with database, supports MFA, integrates with RLS |
| **API Patterns** | Hybrid approach | Server Actions for mutations, Supabase client for queries, API Routes for integrations |
| **Email** | Resend | Modern API, React Email templates, good free tier |
| **PDF Generation** | @react-pdf/renderer | React-based, runs on Vercel serverless |
| **Real-time** | Supabase Realtime | Built-in, selective subscriptions per organization |
| **Monitoring** | Vercel built-ins | Start simple, add Sentry if needed |
| **UI Components** | shadcn/ui | Consistent with marketing website, accessible, customizable |
| **State** | Server Components + URL state | Minimal complexity, App Router native |
| **Forms** | React Hook Form + Zod | Type-safe validation, already in use |
| **Hosting** | Vercel | Optimal Next.js support, edge functions |

### Data Architecture

**Database: Supabase (PostgreSQL)**
- Managed PostgreSQL with built-in REST and Realtime APIs
- Row Level Security (RLS) for multi-tenant data isolation
- Supabase Storage for document uploads (invoices, CMRs, photos)
- Database functions for complex calculations (efficiency, inventory)

**Key Schema Design Principles:**
- All tables include `organization_id` for tenant isolation
- Soft deletes with `deleted_at` timestamp for audit trail
- `created_at`, `updated_at`, `created_by`, `updated_by` on all tables
- UUID primary keys for all entities
- Foreign keys with appropriate cascade rules

**Data Models Required:**

| Domain | Tables |
|--------|--------|
| **Organizations** | organizations, locations, organization_settings |
| **Users & Auth** | users, roles, functions, user_roles, user_function_overrides |
| **Inventory** | products, inventory, inventory_movements, locations |
| **Production** | production_orders, production_jobs, material_consumption, production_output |
| **Orders** | client_orders, order_lines, supplier_orders (purchase_orders) |
| **CRM** | deals, contacts, companies, activities, pipeline_stages |
| **Documents** | documents, document_templates |
| **Communication** | messages, notifications, notification_preferences |
| **Audit** | audit_logs |

### Authentication & Security

**Authentication: Supabase Auth**
- Email/password authentication for all users
- MFA available (TOTP) for enhanced security
- Session management with 24h expiry
- Password reset via email
- Per-window session verification (requires login for each new browser window/tab via sessionStorage)

**Authorization: Custom RBAC System**

```
User
├── belongs to Organization
├── has Roles (client, supplier, producer, sales, purchase, admin)
│   └── each Role has default Functions enabled
└── has Function Overrides (user-specific enable/disable)
```

**Row Level Security (RLS):**
- Every table has RLS policies
- Policies filter by `organization_id` from JWT claims
- Admin users (Timber World) can access across organizations
- External users (clients, suppliers, producers) see only their org data

**API Security:**
- All API routes verify Supabase session
- Function-level permission checks on every request
- Rate limiting on public endpoints
- Input validation with Zod schemas

### API & Communication Patterns

**Hybrid API Approach:**

| Use Case | Pattern | Example |
|----------|---------|---------|
| Form submissions | Server Actions | Submit quote, create order, update production |
| Data fetching | Direct Supabase client | List orders, get inventory, fetch dashboard data |
| External webhooks | API Routes | Gmail OAuth callback, payment webhooks |
| PDF generation | API Routes | Generate quote PDF, invoice PDF |
| Real-time updates | Supabase Realtime | Inventory changes, order status |

**Server Action Pattern:**
```typescript
// Always return consistent shape
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }
```

**Error Handling:**
- Structured error responses with codes
- User-friendly messages for UI
- Detailed logging for debugging
- Toast notifications via sonner

**Real-time Subscriptions:**
- Subscribe to organization-specific changes
- Inventory updates propagate to all relevant users
- Order status changes notify affected parties
- Graceful fallback if connection drops

### Frontend Architecture

**State Management: Minimal Approach**
- React Server Components for initial data fetching
- URL search params for filter/sort state (shareable, bookmarkable)
- `useState` for local UI interactions only
- Supabase Realtime for live updates
- No global state library needed initially

**Component Architecture:**
- Feature-based organization (`/features/inventory/`, `/features/orders/`)
- Shared UI components from `@timber/ui`
- Role-specific layouts with permission-based rendering
- Compound components for complex UI patterns

**Dashboard Layout Pattern (Implemented):**

The portal uses a **collapsible left sidebar** navigation:

```
┌────────────┬────────────────────────────────────────────────┐
│            │                                                │
│  Sidebar   │  Main Content Area                            │
│  ┌──────┐  │                                                │
│  │ Logo │  │  - Page content based on current function     │
│  ├──────┤  │  - Role-based navigation items                │
│  │ Nav  │  │  - Action buttons context-aware               │
│  │ Items│  │                                                │
│  ├──────┤  │                                                │
│  │Profile│ │                                                │
│  │Logout │ │                                                │
│  ├──────┤  │                                                │
│  │Toggle│  │                                                │
│  └──────┘  │                                                │
└────────────┴────────────────────────────────────────────────┘
```

**Sidebar Features:**
- Collapsible: Icons only (64px) or icons + labels (256px)
- Collapse state persisted to localStorage
- Role-based navigation items (Admin sees different items than Producer)
- Profile and Logout in sidebar footer
- Toggle button at bottom

**Components:**
- `Sidebar.tsx` - Main collapsible client component
- `SidebarLink.tsx` - Navigation link with icon support
- `SidebarWrapper.tsx` - Server component for session/role

**Route Structure:**
```
apps/portal/src/app/
├── (auth)/
│   ├── login/
│   └── forgot-password/
├── (portal)/           # Authenticated routes
│   ├── layout.tsx      # Dashboard layout with sidebar
│   ├── dashboard/      # Role-specific dashboard
│   ├── inventory/      # Inventory management
│   ├── orders/         # Order management
│   ├── production/     # Production tracking
│   ├── quotes/         # Quote management (CRM)
│   ├── suppliers/      # Supplier management
│   ├── clients/        # Client management
│   ├── documents/      # Document management
│   ├── settings/       # User & org settings
│   └── admin/          # Admin-only functions
└── api/
    ├── pdf/            # PDF generation endpoints
    ├── webhooks/       # External webhooks
    └── auth/           # Auth callbacks
```

### Infrastructure & Deployment

**Hosting: Vercel**
- Automatic deployments from Git
- Preview deployments for PRs
- Edge network for global performance
- Serverless functions for API routes
- Built-in analytics and logging

**CI/CD: Vercel Git Integration**
- Push to `main` → Production deployment
- Push to feature branch → Preview deployment
- Automatic Lighthouse checks
- TypeScript and ESLint checks in build

**Environment Configuration:**
- Production secrets in Vercel dashboard
- Preview environments use staging Supabase
- `.env.local` for local development
- Separate Supabase projects: dev / staging / production

**Monitoring:**
- Vercel Analytics for performance and traffic
- Vercel Logs for request/error logging
- Supabase Dashboard for database monitoring
- Sentry (future) for detailed error tracking if needed

### Technology Version Summary

| Technology | Version | Notes |
|------------|---------|-------|
| Next.js | 16.1.1 | App Router, Turbopack |
| React | 19.2.3 | Server Components |
| TypeScript | 5.x | Strict mode |
| Tailwind CSS | 4.x | Utility-first |
| Supabase | Latest | Database + Auth + Realtime + Storage |
| shadcn/ui | Latest | Component library |
| React Hook Form | 7.70.0 | Form handling |
| Zod | Latest | Schema validation |
| next-intl | 4.7.0 | i18n |
| Resend | Latest | Email |
| @react-pdf/renderer | Latest | PDF generation |

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database (PostgreSQL/Supabase):**

| Element | Convention | Example |
|---------|------------|---------|
| Tables | snake_case, plural | `organizations`, `user_roles` |
| Columns | snake_case | `organization_id`, `created_at` |
| Foreign keys | `{table}_id` | `organization_id`, `user_id` |
| Indexes | `idx_{table}_{columns}` | `idx_orders_organization_id` |
| Enums | snake_case | `order_status`, `user_role_type` |

**TypeScript/React:**

| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `OrderList`, `InventoryCard` |
| Files (components) | PascalCase.tsx | `OrderList.tsx` |
| Files (utils/hooks) | camelCase.ts | `usePermissions.ts`, `formatDate.ts` |
| Functions | camelCase | `getOrderById`, `formatCurrency` |
| Variables | camelCase | `currentUser`, `orderStatus` |
| Constants | SCREAMING_SNAKE | `MAX_RETRY_COUNT`, `API_TIMEOUT` |
| Types/Interfaces | PascalCase | `Order`, `UserWithRoles` |

**API/JSON:**

| Element | Convention | Example |
|---------|------------|---------|
| JSON fields | camelCase | `{ organizationId, createdAt }` |
| URL paths | kebab-case | `/api/pdf/generate-quote` |
| Query params | camelCase | `?organizationId=123&status=active` |

**Data Transformation:**
Supabase returns snake_case from database. Transform at the data layer in `@timber/database`:
```typescript
// Transform once at the boundary
const order = transformKeys(rawOrder, 'camelCase')
```

### File Structure Patterns

**Feature-Based Organization:**

```
apps/portal/src/
├── app/                    # Next.js App Router routes
├── features/               # Domain logic by feature
│   ├── inventory/
│   │   ├── components/     # Feature-specific components
│   │   ├── actions/        # Server Actions
│   │   ├── hooks/          # Feature hooks
│   │   ├── types.ts        # Feature types
│   │   └── utils.ts        # Feature utilities
│   ├── orders/
│   ├── production/
│   └── ...
├── components/             # Shared app components (layouts, navigation)
├── lib/                    # Shared utilities
│   ├── permissions.ts      # Permission checking
│   ├── supabase/           # Supabase client setup
│   └── utils/              # General utilities
└── types/                  # Shared types
```

**Co-located Tests:**
```
features/inventory/
├── components/
│   ├── InventoryTable.tsx
│   └── InventoryTable.test.tsx  # Co-located with component
├── actions/
│   ├── updateStock.ts
│   └── updateStock.test.ts      # Co-located with action
```

### API Response Patterns

**Server Action Results:**
```typescript
// Consistent return type for all Server Actions
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }

// Usage example
export async function createOrder(data: CreateOrderInput): Promise<ActionResult<Order>> {
  // ...
  return { success: true, data: order }
  // or
  return { success: false, error: "Insufficient inventory", code: "INSUFFICIENT_STOCK" }
}
```

**API Route Responses (for external integrations):**
```typescript
// Success
{ data: T, meta?: { page, total } }

// Error
{ error: { message: string, code: string, details?: unknown } }
```

### Permission Checking Pattern

**Server Actions - Always check at the start:**
```typescript
export async function updateOrder(orderId: string, data: UpdateOrderInput) {
  const { user, hasFunction } = await getAuthContext()

  if (!user) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" }
  }

  if (!hasFunction("orders.edit")) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" }
  }

  // Proceed with update...
}
```

**UI Components - Use permission hook:**
```typescript
const { hasFunction, hasRole } = usePermissions()

// Conditionally render based on permissions
{hasFunction("orders.create") && <CreateOrderButton />}
```

### Error Handling Pattern

**User-facing errors via toast (sonner):**
```typescript
// In client components after Server Action
const result = await createOrder(data)
if (result.success) {
  toast.success("Order created")
  router.push(`/orders/${result.data.id}`)
} else {
  toast.error(result.error)
}
```

**Unexpected errors via error boundaries:**
```typescript
// In layout.tsx - catch unexpected errors
<ErrorBoundary fallback={<ErrorPage />}>
  {children}
</ErrorBoundary>
```

### Loading State Pattern

**Server Components - Suspense with loading.tsx:**
```
app/(portal)/orders/
├── page.tsx          # Async server component
├── loading.tsx       # Shows while page loads
└── error.tsx         # Shows on error
```

**Client mutations - useTransition:**
```typescript
const [isPending, startTransition] = useTransition()

function handleSubmit() {
  startTransition(async () => {
    await createOrder(data)
  })
}

// isPending controls button disabled state
<Button disabled={isPending}>
  {isPending ? "Saving..." : "Save"}
</Button>
```

### Standard Package/Inventory Table Pattern (MANDATORY)

All tables displaying package or inventory data (shipments, production inputs/outputs, inventory overview, etc.) MUST use the same column structure and component.

**Standard Column Order (14 columns):**

| # | Column | Type | DB Reference |
|---|--------|------|-------------|
| 1 | Shipment | readonly | `shipments.shipment_code` |
| 2 | Package | readonly | `inventory_packages.package_number` |
| 3 | Product | dropdown, collapsible | `ref_product_names` |
| 4 | Species | dropdown, collapsible | `ref_wood_species` |
| 5 | Humidity | dropdown, collapsible | `ref_humidity` |
| 6 | Type | dropdown, collapsible | `ref_types` |
| 7 | Processing | dropdown, collapsible | `ref_processing` |
| 8 | FSC | dropdown, collapsible | `ref_fsc` |
| 9 | Quality | dropdown, collapsible | `ref_quality` |
| 10 | Thickness | text input | `inventory_packages.thickness` (mm) |
| 11 | Width | text input | `inventory_packages.width` (mm) |
| 12 | Length | text input | `inventory_packages.length` (mm) |
| 13 | Pieces | numeric | `inventory_packages.pieces` |
| 14 | Vol m³ | numeric (auto-calc or manual) | `inventory_packages.volume_m3` |

**Editable Views — Use `DataEntryTable<PackageRow>` from `@timber/ui`:**
- New Shipment creation
- Shipment Detail edit
- Production output entry
- Any future package editing form

Features: collapsible dropdown columns, keyboard navigation (Tab/Arrow/Enter), row copy/delete, built-in sort/filter menus via ColumnHeaderMenu, totals footer (count for packages, sum for pieces/volume), volume auto-calculation.

**Read-Only Views — Use `DataEntryTable` with `readOnly` prop:**
- Admin Inventory Overview (Inventory tab)
- Producer Inventory table
- Any future read-only package list

Usage: `<DataEntryTable<PackageListItem> columns={...} rows={data} getRowKey={(r) => r.id} readOnly />`

The `readOnly` prop:
- Hides Add/Copy/Delete buttons and Actions column
- Renders all cells as plain text (resolved display values, not inputs/dropdowns)
- Retains collapsible columns (click header to collapse/expand)
- Retains built-in sort/filter menus (sort is display-only, doesn't mutate source data)
- Retains totals footer
- `createRow`, `copyRow`, `onRowsChange` props become optional

For dropdown columns in readOnly: set `type: "dropdown"` with `collapsible: true` and `getValue` returning the already-resolved display string. No `options` array needed.

**Advanced DataEntryTable Features:**
- **Imperative Handle:** Use `ref` to access `clearFilters()` method for external filter control
- **Filter State Callback:** `onFilterActiveChange` prop notifies when filters are active (for external "Clear Filters" button)
- **Column Width Locking:** Automatically locks column widths on initial render to prevent layout jumping when filtering
- **Ref Forwarding:** Table component forwards refs to inner `<table>` element for DOM access

**Volume Auto-Calculation:**
- Formula: `(thickness × width × length × pieces) / 1,000,000,000` (mm³ → m³)
- Only when all values are single numbers (not ranges like "40-50")
- Only when pieces is a positive number (not "-")
- Display: Latvian locale with comma decimal separator, 3 decimal places (`0,000`) for both input and display

**Date Formatting:**
- All dates use European format: DD.MM.YYYY (e.g., `24.01.2026`)
- Date+time uses: DD.MM.YYYY HH:mm (e.g., `24.01.2026 14:30`)
- Use `formatDate()` / `formatDateTime()` from `@/lib/utils`
- Never use `toLocaleDateString()` or `toLocaleString()` (browser-dependent)

**Reference Data Queries:**
- Always use explicit FK constraint names in Supabase/PostgREST joins
- Pattern: `ref_product_names!inventory_packages_product_name_id_fkey(value)`
- Fetch active options only for edit dropdowns: `.eq("is_active", true).order("sort_order")`

### Pattern Summary

| Area | Pattern |
|------|---------|
| DB naming | snake_case |
| JSON/TypeScript | camelCase (transform at data layer) |
| Component files | PascalCase.tsx |
| Util/hook files | camelCase.ts |
| URL paths | kebab-case |
| File organization | Feature-based with co-located tests |
| Action results | `{ success, data }` or `{ success: false, error }` |
| Permissions | Check at start of every Server Action |
| User errors | Toast notifications |
| Unexpected errors | Error boundaries |
| Loading (server) | Suspense + loading.tsx |
| Loading (client) | useTransition |
| Package/Inventory tables | Standard 14-column layout via DataEntryTable or read-only Table |

### Enforcement Guidelines

**All AI Agents MUST:**
1. Follow naming conventions exactly - no exceptions
2. Check permissions at the start of every Server Action
3. Return consistent ActionResult types from all Server Actions
4. Place feature code in `/features/{feature-name}/`
5. Co-locate tests with the code they test
6. Transform database snake_case to camelCase at the data layer

## Project Structure & Boundaries

### Complete Monorepo Structure

```
timber-world/                           # Turborepo monorepo root
├── .github/
│   └── workflows/
│       └── ci.yml                      # GitHub Actions CI
├── .env.example                        # Environment template
├── .gitignore
├── package.json                        # Root workspace config
├── pnpm-workspace.yaml                 # pnpm workspace definition
├── turbo.json                          # Turborepo configuration
├── tsconfig.json                       # Base TypeScript config
│
├── apps/
│   ├── marketing/                      # Public marketing website (EXISTING)
│   │   └── @timber/marketing
│   │
│   └── portal/                         # NEW: Unified B2B portal
│       ├── package.json                # @timber/portal
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       ├── .env.local
│       ├── .env.example
│       │
│       └── src/
│           ├── app/                    # Next.js App Router
│           │   ├── globals.css
│           │   ├── layout.tsx          # Root layout
│           │   │
│           │   ├── (auth)/             # Public auth routes
│           │   │   ├── login/
│           │   │   │   └── page.tsx
│           │   │   ├── forgot-password/
│           │   │   │   └── page.tsx
│           │   │   └── layout.tsx
│           │   │
│           │   ├── (portal)/           # Authenticated routes
│           │   │   ├── layout.tsx      # Dashboard layout with sidebar
│           │   │   ├── dashboard/
│           │   │   │   ├── page.tsx
│           │   │   │   └── loading.tsx
│           │   │   ├── inventory/
│           │   │   │   ├── page.tsx
│           │   │   │   ├── [id]/
│           │   │   │   │   └── page.tsx
│           │   │   │   └── loading.tsx
│           │   │   ├── orders/
│           │   │   │   ├── page.tsx
│           │   │   │   ├── new/
│           │   │   │   │   └── page.tsx
│           │   │   │   ├── [id]/
│           │   │   │   │   └── page.tsx
│           │   │   │   └── loading.tsx
│           │   │   ├── production/
│           │   │   │   ├── page.tsx
│           │   │   │   ├── [id]/
│           │   │   │   │   └── page.tsx
│           │   │   │   └── loading.tsx
│           │   │   ├── quotes/
│           │   │   │   ├── page.tsx
│           │   │   │   ├── new/
│           │   │   │   │   └── page.tsx
│           │   │   │   └── [id]/
│           │   │   │       └── page.tsx
│           │   │   ├── suppliers/
│           │   │   │   ├── page.tsx
│           │   │   │   └── [id]/
│           │   │   │       └── page.tsx
│           │   │   ├── clients/
│           │   │   │   ├── page.tsx
│           │   │   │   └── [id]/
│           │   │   │       └── page.tsx
│           │   │   ├── documents/
│           │   │   │   └── page.tsx
│           │   │   ├── settings/
│           │   │   │   ├── page.tsx
│           │   │   │   ├── profile/
│           │   │   │   │   └── page.tsx
│           │   │   │   └── organization/
│           │   │   │       └── page.tsx
│           │   │   └── admin/
│           │   │       ├── page.tsx
│           │   │       ├── users/
│           │   │       │   └── page.tsx
│           │   │       ├── roles/
│           │   │       │   └── page.tsx
│           │   │       └── settings/
│           │   │           └── page.tsx
│           │   │
│           │   └── api/
│           │       ├── pdf/
│           │       │   ├── quote/
│           │       │   │   └── route.ts
│           │       │   └── invoice/
│           │       │       └── route.ts
│           │       ├── webhooks/
│           │       │   └── email/
│           │       │       └── route.ts
│           │       └── auth/
│           │           └── callback/
│           │               └── route.ts
│           │
│           ├── features/               # Feature modules
│           │   ├── auth/
│           │   │   ├── components/
│           │   │   ├── actions/
│           │   │   ├── hooks/
│           │   │   └── types.ts
│           │   │
│           │   ├── permissions/
│           │   │   ├── components/
│           │   │   ├── hooks/
│           │   │   ├── lib/
│           │   │   └── types.ts
│           │   │
│           │   ├── inventory/
│           │   │   ├── components/
│           │   │   ├── actions/
│           │   │   ├── hooks/
│           │   │   └── types.ts
│           │   │
│           │   ├── orders/
│           │   │   ├── components/
│           │   │   ├── actions/
│           │   │   ├── hooks/
│           │   │   └── types.ts
│           │   │
│           │   ├── production/
│           │   │   ├── components/
│           │   │   ├── actions/
│           │   │   └── types.ts
│           │   │
│           │   ├── quotes/
│           │   │   ├── components/
│           │   │   ├── actions/
│           │   │   └── types.ts
│           │   │
│           │   ├── crm/
│           │   │   ├── components/
│           │   │   ├── actions/
│           │   │   └── types.ts
│           │   │
│           │   ├── documents/
│           │   │   ├── components/
│           │   │   ├── actions/
│           │   │   └── types.ts
│           │   │
│           │   └── notifications/
│           │       ├── components/
│           │       ├── hooks/
│           │       └── types.ts
│           │
│           ├── components/             # Shared portal components
│           │   ├── layout/
│           │   │   ├── Sidebar.tsx          # Collapsible sidebar (client)
│           │   │   ├── SidebarLink.tsx      # Nav link component
│           │   │   ├── SidebarWrapper.tsx   # Server component for session
│           │   │   ├── TopNav.tsx           # Deprecated (replaced by Sidebar)
│           │   │   └── NavLink.tsx          # Legacy nav link
│           │   ├── data-table/
│           │   │   ├── DataTable.tsx
│           │   │   ├── Pagination.tsx
│           │   │   └── Filters.tsx
│           │   └── forms/
│           │       └── FormField.tsx
│           │
│           ├── lib/                    # Shared utilities
│           │   ├── supabase/
│           │   │   ├── client.ts
│           │   │   └── server.ts
│           │   ├── pdf/
│           │   │   ├── QuoteTemplate.tsx
│           │   │   └── InvoiceTemplate.tsx
│           │   └── utils/
│           │       ├── formatters.ts
│           │       └── validators.ts
│           │
│           ├── types/                  # Shared types
│           │   ├── database.ts
│           │   └── api.ts
│           │
│           └── middleware.ts           # Auth middleware
│
├── packages/                           # Shared packages (EXISTING)
│   ├── ui/                             # @timber/ui - shadcn/ui components
│   ├── auth/                           # @timber/auth - Supabase auth
│   ├── database/                       # @timber/database - Supabase client + types
│   ├── config/                         # @timber/config - Environment + constants
│   └── utils/                          # @timber/utils - Shared utilities
│
└── supabase/                           # Database (EXISTING)
    ├── config.toml
    ├── seed.sql
    └── migrations/
        ├── 20260121000000_initial_schema.sql
        ├── 20260121000001_organizations.sql
        ├── 20260121000002_users_roles.sql
        ├── 20260121000003_products_inventory.sql
        ├── 20260121000004_orders.sql
        ├── 20260121000005_production.sql
        ├── 20260121000006_documents.sql
        └── 20260121000007_rls_policies.sql
```

### Architectural Boundaries

**API Boundaries:**

| Boundary | Location | Purpose |
|----------|----------|---------|
| Server Actions | `features/*/actions/` | Mutations with permission checks |
| API Routes | `app/api/` | External integrations, PDF, webhooks |
| Supabase Client | `lib/supabase/` | Direct database queries |
| Middleware | `middleware.ts` | Auth verification on all routes |

**Component Boundaries:**

| Boundary | Access Pattern |
|----------|----------------|
| `@timber/ui` | Primitive UI components (buttons, cards, inputs) |
| `features/*/components/` | Feature-specific composed components |
| `components/` | Shared portal components (layout, data tables) |

**Data Boundaries:**

| Layer | Responsibility |
|-------|----------------|
| Supabase RLS | Enforces organization isolation at database level |
| `getAuthContext()` | Provides user + permissions to Server Actions |
| `@timber/database` | Transforms snake_case → camelCase |

### Feature to Structure Mapping

| Feature Area | Routes | Feature Module | Tables |
|--------------|--------|----------------|--------|
| **Auth** | `(auth)/login` | `features/auth/` | `users`, `user_roles` |
| **Inventory** | `(portal)/inventory` | `features/inventory/` | `products`, `inventory`, `inventory_movements`, `locations` |
| **Orders** | `(portal)/orders` | `features/orders/` | `client_orders`, `order_lines` |
| **Production** | `(portal)/production` | `features/production/` | `production_orders`, `production_jobs`, `material_consumption`, `production_output` |
| **Quotes/CRM** | `(portal)/quotes` | `features/quotes/`, `features/crm/` | `deals`, `quotes`, `contacts`, `activities` |
| **Suppliers** | `(portal)/suppliers` | `features/suppliers/` | `organizations` (type=supplier), `supplier_orders` |
| **Clients** | `(portal)/clients` | `features/clients/` | `organizations` (type=client) |
| **Documents** | `(portal)/documents` | `features/documents/` | `documents`, `document_templates` |
| **Admin** | `(portal)/admin` | `features/admin/` | `roles`, `functions`, `user_function_overrides` |

### Integration Points

**Internal Communication:**
- Server Actions call Supabase directly via `@timber/database`
- Components use hooks for real-time subscriptions
- Permission checks via `getAuthContext()` in every Server Action

**External Integrations:**
- **Resend**: Email sending via `features/notifications/`
- **Supabase Storage**: Document uploads via `features/documents/`
- **Gmail API**: (Phase 3) CRM email sync via `app/api/webhooks/email/`

**Data Flow:**
```
User Action → Server Action → Permission Check → Supabase → RLS Filter → Data
                                                              ↓
                                                    Realtime Subscription
                                                              ↓
                                                    UI Update via Hook
```

### Environment Configuration

| File | Purpose |
|------|---------|
| `.env.example` | Template for all environments |
| `.env.local` | Local development (not committed) |
| Vercel Dashboard | Production/Preview secrets |

**Required Environment Variables:**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
```

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** All technology choices verified compatible
- Next.js 16.1.1 + React 19.2.3: Native support
- Supabase + Next.js App Router: Full SSR/Server Actions support
- Tailwind CSS 4 + shadcn/ui: Compatible styling system
- TypeScript 5.x strict mode: All dependencies typed
- Turborepo + pnpm: Already functioning in monorepo

**Pattern Consistency:** All patterns align with technology choices
**Structure Alignment:** Project structure supports all architectural decisions

### Requirements Coverage Validation ✅

**Functional Requirements:** 158 FRs across 14 categories - ALL COVERED
**Non-Functional Requirements:** 50 NFRs - ALL ARCHITECTURALLY ADDRESSED

### Implementation Readiness Validation ✅

**Decision Completeness:** All critical decisions documented with versions
**Structure Completeness:** Full project structure defined
**Pattern Completeness:** All conflict points addressed with examples

### Gap Analysis Results

**Critical Gaps:** None
**Important Gaps:** Database schema details, RLS policies (addressed during implementation)
**Nice-to-Have:** E2E testing strategy, Storybook, OpenAPI spec (future)

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed (158 FRs, 50 NFRs)
- [x] Scale and complexity assessed (Medium-High)
- [x] Technical constraints identified (existing monorepo, Supabase)
- [x] Cross-cutting concerns mapped (7 identified)

**✅ Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**✅ Implementation Patterns**
- [x] Naming conventions established (DB, TS, API)
- [x] Structure patterns defined (feature-based)
- [x] Communication patterns specified (Server Actions, Realtime)
- [x] Process patterns documented (errors, loading, permissions)

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION ✅

**Confidence Level:** HIGH

**Key Strengths:**
1. Existing infrastructure provides solid foundation (Turborepo, packages, Supabase)
2. Unified portal simplifies multi-role user management
3. Feature-based organization scales well with team size
4. Supabase RLS provides security at database level
5. Patterns prevent AI agent implementation conflicts

**Areas for Future Enhancement:**
1. Test automation strategy (Playwright E2E)
2. Component documentation (Storybook)
3. API documentation (OpenAPI)
4. Performance monitoring (Sentry)

### Implementation Handoff

**AI Agent Guidelines:**
1. Follow all architectural decisions exactly as documented
2. Use implementation patterns consistently across all components
3. Respect project structure and boundaries
4. Check permissions at the start of EVERY Server Action
5. Transform database snake_case to camelCase at data layer
6. Refer to this document for all architectural questions

**First Implementation Priority:**
1. Create `apps/portal/` using Next.js initialization command
2. Set up dashboard layout with sidebar navigation
3. Implement permission system (`features/permissions/`)
4. Create first feature: Production tracking (MVP scope)

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED ✅
**Total Steps Completed:** 8
**Date Completed:** 2026-01-21
**Document Location:** `_bmad-output/planning-artifacts/platform/architecture.md`

### Final Architecture Deliverables

**Complete Architecture Document**
- All architectural decisions documented with specific versions
- Implementation patterns ensuring AI agent consistency
- Complete project structure with all files and directories
- Requirements to architecture mapping
- Validation confirming coherence and completeness

**Implementation Ready Foundation**
- 11 core architectural decisions made
- 12 implementation patterns defined
- 9 feature modules specified
- 158 functional requirements + 50 NFRs fully supported

**AI Agent Implementation Guide**
- Technology stack with verified versions
- Consistency rules that prevent implementation conflicts
- Project structure with clear boundaries
- Integration patterns and communication standards

### Quality Assurance Checklist

**✅ Architecture Coherence**
- [x] All decisions work together without conflicts
- [x] Technology choices are compatible
- [x] Patterns support the architectural decisions
- [x] Structure aligns with all choices

**✅ Requirements Coverage**
- [x] All functional requirements are supported
- [x] All non-functional requirements are addressed
- [x] Cross-cutting concerns are handled
- [x] Integration points are defined

**✅ Implementation Readiness**
- [x] Decisions are specific and actionable
- [x] Patterns prevent agent conflicts
- [x] Structure is complete and unambiguous
- [x] Examples are provided for clarity

---

**Architecture Status:** READY FOR IMPLEMENTATION ✅

**Next Phase:** Begin implementation using the architectural decisions and patterns documented herein.

**Document Maintenance:** Update this architecture when major technical decisions are made during implementation.

---

# Producer MVP Architecture Addendum

**Date Added:** 2026-01-21
**Scope:** Producer Portal MVP - Factory Manager Production Tracking
**Status:** ACTIVE - Use this section for MVP implementation

---

## MVP Scope Definition

### What Producer MVP IS

A **desktop production management tool** for a single factory manager to:
- Track inventory at their facility
- Log material transformations through production processes
- View efficiency metrics (outcome %, waste %)
- Review production history

### What Producer MVP IS NOT

| Excluded | Why | When |
|----------|-----|------|
| Multi-tenant architecture | Single producer for MVP | Phase 2+ |
| Complex RBAC | Single user role | Phase 2+ |
| Multiple organizations | Single factory location | Phase 2+ |
| Real-time subscriptions | Single user doesn't need | Phase 2+ |
| Client Portal | Not needed for producer validation | Phase 2 |
| Supplier Portal | Not needed for producer validation | Phase 2 |
| Sales CRM | Not needed for producer validation | Phase 3 |
| Mobile/tablet UI | Desktop only per UX spec | Future |
| Multi-language | English only | Future |

### Target User Profile

| Attribute | Value |
|-----------|-------|
| **User** | Factory Manager (Viktor persona) |
| **Count** | Single user |
| **Platform** | Desktop only (1024px minimum) |
| **Location** | Single facility |
| **Frequency** | Daily production logging |

---

## MVP Simplified Architecture

### Key Simplifications from Full Platform

| Full Platform | MVP Simplification | Rationale |
|---------------|-------------------|-----------|
| Multi-tenant with RLS | Single tenant, no RLS needed | One producer organization |
| 6 user roles with RBAC | Single "producer" role | One user type |
| `organization_id` on all tables | Not required for MVP | No data isolation needed |
| Real-time subscriptions | Standard queries | Single user, no collaboration |
| Complex permission system | Simple auth check | One role has all producer functions |
| Multiple portal apps | Single portal app | Producer only |

### MVP Technology Stack (Unchanged from Platform)

| Component | Technology | Notes |
|-----------|------------|-------|
| Framework | Next.js 16.1.1 | App Router |
| Styling | Tailwind CSS 4.x + shadcn/ui | Per UX spec |
| Database | Supabase (PostgreSQL) | Simpler schema |
| Auth | Supabase Auth | Email/password only |
| Hosting | Vercel | Same deployment pipeline |

---

## MVP Database Schema

### Tables Required for MVP

Only 6 tables needed (vs. 20+ for full platform):

```sql
-- 1. Users (simplified - no organization link)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Products (inventory items)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- e.g., "Oak Boards", "Pine Strips"
  species TEXT,                          -- e.g., "Oak", "Pine"
  moisture_state TEXT,                   -- e.g., "Dry", "Fresh"
  dimensions TEXT,                       -- e.g., "45x45", "100x25"
  unit TEXT DEFAULT 'pcs',               -- pcs, m³
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Inventory (current stock)
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) NOT NULL,
  quantity DECIMAL NOT NULL DEFAULT 0,
  cubic_meters DECIMAL,                  -- calculated or entered
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Processes (production process types)
CREATE TABLE processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- e.g., "Multi-saw", "Planing"
  is_standard BOOLEAN DEFAULT false,     -- standard vs custom
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Production Entries (the core transformation record)
CREATE TABLE production_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID REFERENCES processes(id) NOT NULL,
  production_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'draft',           -- draft, validated
  notes TEXT,
  -- Calculated totals (stored for performance)
  total_input_m3 DECIMAL,
  total_output_m3 DECIMAL,
  outcome_percentage DECIMAL,            -- (output/input) * 100
  waste_percentage DECIMAL,              -- 100 - outcome_percentage
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  validated_at TIMESTAMPTZ
);

-- 6. Production Lines (input and output items for each entry)
CREATE TABLE production_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_entry_id UUID REFERENCES production_entries(id) ON DELETE CASCADE NOT NULL,
  line_type TEXT NOT NULL,               -- 'input' or 'output'
  product_id UUID REFERENCES products(id),
  product_name TEXT,                     -- denormalized for history
  quantity DECIMAL NOT NULL,
  cubic_meters DECIMAL,
  dimensions TEXT,                       -- specific dimensions for this line
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Seed Data (Standard Processes)

```sql
INSERT INTO processes (name, is_standard) VALUES
  ('Multi-saw', true),
  ('Planing', true),
  ('Opti-cut', true),
  ('Gluing', true),
  ('Sanding', true),
  ('Finger Jointing', true);
```

### What's NOT in MVP Schema

| Table | Full Platform Purpose | MVP Status |
|-------|----------------------|------------|
| `organizations` | Multi-tenant | Deferred |
| `roles` | RBAC | Deferred |
| `functions` | Permission system | Deferred |
| `user_roles` | Role assignment | Deferred |
| `user_function_overrides` | Permission overrides | Deferred |
| `locations` | Multiple facilities | Deferred |
| `client_orders` | Client orders | Deferred |
| `supplier_orders` | Purchase orders | Deferred |
| `deals` | CRM | Deferred |
| `documents` | Document management | Deferred |
| `messages` | Communication | Deferred |
| `notifications` | Notification system | Deferred |
| `audit_logs` | Full audit trail | Deferred |

---

## MVP Project Structure

### Simplified Portal Structure

```
apps/portal/src/
├── app/
│   ├── globals.css
│   ├── layout.tsx                 # Root layout
│   │
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx           # Simple login
│   │   └── layout.tsx
│   │
│   └── (portal)/                  # Authenticated routes
│       ├── layout.tsx             # Dashboard layout with nav
│       ├── dashboard/
│       │   └── page.tsx           # Metrics overview
│       ├── inventory/
│       │   └── page.tsx           # Inventory table
│       ├── production/
│       │   ├── page.tsx           # New/edit production entry
│       │   └── [id]/
│       │       └── page.tsx       # Edit existing entry
│       ├── history/
│       │   └── page.tsx           # Production history list
│       └── admin/                 # Admin-only functions
│           ├── reference/
│           │   └── page.tsx       # Reference data management
│           ├── organisations/
│           │   └── page.tsx       # Organisations management
│           └── inventory/
│               └── new-shipment/
│                   └── page.tsx   # Create shipment + packages
│
├── features/
│   ├── auth/
│   │   ├── actions/
│   │   │   └── login.ts
│   │   └── components/
│   │       └── LoginForm.tsx
│   │
│   ├── reference-data/            # Admin-managed dropdown options
│   │   ├── actions/
│   │   │   ├── getReferenceOptions.ts
│   │   │   ├── createReferenceOption.ts
│   │   │   ├── updateReferenceOption.ts
│   │   │   ├── toggleReferenceOption.ts
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   ├── ReferenceDataManager.tsx
│   │   │   ├── ReferenceTableSelector.tsx
│   │   │   ├── ReferenceOptionsTable.tsx
│   │   │   ├── ReferenceOptionForm.tsx
│   │   │   └── index.ts
│   │   └── types.ts
│   │
│   ├── organisations/             # Organisation (party) management
│   │   ├── actions/
│   │   │   ├── getOrganisations.ts
│   │   │   ├── createOrganisation.ts
│   │   │   ├── updateOrganisation.ts
│   │   │   ├── toggleOrganisation.ts
│   │   │   ├── deleteOrganisation.ts
│   │   │   ├── getOrgShipmentCount.ts
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   ├── OrganisationsTable.tsx
│   │   │   ├── OrganisationForm.tsx
│   │   │   └── index.ts
│   │   ├── schemas/
│   │   │   └── organisation.ts
│   │   └── types.ts
│   │
│   ├── shipments/                 # Shipment + package creation
│   │   ├── actions/
│   │   │   ├── getActiveOrganisations.ts
│   │   │   ├── getShipmentCodePreview.ts
│   │   │   ├── getReferenceDropdowns.ts
│   │   │   ├── createShipment.ts
│   │   │   └── index.ts
│   │   ├── components/
│   │   │   ├── ShipmentHeader.tsx
│   │   │   ├── PackageEntryTable.tsx
│   │   │   └── index.ts
│   │   ├── schemas/
│   │   │   └── shipment.ts
│   │   └── types.ts
│   │
│   ├── inventory/
│   │   ├── actions/
│   │   │   └── getInventory.ts
│   │   ├── components/
│   │   │   └── InventoryTable.tsx
│   │   └── types.ts
│   │
│   └── production/
│       ├── actions/
│       │   ├── createProduction.ts
│       │   ├── updateProduction.ts
│       │   ├── validateProduction.ts
│       │   └── getProductionHistory.ts
│       ├── components/
│       │   ├── ProductionForm.tsx
│       │   ├── ProductLineItem.tsx
│       │   ├── ProductionSummary.tsx
│       │   ├── ProcessSelector.tsx
│       │   └── ProductionHistoryTable.tsx
│       └── types.ts
│
├── components/
│   └── layout/
│       ├── Sidebar.tsx            # Collapsible sidebar navigation
│       ├── SidebarLink.tsx        # Navigation link component
│       ├── SidebarWrapper.tsx     # Server component for session
│       └── TopNav.tsx             # Deprecated (replaced by Sidebar)
│
├── lib/
│   └── supabase/
│       ├── client.ts
│       └── server.ts
│
└── middleware.ts                  # Auth check only
```

### What's NOT in MVP Structure

| Directory | Full Platform Purpose | MVP Status |
|-----------|----------------------|------------|
| `features/permissions/` | RBAC system | Deferred |
| `features/orders/` | Order management | Deferred |
| `features/quotes/` | Quote generation | Deferred |
| `features/crm/` | Sales CRM | Deferred |
| `features/documents/` | Document management | Deferred |
| `features/notifications/` | Notification system | Deferred |
| `app/api/pdf/` | PDF generation | Deferred |
| `app/api/webhooks/` | External integrations | Deferred |
| `app/(portal)/admin/` | Admin functions | ✅ Partially implemented (reference-data, organisations) |
| `app/(portal)/suppliers/` | Supplier management | Deferred |
| `app/(portal)/clients/` | Client management | Deferred |

---

## MVP Authentication (Simplified)

### No RBAC for MVP

```typescript
// middleware.ts - Simple auth check only
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  // Simple: logged in or not
  if (!session && req.nextUrl.pathname.startsWith('/(portal)')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return res
}
```

### No Permission Checks in Server Actions

```typescript
// MVP: Just verify authenticated
export async function createProduction(data: CreateProductionInput) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Not authenticated" }
  }

  // No permission check - single role has all access
  // Proceed with creation...
}
```

### Migration Path to Full RBAC

When adding Phase 2 (multi-tenant):
1. Add `organization_id` to all tables
2. Add RLS policies
3. Implement permission system in `features/permissions/`
4. Update Server Actions to check permissions

---

## MVP Functional Requirements Mapping

### FRs Included in MVP

From the full PRD, only these FRs are in scope:

| FR | Requirement | MVP Implementation |
|----|-------------|-------------------|
| FR2 | Email/password authentication | Supabase Auth |
| FR4 | View/update profile | Basic profile page |
| FR32 | View inventory at facility | Inventory table |
| FR42 | Report production (input→output) | Production form |
| FR43 | Record waste/loss | Calculated from input-output |
| FR44 | Submit completed production | Validate action |
| FR45 | View production history | History table |
| FR46 | View efficiency metrics | Dashboard metrics |
| FR52 | System calculates efficiency | Auto-calculated |

**Total: 9 FRs** (vs. 158 in full platform)

### FRs Explicitly Deferred

All other FRs deferred to Phase 2+, including:
- User management (FR1, FR3, FR5-FR19)
- Organization management (FR20-FR29)
- Advanced inventory (FR30-31, FR33-39)
- Production orders (FR40-41, FR47-51)
- All order management (FR53-64)
- All CRM (FR65-77)
- All procurement (FR78-87)
- Supplier portal (FR88-95)
- Document management (FR96-104)
- Communication (FR105-115)
- Reporting (FR116-128)
- System administration (FR129-138)
- Automation (FR139-148)
- API (FR149-158)

---

## MVP Non-Functional Requirements

### Simplified NFRs for MVP

| NFR | Full Platform | MVP Target | Rationale |
|-----|---------------|------------|-----------|
| NFR6 | 100+ concurrent users | 1 user | Single factory manager |
| NFR8 | Row-level security | Not needed | Single tenant |
| NFR18 | 500+ organizations | 1 organization | MVP validation |
| NFR19 | 2000+ users | 1-5 users | Small team |
| NFR24 | 99.5% uptime | Best effort | Not production-critical yet |

### NFRs Still Required for MVP

| NFR | Requirement | Still Applies |
|-----|-------------|---------------|
| NFR1 | Page load < 3s | Yes |
| NFR2 | API response < 500ms | Yes |
| NFR7 | Mid-range device support | Yes (desktop) |
| NFR30 | Responsive (desktop) | Yes (1024px min) |
| NFR42 | 30-minute learning curve | Yes |
| NFR43 | Clear error messages | Yes |
| NFR44 | Undo/confirmation | Yes |

---

## MVP Implementation Checklist

### Phase 1: Foundation (First)

- [ ] Create `apps/portal/` with Next.js initialization
- [ ] Set up Supabase connection (`@timber/database` integration)
- [ ] Create MVP database schema (6 tables)
- [ ] Seed standard processes
- [ ] Implement basic auth (login/logout)

### Phase 2: Core Features

- [ ] Dashboard with placeholder metrics
- [ ] Inventory table (view all products)
- [ ] Production form (input selection)
- [ ] Production form (output entry)
- [ ] Auto-calculation of m³ and percentages
- [ ] Validate production (commit to inventory)

### Phase 3: Complete MVP

- [ ] Production history table
- [ ] Edit existing production entries
- [ ] Dashboard with real metrics
- [ ] Process management (add custom)

### Validation Criteria

MVP is complete when:
- [ ] Factory Manager can log in
- [ ] Factory Manager can view current inventory
- [ ] Factory Manager can create production entry (select inputs, process, outputs)
- [ ] Factory Manager can validate production (inventory updates)
- [ ] Factory Manager can view efficiency metrics on dashboard
- [ ] Factory Manager can view and edit production history

---

## Migration to Full Platform

### When to Migrate

After MVP validation with 2-3 producers, add:

1. **Multi-tenancy** - Add `organization_id` to all tables, implement RLS
2. **RBAC** - Add permission tables and checking
3. **Additional features** - Unlock deferred FRs progressively

### Migration Steps

```
MVP → Phase 2 (Multi-tenant)
├── Add organizations table
├── Add organization_id to existing tables
├── Implement RLS policies
├── Add role/permission tables
└── Update Server Actions with permission checks

Phase 2 → Phase 3 (Additional Portals)
├── Add Client Portal features
├── Add Supplier Portal features
├── Add Admin functions
└── Expand shared components
```

### Data Migration

MVP data can be migrated to multi-tenant by:
1. Creating an organization for the MVP producer
2. Adding `organization_id` column with default value
3. Updating existing rows with the organization ID

---

## AI Agent Implementation Guidelines (MVP-Specific)

### What to Build

- **Only** the 4 screens defined in UX spec: Dashboard, Inventory, Production, History
- **Only** the 6 database tables defined above
- **Only** the simplified auth (no RBAC)
- **Only** the routes in the MVP project structure

### What NOT to Build

- Do NOT create permission checking beyond auth verification
- Do NOT add `organization_id` to tables
- Do NOT implement RLS policies
- Do NOT create admin functions
- Do NOT add notification systems
- Do NOT build any deferred features

### Pattern Enforcement

All patterns from the main architecture still apply:
- Naming conventions (snake_case DB, camelCase TS)
- Server Action result types (`{ success, data } | { success: false, error }`)
- Feature-based organization
- Co-located tests
- Error handling with toasts

---

**MVP Architecture Status:** READY FOR IMPLEMENTATION ✅

**Scope:** Producer Portal MVP only (4 screens, 6 tables, 9 FRs)

**Next Step:** Create Epics & Stories scoped to this MVP architecture

---

# Inventory Data Model v2 Addendum

**Date Added:** 2026-01-22
**Status:** ACTIVE - Replaces original product-based inventory model
**Reference:** `_bmad-output/planning-artifacts/inventory-data-model-v2.md`

---

## Overview

This addendum documents a significant change to the inventory data model. The original **Product Catalog + Inventory** model is replaced with a **Flat Shipment/Package** model.

### Key Changes

| Original Model | New Model |
|----------------|-----------|
| Products table (catalog) | No product catalog |
| Inventory references product_id | Inventory contains all attributes inline |
| Free-text product attributes | Admin-managed dropdown options |
| Manual codes | Auto-generated shipment/package codes |

---

## New Database Schema

### Reference Tables (Admin-Managed Dropdowns)

```sql
-- Product Names
CREATE TABLE ref_product_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Wood Species
CREATE TABLE ref_wood_species (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Humidity Options
CREATE TABLE ref_humidity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Types (FJ, Full stave)
CREATE TABLE ref_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Processing Options
CREATE TABLE ref_processing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- FSC Certification
CREATE TABLE ref_fsc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Quality Grades
CREATE TABLE ref_quality (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Parties Table (UI: "Organisations")

```sql
CREATE TABLE parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code CHAR(3) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Initial data
INSERT INTO parties (code, name) VALUES
  ('TWP', 'Timber World Platform'),
  ('INE', 'INERCE');
```

### Shipments Table

```sql
CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_code TEXT NOT NULL UNIQUE,      -- "TWP-INE-001"
  shipment_number INTEGER NOT NULL,        -- Global sequential
  from_party_id UUID REFERENCES parties(id) NOT NULL,
  to_party_id UUID REFERENCES parties(id) NOT NULL,
  shipment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT different_parties CHECK (from_party_id != to_party_id)
);
```

### Inventory Packages Table

```sql
CREATE TABLE inventory_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Shipment Reference
  shipment_id UUID REFERENCES shipments(id) NOT NULL,
  package_number TEXT NOT NULL UNIQUE,     -- "TWP-001-001"
  package_sequence INTEGER NOT NULL,

  -- Dropdown Fields (Foreign Keys)
  product_name_id UUID REFERENCES ref_product_names(id),
  wood_species_id UUID REFERENCES ref_wood_species(id),
  humidity_id UUID REFERENCES ref_humidity(id),
  type_id UUID REFERENCES ref_types(id),
  processing_id UUID REFERENCES ref_processing(id),
  fsc_id UUID REFERENCES ref_fsc(id),
  quality_id UUID REFERENCES ref_quality(id),

  -- Dimension Fields (Number or Range as TEXT)
  thickness TEXT,                          -- "40" or "40-50"
  width TEXT,
  length TEXT,

  -- Quantity Fields
  pieces TEXT,                             -- Number or "-" for uncountable
  volume_m3 DECIMAL,
  volume_is_calculated BOOLEAN DEFAULT false,

  -- Status for production tracking
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'consumed', 'produced')),

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(shipment_id, package_sequence)
);
```

---

## Code Formats

### Shipment Code: `[FROM]-[TO]-[NUMBER]`

- `TWP-INE-001` = Timber World → INERCE, shipment #1
- `INE-TWP-001` = INERCE → Timber World, shipment #1

### Package Number: `TWP-[SHIPMENT]-[PACKAGE]`

- `TWP-001-001` = Global shipment #1, Package #1
- `TWP-001-002` = Global shipment #1, Package #2

---

## Initial Reference Data

| Table | Values |
|-------|--------|
| ref_product_names | Unedged boards, Edged boards, Strips, Solid wood panels |
| ref_wood_species | Oak, Ash, Birch, Pine |
| ref_humidity | Fresh cut, Air dried, KD 7-9%, KD 9-11% |
| ref_types | FJ, Full stave |
| ref_processing | Rough sawn, Calibrated, Planed, Opticut, Sorted, Unsorted, Varnished, Waxed, Oiled, Sanded |
| ref_fsc | FSC 100%, FSC Credit Mix, No |
| ref_quality | AA, AV, AS, BC, CC, ABC, Insects, Defected |

---

## Tables Summary (Updated)

| Table | Purpose |
|-------|---------|
| portal_users | User accounts with role |
| parties | Organisations (TWP, INE, etc.) |
| shipments | Shipment records with auto-generated codes |
| inventory_packages | Package records with all attributes |
| ref_product_names | Dropdown: Product names |
| ref_wood_species | Dropdown: Wood species |
| ref_humidity | Dropdown: Humidity options |
| ref_types | Dropdown: Types (FJ, Full stave) |
| ref_processing | Dropdown: Processing methods |
| ref_fsc | Dropdown: FSC certification |
| ref_quality | Dropdown: Quality grades |
| portal_processes | Production process types |
| portal_production_entries | Production records |
| portal_production_lines | Production input/output lines |

**Total: 14 tables** (was 6 in original MVP)

---

## Impact on Features

### Admin Features (New/Updated)

1. **Reference Data Management** - CRUD for all dropdown tables
2. **Organisations Management** - CRUD for organisations
3. **Shipment Creation** - Create shipments with auto-generated codes
4. **Package Entry** - Horizontal spreadsheet-like entry form

### Producer Features (Updated)

1. **View Inventory** - Shows packages received (all attributes)
2. **Production Inputs** - Select packages (not products) as inputs
3. **Production Outputs** - Creates new packages with inherited attributes

---

## Migration Notes

The original `portal_products` table is deprecated. The new model does not use a product catalog.

For existing Story 2.1 code (Product Management), it should be replaced with Reference Data Management.

---

**Full Specification:** See `_bmad-output/planning-artifacts/inventory-data-model-v2.md`

---
---

# Multi-Tenancy & Inter-Org Transfers Addendum

**Date:** 2026-01-25
**Context:** Expanding platform to support multiple organizations, user management, and inter-organization goods movement
**Source:** Brainstorming session `_bmad-output/analysis/brainstorming-platform-multitenancy-2026-01-25.md`

---

## Overview

The Timber World Production Portal evolves from a single-tenant system (Super Admin + Producers) to a multi-tenant platform where:

1. **Organizations** are independent entities with their own inventory, production, and users
2. **Super Admin** oversees all organizations with consolidated views
3. **Goods flow** between organizations via a two-stage transfer process
4. **Organizations may have 0+ users** - an org without users can still be referenced in shipments/transfers

---

## Platform Hierarchy

| Layer | Role | Capabilities |
|-------|------|--------------|
| **Super Admin** | Platform owner (Nils) | Manage all orgs, assign users, consolidated views, deep-dive into any org, see all movement |
| **Organization** | Independent entity | Own inventory, production, users; exchange goods with other orgs |
| **User** | Org operator | Work within assigned organization context |

### Role Model (MVP)

For MVP, all users within an organization have the same rights. Role separation within orgs is deferred to future iterations.

```
Super Admin (existing admin role)
    └── Organization 1
        ├── User A (full org access)
        └── User B (full org access)
    └── Organization 2
        └── User C (full org access)
    └── Organization 3 (no users yet - can still receive shipments)
```

---

## Core Architectural Pattern: Context-Driven Views

**Key Insight:** Same forms work for Super Admin and Organization users - the difference is context filtering.

```typescript
// Pattern: Get org context from session
async function getInventory() {
  const session = await getSession();

  if (isSuperAdmin(session)) {
    // Super Admin: show all or filter by selected org
    const orgFilter = getOrgFilterFromQuery(); // optional URL param
    return orgFilter
      ? fetchInventoryByOrg(orgFilter)
      : fetchAllInventory();
  } else {
    // Org User: always scoped to their organization
    return fetchInventoryByOrg(session.organisation_id);
  }
}
```

**Benefits:**
- No duplicate forms/components
- Super Admin can "view as" any organization
- Single codebase, context-aware behavior

---

## Entity Model: Single Organization Type

**Decision:** All organizations use the same entity type. An organization's capabilities depend on whether it has users, not on a type flag.

| User Count | Capabilities |
|------------|--------------|
| **Has users** | Users can log in, view data, create transfers, manage production |
| **No users (yet)** | Can be referenced as sender/receiver in shipments and transfers; other orgs create records on their behalf |

**Key Insight:** An organization without users today might get users tomorrow. No migration or type change needed - just add users.

### Database: `organisations` Table Update

```sql
-- Updated organisations table (was 'parties')
CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,  -- 3-letter code for shipment codes (TWP, INE, etc.)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- No 'type' column - capabilities determined by user count
-- Existing rows migrate from 'parties' table
```

**Note:** Organizations without users (e.g., external suppliers) can still appear in shipments and transfers. The receiving org creates the shipment/transfer entry on their behalf.

---

## User Management

### Database: `portal_users` Table Update

```sql
-- Updated portal_users table
ALTER TABLE portal_users
  ADD COLUMN organisation_id UUID REFERENCES organisations(id),
  ADD COLUMN invited_at TIMESTAMPTZ,
  ADD COLUMN invited_by UUID REFERENCES portal_users(id);

-- Super Admin has organisation_id = NULL (platform-level)
-- Org Users have organisation_id = their org
```

### User Creation Flow

1. Super Admin navigates to Organizations → Select Org → Users tab
2. Click "Add User" → Enter: Name, Email
3. System generates temporary password
4. Click "Send Credentials" → Email sent with login details
5. User logs in, sees only their organization's data

### Authentication Context

```typescript
// Extended session type
interface Session {
  user_id: string;
  email: string;
  role: 'admin' | 'producer';  // existing
  organisation_id: string | null;  // NEW: null = Super Admin
  organisation_code: string | null;  // NEW: for display/shipment codes
}
```

---

## Two-Stage Shipment Flow

**Problem Solved:** Direct shipments with rejection create messy audit trails (inventory moves, then moves back on rejection).

**Solution:** Two-stage flow with Draft state.

### Shipment States

```
[Draft] → [Pending] → [Accepted] → [Completed]
              ↓
         [Rejected]
```

| State | Description | Inventory Impact |
|-------|-------------|------------------|
| **Draft** | Sender preparing shipment | None |
| **Pending** | Sent to receiver, awaiting acceptance | None (still at sender) |
| **Accepted** | Receiver approved, ready to execute | None yet |
| **Completed** | Shipment executed | Packages move from sender to receiver |
| **Rejected** | Receiver declined at pending stage | None (never moved) |

### Flow Steps

1. **Create Draft:** Sender creates shipment, selects packages, receiver org
2. **Submit for Acceptance:** Draft → Pending (receiver notified)
3. **Receiver Reviews:** Check package list, quantities
4. **Accept or Reject:**
   - Accept → Packages flagged for shipment
   - Reject → Draft closed, packages remain at sender
5. **Execute Shipment:** On accept, inventory moves to receiver org

### Database: Extended `shipments` Table

The existing `shipments` table is extended with status workflow columns for inter-org movements:

```sql
-- Add status workflow columns to existing shipments table
ALTER TABLE shipments ADD COLUMN
  status TEXT DEFAULT 'completed',  -- draft, pending, accepted, completed, rejected
  submitted_at TIMESTAMPTZ,         -- When draft → pending
  reviewed_at TIMESTAMPTZ,          -- When accepted/rejected
  reviewed_by UUID REFERENCES portal_users(id),
  rejection_reason TEXT;

-- Existing shipments get status = 'completed' (legacy data)
UPDATE shipments SET status = 'completed' WHERE status IS NULL;
```

**Note:** The existing `shipment_packages` table already supports the package selection pattern.

### Shipment Code Format

Existing pattern: `[FROM]-[TO]-[NUMBER]`

- `TWP-INE-001` = Timber World → INERCE, shipment #1
- `INE-TWP-001` = INERCE → Timber World, shipment #1

---

## Goods Intake from Organizations Without Users

When receiving goods from organizations that don't have platform users (e.g., external suppliers):

1. Super Admin or Org User creates shipment with sender org selected
2. Sender org exists in `organisations` table (may have 0 users)
3. Packages are entered into receiving org's inventory
4. No acceptance flow needed (sender org has no users to confirm)

### Flow

```
Sender Organization (no users)
    ↓ [Physical goods arrive with invoice]
Receiving Org User
    ↓ [Creates shipment entry: Sender Org → Their Org]
Inventory Packages
    ↓ [Packages added to receiving org's inventory]
```

**Future:** If the sender organization later onboards users, they can log in and see their shipment history - no data migration needed.

---

## Consolidated Views (Super Admin)

### Platform Dashboard

Super Admin sees aggregated metrics across ALL organizations:

| Metric | Scope |
|--------|-------|
| Total Inventory Volume | All orgs combined |
| Total Production Volume | All orgs combined |
| Active Shipments | Pending + in-progress |
| Orgs Active Today | Count of orgs with activity |

### Per-Organization Breakdown

Drill-down to individual org metrics (same as org's own dashboard).

### Shipments/Movements View

**New dedicated view** showing all cross-org activity:

- Filter by: Date range, From org, To org, Status
- Columns: Code, From, To, Volume (m³), Status, Date
- Click row → Transfer detail (packages list)

### Super Admin Navigation Update

```
Dashboard (consolidated)
├── Organizations
│   ├── [Org List] → Click to view as that org
│   └── [Org] → Users tab
├── Shipments
│   ├── All Shipments (cross-org view)
│   └── Pending Approvals (if any org)
├── Inventory (all orgs, filterable)
├── Production (all orgs, filterable)
└── Reference Data (existing)
```

---

## Component Reuse Strategy

| Existing Component | Reuse For | Modifications |
|--------------------|-----------|---------------|
| Shipment Form | Inter-org Shipments | Add status workflow, two-stage flow |
| Package Entry Table | Shipment Package Selection | Add checkbox column for selection |
| Inventory Table | All org views | Add org filter for Super Admin |
| Production Form | All org views | Context-scoped by session |
| Dashboard Metrics | Org + Consolidated | Add aggregation mode for Super Admin |

---

## Data Scoping Rules

### Query Patterns

```typescript
// Super Admin queries - optional org filter
const query = supabase
  .from('inventory_packages')
  .select('*');

if (orgFilter) {
  query.eq('organisation_id', orgFilter);
}

// Org User queries - always scoped
const query = supabase
  .from('inventory_packages')
  .select('*')
  .eq('organisation_id', session.organisation_id);
```

### Package Ownership

Update `inventory_packages` to include organisation ownership:

```sql
ALTER TABLE inventory_packages
  ADD COLUMN organisation_id UUID REFERENCES organisations(id);

-- Migrate existing packages to default org (TWP)
UPDATE inventory_packages SET organisation_id = (SELECT id FROM organisations WHERE code = 'TWP');
```

---

## Implementation Priority

| Priority | Feature | Dependencies |
|----------|---------|--------------|
| **1** | Multi-tenancy | Add `organisation_id` to users and packages, context-aware queries |
| **2** | User Management | User CRUD within org context, credential sending |
| **3** | Shipments | Two-stage flow, extend shipments table, reuse shipment UI |
| **4** | Consolidated Views | Super Admin dashboard aggregation, shipments view |

---

## Migration Notes

1. **Rename `parties` → `organisations`** with additional columns
2. **Add `organisation_id`** to `portal_users` and `inventory_packages`
3. **Extend `shipments`** table with status workflow columns
4. **Migrate existing data** to default organisation (TWP)
5. **Update all queries** to be context-aware

---

## Tables Summary (After This Addendum)

| Table | Purpose |
|-------|---------|
| organisations | All organizations (may have 0+ users) |
| portal_users | User accounts with org assignment |
| shipments | Extended with status workflow for inter-org flow |
| shipment_packages | Packages in a shipment (existing) |
| inventory_packages | Packages with org ownership |
| (existing tables remain) | ... |

**Total: 14 tables** (organisations rename, extended shipments - no new tables needed)

---
---

# Platform Multi-Tenant Architecture v2 Addendum

**Date:** 2026-02-01
**Status:** APPROVED - Target architecture for full platform
**Context:** Comprehensive multi-tenant, multi-user, multi-organization design
**Reference:** `_bmad-output/analysis/multi-tenant-architecture-design-2026-02-01.md`

---

## Overview

This addendum defines the target architecture for the full Timber World Platform, expanding beyond the current MVP to support multiple organization types (Principal, Producer, Supplier, Client, Trader, Logistics) with a unified portal approach.

**Key Insight:** Timber World (the IT platform) is NOT an organization - it's the platform operator. All business entities are peer organizations with different feature sets enabled.

---

## Core Principles

### 1. One Portal, Multiple Views

All users access the same `apps/portal/` application. What they see is determined by:
- Their organization type(s)
- Their organization's enabled features
- Their roles within the organization
- Their personal permission overrides

```
apps/portal/
├── Super Admin sees: All orgs, all data, configuration
├── Producer sees: Inventory, production, shipments, dashboard
├── Client sees: Orders, tracking, reorder, invoices (future)
├── Supplier sees: Orders, deliveries, invoices (future)
└── All use the SAME codebase with permission-based rendering
```

### 2. Platform vs Organizations

```
┌─────────────────────────────────────────────────────────────────┐
│                    TIMBER WORLD PLATFORM                        │
│                      (IT Infrastructure)                        │
│                                                                 │
│   Super Admin: Full control, configures everything              │
│   Delegated Admins (future): Subset of super admin powers       │
│   NOT a business entity - just the technology layer             │
└─────────────────────────────────────────────────────────────────┘
                              │
                    Manages all tenants (peer organizations)
```

### 3. All Organizations Are Peers

No IT hierarchy between organizations. "Principal" is not above "Producer" in the system - they're peers with different feature sets. Relationships between orgs are edges in a graph, not a tree.

---

## Organization Model

### Types as Tags

Organization types are TAGS, not separate database entities:

| Type | Definition | Default Features |
|------|------------|------------------|
| **Principal** | Owns materials, orchestrates supply chain | Full access: inventory, production, orders, CRM, analytics |
| **Producer** | Manufactures products | Inventory view, production tracking, efficiency metrics |
| **Supplier** | Provides raw materials | Order viewing, delivery confirmation, invoice submission |
| **Client** | Buys finished products | Ordering, tracking, reorder, invoice viewing |
| **Trader** | Intermediary | Ordering, supplier management, client management |
| **Logistics** | Transports goods | Shipment tracking, CMR access, packing lists |

**Multi-Type Support:** An organization can have multiple types (e.g., a company that is both Client and Supplier).

### Database Schema Update

```sql
-- Organization types (reference table)
CREATE TABLE organization_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,        -- "principal", "producer", etc.
  description TEXT,
  icon TEXT,
  default_features TEXT[],          -- Template features for this type
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Type assignments (many-to-many)
CREATE TABLE organization_type_assignments (
  organization_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  type_id UUID REFERENCES organization_types(id) ON DELETE CASCADE,
  PRIMARY KEY (organization_id, type_id)
);

-- Seed initial types
INSERT INTO organization_types (name, description, default_features) VALUES
  ('principal', 'Owns materials, orchestrates supply chain',
   ARRAY['inventory.*', 'production.*', 'shipments.*', 'orders.*', 'analytics.*']),
  ('producer', 'Manufactures products',
   ARRAY['inventory.view', 'production.*', 'shipments.*', 'dashboard.view']),
  ('supplier', 'Provides raw materials',
   ARRAY['orders.view', 'deliveries.*', 'invoices.*']),
  ('client', 'Buys finished products',
   ARRAY['orders.*', 'tracking.view', 'invoices.view']),
  ('trader', 'Intermediary buyer/seller',
   ARRAY['orders.*', 'suppliers.*', 'clients.*']),
  ('logistics', 'Transports goods',
   ARRAY['shipments.view', 'tracking.*', 'documents.view']);
```

### Organization Relationships

```sql
-- Relationships between organizations
CREATE TABLE organization_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_a_id UUID REFERENCES organisations(id) NOT NULL,  -- seller/supplier role
  party_b_id UUID REFERENCES organisations(id) NOT NULL,  -- buyer/client role
  relationship_type TEXT NOT NULL,    -- "supplier_client", "producer_principal", etc.
  metadata JSONB,                     -- Contract details, terms, etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT different_parties CHECK (party_a_id != party_b_id)
);

-- Index for fast lookups
CREATE INDEX idx_org_rel_party_a ON organization_relationships(party_a_id);
CREATE INDEX idx_org_rel_party_b ON organization_relationships(party_b_id);
```

---

## User Model

### Multi-Organization Membership

A user can belong to MULTIPLE organizations with different roles in each:

```sql
-- User memberships (replaces single organisation_id on portal_users)
CREATE TABLE organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES portal_users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  is_primary BOOLEAN DEFAULT false,   -- Default org on login
  invited_at TIMESTAMPTZ,
  invited_by UUID REFERENCES portal_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, organization_id)
);

-- Update portal_users to support platform-level users
ALTER TABLE portal_users
  ADD COLUMN is_platform_admin BOOLEAN DEFAULT false;

-- Super Admin has is_platform_admin = true, no organization memberships
-- Regular users have is_platform_admin = false, one or more memberships
```

### Session Context

```typescript
interface Session {
  user_id: string;
  email: string;
  name: string;

  // Platform level
  is_platform_admin: boolean;

  // Current organization context (null for platform admin in platform view)
  current_organization_id: string | null;
  current_organization_code: string | null;
  current_organization_name: string | null;

  // Available organizations (for org switcher)
  memberships: Array<{
    organization_id: string;
    organization_code: string;
    organization_name: string;
    roles: string[];
    is_primary: boolean;
  }>;
}
```

### Org Switcher UI

Users with multiple memberships see an organization switcher in the sidebar:

```
┌─────────────────────┐
│  Current: INERCE    │
│  [Switch Org ▼]     │
│                     │
│  • INERCE (current) │
│  • Acme Trading     │
│  • Beta Logistics   │
└─────────────────────┘
```

---

## Permission Model

### Three-Layer Architecture

```
Layer 1: Organization Features
├── What features/pages the ORG can access
├── Configured by Super Admin
├── Based on org type template + customization
└── Stored in: organization_features table

Layer 2: Role Permissions
├── Global role templates (same everywhere)
├── Each role = bundle of feature permissions
├── User can have multiple roles per org
└── Stored in: roles, user_roles tables

Layer 3: User Overrides
├── Add or remove specific permissions
├── Applies within a specific organization
└── Stored in: user_permission_overrides table
```

### Database Schema

```sql
-- Features available in the system
CREATE TABLE features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,         -- "orders.view", "inventory.edit"
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,                     -- For UI grouping
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Features enabled per organization
CREATE TABLE organization_features (
  organization_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  feature_code TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  PRIMARY KEY (organization_id, feature_code)
);

-- Global role definitions
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,         -- "Sales Agent", "Org Admin", etc.
  description TEXT,
  permissions TEXT[],                -- Array of feature codes
  is_system BOOLEAN DEFAULT false,   -- Built-in vs custom
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User roles within an organization
CREATE TABLE user_roles (
  user_id UUID REFERENCES portal_users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, organization_id, role_id)
);

-- User permission overrides within an organization
CREATE TABLE user_permission_overrides (
  user_id UUID REFERENCES portal_users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  feature_code TEXT NOT NULL,
  granted BOOLEAN NOT NULL,          -- true = add, false = remove
  PRIMARY KEY (user_id, organization_id, feature_code)
);

-- Seed default roles
INSERT INTO roles (name, description, permissions, is_system) VALUES
  ('Org Admin', 'Manages users within organization',
   ARRAY['users.view', 'users.invite', 'users.edit', 'users.remove'], true),
  ('Sales Agent', 'Handles sales and client relationships',
   ARRAY['orders.*', 'clients.*', 'quotes.*'], true),
  ('Production Manager', 'Manages production operations',
   ARRAY['production.*', 'inventory.view'], true),
  ('Viewer', 'Read-only access',
   ARRAY['*.view'], true);
```

### Permission Calculation

```typescript
function getUserPermissions(
  userId: string,
  organizationId: string
): string[] {
  // 1. Get organization's enabled features
  const orgFeatures = getOrgFeatures(organizationId);

  // 2. Get all permissions from user's roles in this org
  const rolePermissions = getUserRolePermissions(userId, organizationId);

  // 3. Get user's overrides in this org
  const overrides = getUserOverrides(userId, organizationId);

  // 4. Calculate effective permissions
  let effective = new Set<string>();

  // Add role permissions that are within org features
  for (const perm of rolePermissions) {
    if (isFeatureEnabled(perm, orgFeatures)) {
      effective.add(perm);
    }
  }

  // Apply overrides
  for (const override of overrides) {
    if (override.granted) {
      if (isFeatureEnabled(override.feature_code, orgFeatures)) {
        effective.add(override.feature_code);
      }
    } else {
      effective.delete(override.feature_code);
    }
  }

  return Array.from(effective);
}
```

---

## Super Admin Features

### View As (Impersonation)

Super Admin can impersonate any organization or user for testing/support:

```typescript
interface ViewAsState {
  active: boolean;
  organization_id?: string;
  user_id?: string;           // Optional: impersonate specific user
  read_only: boolean;         // Whether actions are allowed
}
```

**UI Implementation:**

```
┌─────────────────────────────────────────────────────────────────┐
│  [Platform Admin]  [View as: Select organization ▼]            │
│                                                                 │
│  When active:                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ⚠️ Viewing as: INERCE / Viktor                              ││
│  │ [Exit View As]                              [Read-Only: ✓]  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

**Audit Trail:** All actions while impersonating are logged with:
- `acting_as_user_id` - who Super Admin was impersonating
- `actual_user_id` - the Super Admin's real ID
- `action` - what was done
- `timestamp`

### Delegated Platform Admins (Future)

```sql
-- Platform admin permissions (future)
CREATE TABLE platform_admin_permissions (
  user_id UUID REFERENCES portal_users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,           -- "orgs.manage", "users.manage", etc.
  PRIMARY KEY (user_id, permission)
);
```

---

## Data Visibility

### Default: Complete Isolation

Each organization sees only their own data. All queries filter by `organisation_id`.

### Cross-Org Visibility Grants (Future)

For specific use cases (e.g., logistics company seeing shipments):

```sql
-- Cross-org data visibility grants (future)
CREATE TABLE cross_org_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grantee_org_id UUID REFERENCES organisations(id),
  grantor_org_id UUID REFERENCES organisations(id),
  data_type TEXT NOT NULL,            -- "shipments", "orders", etc.
  access_level TEXT NOT NULL,         -- "view", "edit"
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES portal_users(id)
);
```

---

## Migration Path from Current MVP

### Phase 1: Schema Updates

1. Create new tables: `organization_types`, `organization_type_assignments`, `features`, `roles`, `user_roles`, `user_permission_overrides`, `organization_memberships`
2. Migrate existing `portal_users.organisation_id` to `organization_memberships`
3. Assign default types to existing organizations
4. Seed roles and features

### Phase 2: Code Updates

1. Update session handling for multi-org membership
2. Add org switcher to sidebar
3. Implement permission checking using new model
4. Update all queries to use membership context

### Phase 3: Feature Enablement

1. Implement org type configuration UI
2. Implement role management UI
3. Implement feature configuration per org
4. Implement View As for Super Admin

---

## Implementation Priority

| Priority | Feature | Dependencies |
|----------|---------|--------------|
| 1 | Organization types table + assignment | None |
| 2 | Multi-org membership | Org types |
| 3 | Roles and permissions tables | Memberships |
| 4 | Permission checking in code | Roles |
| 5 | Org switcher UI | Multi-org membership |
| 6 | Feature configuration UI | All above |
| 7 | View As for Super Admin | All above |

---

## Backward Compatibility

During migration:
- Existing users with `organisation_id` get a membership record created
- Existing organizations get default type assignment based on current usage
- Current permission checks (`role === 'admin'`) continue to work
- New permission system is opt-in until fully migrated

---

## Summary: Key Decisions

| Decision | Choice |
|----------|--------|
| Portal architecture | Single `apps/portal/` with role-based views |
| Org types | Tags, not separate tables/classes |
| User membership | One user → multiple orgs |
| Roles | Global templates with per-user overrides |
| Features | Configurable per org by Super Admin |
| Org Admin | Optional role, not mandatory |
| Data isolation | Default isolated, grantable cross-org (future) |
| Super Admin | Platform-level, uses View As, not org member |

---

## Reference Documents

- Analysis: `_bmad-output/analysis/multi-tenant-architecture-design-2026-02-01.md`
- Original Vision: `_bmad-output/analysis/platform-vision-capture-2026-01-20.md`
- Current Implementation: Epics 1-9 in sprint-status.yaml

