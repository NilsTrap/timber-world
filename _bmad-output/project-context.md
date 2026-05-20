---
project_name: 'Timber-World-Platform'
user_name: 'Nils'
date: '2026-05-20'
status: 'complete'
sections_completed: ['technology_stack', 'permissions', 'server_actions', 'multi_tenant', 'data_transform', 'supabase', 'react_nextjs', 'file_organization', 'naming', 'i18n', 'testing', 'critical_rules', 'realtime', 'session_verification', 'print_functionality', 'shipment_workflow', 'pallet_grouping', 'draft_blocking', 'competitor_pricing', 'marketing_stock', 'orders', 'modules_permissions', 'uk_staircase_pricing']
architecture_ref: '_bmad-output/planning-artifacts/platform/architecture.md'
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

**Two-layer module system (no roles, updated 2026-04-06):**
- `organization_modules` — ceiling of what's available for the org
- `user_modules` — per-user, per-org module access
- Effective permission = org has module AND user has module
- Platform admins (super admins) skip all checks
- Key tables: `modules` (registry), `organization_modules`, `user_modules`, `module_presets`
- Sub-module pattern: `orders.view`, `orders.create`, `orders.pricing`, etc.

Every Server Action MUST check permissions at the start:

```typescript
export async function updateOrder(orderId: string, data: UpdateOrderInput) {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Permission denied" };
  }
  // Only then proceed with business logic...
}

// Sidebar uses getUserEnabledModules (intersection of org + user modules)
const modules = await getUserEnabledModules(portalUserId, orgId);

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
| 1 | Pallet | dropdown | Shipment tables only (first position) |
| 2 | Shipment | readonly | `shipment_code` |
| 3 | Package | readonly | `package_number`, totalType: "count" |
| 4 | Product | dropdown, collapsible | `ref_product_names` |
| 5 | Species | dropdown, collapsible | `ref_wood_species` |
| 6 | Humidity | dropdown, collapsible | `ref_humidity` |
| 7 | Type | dropdown, collapsible | `ref_types` |
| 8 | Processing | dropdown, collapsible | `ref_processing` |
| 9 | FSC | dropdown, collapsible | `ref_fsc` |
| 10 | Quality | dropdown, collapsible | `ref_quality` |
| 11 | Thickness | text | placeholder "mm" |
| 12 | Width | text | placeholder "mm" |
| 13 | Length | text | placeholder "mm" |
| 14 | Pieces | text, numeric | totalType: "sum" |
| 15 | Vol m³ | custom/numeric | Auto-calculated or manual, totalType: "sum" |

**Note:** Pallet column only appears in shipment detail views. For general inventory tables, start from Shipment column.

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
- Display "-" for null/empty values, volume to 3 decimal places

### DataEntryTable Advanced Features

**Imperative Handle (ref):**
The table exposes a `DataEntryTableHandle` via `forwardRef` for external control:
```typescript
const tableRef = useRef<DataEntryTableHandle>(null);
// Clear all filters programmatically
tableRef.current?.clearFilters();
```

**Filter State Callback:**
Track when filters are active to show/hide external UI (e.g., "Clear Filters" button):
```typescript
<DataEntryTable
  onFilterActiveChange={(hasActiveFilters) => setShowClearButton(hasActiveFilters)}
/>
```

**Column Width Locking:**
The table automatically locks column widths on initial render to prevent layout jumping when filtering reduces visible content. This ensures stable table width even when filtered rows have shorter content than the full dataset.

**Clear Filters Button Pattern:**
For read-only tables with external Clear Filters button, use this pattern:
```typescript
const tableRef = useRef<DataEntryTableHandle>(null);
const [hasActiveFilters, setHasActiveFilters] = useState(false);

<div className="space-y-4 w-fit max-w-full">
  <div className="relative">
    <SummaryCards items={summaryItems} />
    {hasActiveFilters && (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => tableRef.current?.clearFilters()}
        className="text-xs h-7 absolute right-0 bottom-0"
      >
        <X className="h-3 w-3 mr-1" />
        Clear Filters
      </Button>
    )}
  </div>
  <DataEntryTable
    ref={tableRef}
    onFilterActiveChange={setHasActiveFilters}
    ...
  />
