---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/product-brief-Timber-World-2026-01-20.md'
  - '_bmad-output/analysis/platform-deep-analysis-2026-01-20.md'
  - '_bmad-output/analysis/platform-vision-capture-2026-01-20.md'
workflowType: 'architecture'
project_name: 'Timber-World'
user_name: 'Nils'
date: '2026-01-21'
status: 'complete'
completedAt: '2026-01-21'
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

**Full-stack B2B SaaS Platform** - The portal will be a Next.js application within the existing Turborepo monorepo, sharing packages with the marketing app.

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

**New for Portal (not in marketing app):**

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

# Initialize with Next.js (matching marketing app pattern)
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
| **UI Components** | shadcn/ui | Consistent with marketing app, accessible, customizable |
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
**Document Location:** `_bmad-output/planning-artifacts/architecture.md`

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