</div>
```

### Reference Data (7 Dropdowns)

All 7 dropdown columns reference admin-managed tables (`ref_*`). When querying:
- Use explicit FK names: `ref_product_names!inventory_packages_product_name_id_fkey(value)`
- Fetch active options only for edit forms: `.eq("is_active", true).order("sort_order")`
- For read-only display, resolve UUID → display value via FK join

### Date Formatting (MANDATORY)

All dates displayed in the portal MUST use European format: **DD.MM.YYYY** (e.g., `24.01.2026`).
Date+time uses: **DD.MM.YYYY HH:mm** (e.g., `24.01.2026 14:30`).

Use the utility functions from `@/lib/utils`:
```typescript
import { formatDate, formatDateTime } from "@/lib/utils";

formatDate("2026-01-24")        // → "24.01.2026"
formatDateTime("2026-01-24T14:30:00Z") // → "24.01.2026 14:30"
```

**NEVER** use `toLocaleDateString()` or `toLocaleString()` — these produce inconsistent results depending on the user's browser locale.

### Package Number Assignment (Production Outputs)

Production output package numbers are assigned manually via the "Assign Package Numbers" button, NOT auto-generated on row creation.

**Format:** `N-{PROCESS_CODE}-{NNNN}` (e.g., `N-SA-0001` for Sanding)

**Assignment Logic:**
1. User creates output rows (package_number starts empty)
2. User clicks "Assign Package Numbers" button when ready
3. System looks up current max number from:
   - `inventory_packages` (validated production)
   - `portal_production_outputs` (draft production)
4. Assigns sequential numbers starting from max + 1
5. Numbers wrap at 9999 back to 0001

**Key Files:**
- `assignPackageNumbers.ts` - Server action for lookup-based assignment
- `ProductionOutputsSection.tsx` - UI with "Assign Package Numbers" button

**Database:**
- `portal_production_outputs.package_number` is nullable (assigned later)
- `portal_production_outputs.sort_order` preserves row ordering

### Production Validation Requirements

Before a production entry can be validated, ALL output rows must have complete data:

**Required Fields (each output row):**
- Product Name
- Wood Species
- Humidity
- Type
- Processing
- FSC
- Quality
- Thickness, Width, Length (all three dimensions)
- Pieces OR Volume (at least one must be set)

**Validation Logic (`validateProduction.ts`):**
- Checks each output row sequentially
- Returns specific error message indicating which row and field is missing
- Prevents inventory creation with incomplete package data

### Volume Calculation

Volume auto-calculates when all conditions are met:
- Thickness, Width, Length are all single numbers (not ranges like "40-50")
- Pieces is a positive number (not "-")
- Formula: `(thickness × width × length × pieces) / 1,000,000,000` (mm³ → m³)
- When conditions aren't met, user enters volume manually
- Display format: Latvian locale with 3 decimal places (`0,000`) for both input and display

### Session Verification (Per-Window Authentication)

The portal requires users to authenticate for each new browser window/tab via `SessionVerificationGuard`:

**How it works:**
1. On successful login, `markSessionVerified()` sets a sessionStorage flag
2. When loading any protected page, `SessionVerificationGuard` checks for this flag
3. If flag is missing (new window/tab), user is signed out and redirected to login
4. Uses `hasChecked` ref to only verify once per component lifecycle (prevents re-checks on navigation)

**Key Files:**
- `src/components/SessionVerificationGuard.tsx` - Guard component and utility functions
- `src/features/auth/components/LoginForm.tsx` - Calls `markSessionVerified()` on success
- `src/app/(portal)/layout.tsx` - Wraps portal content with guard

**Functions:**
- `markSessionVerified()` - Call after successful login
- `clearSessionVerification()` - Call on logout

### Print Functionality Pattern

For printable views (inventory, production outputs), use React portals with print-specific CSS:

**Pattern:**
1. Create print button component with dialog preview
2. Use `createPortal()` to render `#print-area` div to `document.body`
3. Hide print area on screen, show only when printing via `@media print`

**Print CSS Template:**
```css
@media print {
  @page { size: landscape; margin: 10mm; }
  body > *:not(#print-area) { display: none !important; }
  #print-area {
    display: block !important;
    position: static !important;
    width: 100% !important;
  }
  #print-area table { width: 100% !important; font-size: 10pt !important; }
}
```

**Key Files:**
- `src/features/inventory/components/PrintInventoryButton.tsx`
- `src/features/production/components/PrintOutputsButton.tsx`

**Notes:**
- Print respects current table filters (pass `displayedPackages` not `allPackages`)
- Resolve dropdown IDs to display values for print output
- Include summary (total packages, pieces, volume) in header

## Shipment Workflow Patterns

### Status Labels

The shipment status "pending" is displayed as **"On The Way"** throughout the UI (never "Pending"):

| DB Status | UI Label | Description |
|-----------|----------|-------------|
| `draft` | Draft | Being prepared, editable |
| `pending` | On The Way | Sent, in transit |
| `accepted` | Accepted | Received by recipient |
| `rejected` | Rejected | Returned/refused |
| `completed` | Completed | Fully processed |

### Submit Button

The button to send a shipment shows "On The Way" with a truck icon (`<Truck />`), not "Submit".

### Inventory Lifecycle

**When shipment is marked "On The Way" (pending):**
- Packages are removed from sender's inventory queries
- Packages appear in admin inventory with amber background (`bg-amber-50`)
- Truck icon shows in Org column with tooltip "From Org → To Org"

**Query Pattern (exclude pending shipments from producer inventory):**
```typescript
// In getProducerPackages, getAvailablePackages:
.eq("shipments.status", "draft")  // Only draft shipments stay in inventory
// NOT: .in("shipments.status", ["draft", "pending"])
```

### Pallet Grouping

Packages within a shipment can be grouped into pallets:

**Database:**
```sql
shipment_pallets (id, shipment_id, pallet_number, notes)
inventory_packages.pallet_id → shipment_pallets.id
```

**UI (ShipmentPalletTable):**
- Pallet dropdown column in first position
- Options: "-" (without pallet), "Pallet 1", "Pallet 2", ..., "+ New Pallet"
- Packages grouped by pallet with per-pallet subtotals
- Section labeled "Without Pallet" (not "Loose")

### Bidirectional Draft Blocking (MANDATORY)

Packages cannot be in both production drafts and shipment drafts simultaneously.

**Production Draft → Shipment Selector:**
```typescript
// In getShipmentAvailablePackages:
// Query packages in production drafts
const { data: draftInputs } = await supabase
  .from("portal_production_inputs")
  .select(`package_id, portal_production_entries!inner(status)`)
  .eq("portal_production_entries.status", "draft");

// Mark packages with inProductionDraft: true
// UI: Show FileText icon, disabled, bg-amber-50
```

**Shipment Draft → Production Selector:**
```typescript
// In getAvailablePackages:
// Query packages in shipment drafts
// Mark packages with shipment info
// UI: Show Truck icon with tooltip, disabled, bg-blue-50
```

### Package Number Preservation

When adding existing packages to a shipment:
- Original package numbers are preserved (no renumbering)
- Removing a package unlinks it (doesn't delete)
- Use: `.update({ shipment_id: null, package_sequence: null })` to unlink

### Shipment Entry Display Format

In lists/tables, show shipment entries as:
```
{CODE}  {From Org Full Name} → {To Org Full Name}
Example: TIM-TWG-001  Timber International → The Wooden Good
```

## Competitor Pricing System

The competitor pricing feature scrapes UK timber competitor websites and compares prices with TIM (Timber International) stock prices.

### Key Tables
- `competitor_prices` — scraped product data with competitor and TIM prices
- `scraper_config` — per-source scraper configuration (species, thicknesses, qualities)
- `scraper_product_urls` — discovered product URLs for scraping
- `stock_prices` — TIM stock prices for comparison (species, panel_type, quality, thickness/length ranges)

### Price Diff Formula (Source-Aware)
- **Mass.ee** (EUR source): `diff = (comp - TIM) / TIM` — positive means competitor is more expensive (bad for TIM)
- **UK sources** (GBP sources): `diff = (TIM - comp) / comp` — positive means TIM is more expensive (bad for TIM)
- GBP → EUR conversion: `1 / 0.9`
- Colors: red = positive (bad), green = negative (good) — same for both source types

### Scrapers
- `tools/mass-scraper/` — Mass.ee (Playwright, Estonian e-commerce)
- `tools/sl-hardwoods-scraper/` — SL Hardwoods UK
- `tools/uk-timber-scraper/` — UK Timber
- `tools/timbersource-scraper/` — Timber Source (Playwright for Cloudflare)
- `tools/fiximer-scraper/` — Fiximer (WooCommerce variation parsing)
- Each scraper has `scraper.ts` (discover + scrape) and `push.ts` (upsert to competitor_prices with TIM price matching)

### Export to MAS Inventory
- Button on Scraped Data tab exports all Mass.ee products to MAS organisation inventory
- Creates dummy shipment (code: `SCRAPE-YYYYMMDD`)
- Deletes existing MAS packages, inserts new ones with TIM prices as unit prices (EUR cents)
- Species fallback: "ash white" → "Ash"; Quality fallback: "Rustic" → "BC"

## Marketing Stock Management

Located in CMS page → Stock tab. Two sub-tabs:
- **Stock** — consolidated inventory table from marketing-enabled organisations (with ColumnHeaderMenu sort/filter on all columns)
- **Sources** — toggle `marketing_enabled` per organisation

### Database
- `organisations.marketing_enabled` (BOOLEAN) — controls which orgs appear on marketing website stock page
- `organisations.is_external` (BOOLEAN) — external orgs are excluded from marketing stock display

### Marketing Website Stock Filter (Updated 2026-04-06)
Both `getProducts()` and `getFilterOptions()` in `apps/marketing/src/lib/actions/products.ts` now filter by:
- `is_active = true`
- `marketing_enabled = true`
- `is_external = false`

This ensures only internal marketing-enabled organisation packages appear on the public website.

## Orders Feature

Located in `apps/portal/src/features/orders/`. Five-tab interface:
- **List** — customer-facing summary (default tab for org users)
- **Prices** — order/product pricing reference
- **Sales** — order list with customer, dates, pricing, payment tracking
- **Production** — production status, planned dates, costs
- **Analytics** — order analytics and reporting

### Party Naming (User-Facing Labels ≠ DB columns)

The DB columns are `customer_organisation_id`, `seller_organisation_id`, `producer_organisation_id` — but the UI labels are intentionally different to better describe the supply chain roles:

| DB column / TS field | UI label |
|---|---|
| `customer_organisation_*` | **Customer** (end buyer) |
| `seller_organisation_*` | **Manufacturer** (orchestrator / brand owner — owns materials, hires workshop, sells to customer) |
| `producer_organisation_*` | **Workshop** (finishing subcontractor) |

When adding UI strings, always use the customer-facing labels. Don't rename the DB columns or TypeScript fields — that's a deliberate trade-off documented in CLAUDE.md.

The order files section similarly uses **"Workshop Files"** as the user-facing label (DB category value is still `"production"`).

### Per-Tab Field Visibility on Order Detail

The order detail header shows different fields depending on the active tab:
- **List**: Customer, Manufacturer, dates
- **Sales**: Customer, Manufacturer, Workshop, dates
- **Production**: Manufacturer, Workshop, dates (Customer hidden)

The "Ordered Products" summary also hides the £ price total on the Production tab.

### Key Patterns
- Orders have three org references: `seller_organisation_id`, `customer_organisation_id`, `producer_organisation_id`
- UK staircase orders link to `staircase_codes` for product pricing
- Order products stored in `order_products` table with package-level detail
- Each tab has its own `OrdersTable` instance with independent ColumnHeaderMenu filters
- Clear filters button wired via `DataEntryTableHandle` refs
- **Column sort + filters persist per-tab in sessionStorage** under `orders-<tab>-sort` and `orders-<tab>-filters` so users keep their working view across tab/page switches

### Module Sub-Permissions
- `orders.view`, `orders.create`, `orders.customer-select`, `orders.pricing`, `orders.production-status`
- `orders.tab.list`, `orders.tab.prices`, `orders.tab.sales`, `orders.tab.production`, `orders.tab.analytics`
- `orders.tab.production.edit` — granular edit permission. Lets finishing-workshop
  orgs edit a fixed allowlist of production-tab fields (dateLoaded, plannedDate,
  treadM3/winderM3/quarterM3/usedMaterialM3, productionMaterial, productionFinishing,
  productionInvoiceNumber, productionPaymentDate, woodArt, woodArtCnc,
  woodArtInvoiceNumber, woodArtPaymentDate) WITHOUT also granting orders.create.
  Enforced in `updateOrder.ts`: admin OR orders.create still unrestricted; otherwise
  this module is checked and any input field outside the allowlist returns FORBIDDEN
  with the field name.

### Order Status

Database enum `order_status` values:
- `draft` (default at creation)
- `confirmed`
- `loaded`
- `cancelled` (added 2026-05-19)

Status is selectable from the **List** and **Sales** tab via a click-to-change
dialog. On the **Production** tab the status renders as a plain non-clickable
Badge — workshop users without orders.create can't trigger permission-denied
toasts. UI helpers in `apps/portal/src/features/orders/types.ts`:
`OrderStatus`, `ORDER_STATUSES`, `getStatusLabel`, `getStatusBadgeVariant`.
Detail-page badge colour map in `OrderDetailClient.tsx` (`STATUS_COLORS`).

## UK Staircase Pricing

Located in `apps/portal/src/features/uk-staircase-pricing/`. Admin-managed pricing table for staircase products (treads, winders, quarters, platforms).

### Key Tables
- `staircase_codes` — product definitions with type, material, length
- `uk_staircase_pricing` — prices per staircase code
- `order_products.staircase_code_id` — links order products to pricing

## Production Package Number Assignment

`apps/portal/src/features/production/actions/assignPackageNumbers.ts` allocates
sequential package numbers (format `N-{PROCESS_CODE}-NNNN`, e.g. `N-CA-0042`)
for the draft outputs of a production entry.

**Defensive lookup (current behaviour):**
1. Build a Set of every taken number for `(organisation_id, process_code)` by
   union-ing `inventory_packages.package_number` and
   `portal_production_outputs.package_number` (the latter joined to entries of
   the same organisation).
2. Start candidate = `max(taken) + 1` (or 1 if taken is empty).
3. For each output needing a number, advance through candidates skipping any
   already in the taken Set. Locally reserve assigned numbers in the Set so a
   single batch can't hand out duplicates.

This was changed from the simpler "trust MAX + 1" approach because that
approach broke when gaps existed (re-validation that moved packages around,
deleted drafts whose validated inventory survived, manual entries, etc.) and
collisions only surfaced at validate time as "Output package numbers already
exist in inventory".

The function does NOT use a database-level atomic counter, so two concurrent
assigns running in the same instant could still collide. For human-paced
workflows it's reliable enough; if true atomicity becomes important the
follow-up would be a per-(org, process) counter table.

## Inventory Packages — `package_sequence`

The `package_sequence` column is overloaded with two unrelated meanings on
the same row:

1. **Production-output ordering** — position of a package within its production
   entry.
2. **Shipment-row ordering** — position of a package within its shipment.

Two partial unique indexes protect each scope:
- `idx_inventory_packages_production_seq` on `(production_entry_id, package_sequence)`
  WHERE `production_entry_id IS NOT NULL AND shipment_id IS NULL` (narrowed
  2026-05-20). Only enforces uniqueness while the package is in inventory; once
  shipped, the row falls out of this index.
- The shipment-level uniqueness on `(shipment_id, package_sequence)` WHERE
  `shipment_id IS NOT NULL`.

Practical consequence: when a package moves from inventory into a shipment,
its `package_sequence` is renumbered for the shipment without colliding with
siblings still in inventory under the same production entry. When a package
is removed from a shipment (`removePackageFromShipment` sets `shipment_id`
and `package_sequence` to NULL), the row re-enters the production-sequence
index with a NULL sequence — partial unique indexes treat NULL as distinct,
so multiple un-sequenced packages within the same production entry coexist.

## Production Entry Validation

Located in `apps/portal/src/features/production/actions/validateProduction.ts`. Several invariants MUST be preserved when modifying this code:

### Production Date Semantics

`portal_production_entries.production_date` has different meanings depending on lifecycle stage:

- **Draft**: date the draft was opened (set at creation in `createProductionEntry.ts`).
- **First validation**: overwritten to "today" so the completed-entries list files the entry under the completion date, not the draft-creation date.
- **Re-validation**: left untouched. The first-validation date is the canonical "completed on" date and never moves once recorded.

Other timestamps: `created_at` always holds the draft-creation moment; `validated_at` is overwritten on every validation (latest validation time); `updated_at` bumps on any UPDATE. Historical entries created before 2026-05-14 may still have `production_date` = draft-creation date.

### In-Place Output Update Invariants

When re-validating, the validator updates existing output `inventory_packages` rows in place rather than delete-and-insert. Three invariants protect against partial-update corruption:

1. **Phase 1 sets temp values for both number AND sequence:**
   - `package_number = __tmp_<entryId>_<i>` — guards `inventory_packages_org_package_unique` (organisation_id, package_number)
   - `package_sequence = -(i + 1)` (negative) — guards `idx_inventory_packages_production_seq` (production_entry_id, package_sequence), since real sequences are positive 1..N

2. **Consumed-status preservation:** Before writing the Phase 2 payload for each existing row, the validator queries `portal_production_inputs` for rows that reference our existing output IDs and belong to a *different* production entry. Any such ID is flagged as "consumed downstream" — its update payload is overridden with `{ status: "consumed", pieces: "0", volume_m3: 0 }` so the upstream re-validation doesn't resurrect already-consumed inventory.

3. **Rollback uses the same temp pattern:** On failure, the rollback first sequentially sets each row to `__tmp_rollback_<entryId>_<i>` + negative sequence, then writes originals in parallel. Otherwise the rollback itself can collide on the same unique indexes and leave rows stuck with `__tmp_*` package numbers.

If you touch `validateProduction.ts`, preserve all three.

## Architecture Reference

For complete architectural decisions, patterns, and project structure, see:
`_bmad-output/planning-artifacts/platform/architecture.md`
