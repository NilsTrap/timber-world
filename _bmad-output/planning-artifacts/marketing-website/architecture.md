---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
status: complete
completedAt: '2026-01-10'
inputDocuments:
  - '_bmad-output/planning-artifacts/marketing-website/prd.md'
  - '_bmad-output/planning-artifacts/product-brief-marketing-website-2026-01-04.md'
  - '_bmad-output/analysis/brainstorming-marketing-website-2026-01-04.md'
workflowType: 'architecture'
project_name: 'Timber-International'
user_name: 'Nils'
date: '2026-01-09'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
56 requirements across 8 capability areas:
- Homepage & Emotional Experience (5 FRs) - Immersive visual storytelling
- Product Catalog (11 FRs) - Interactive filtering, pricing display, stock status
- Quotation System (10 FRs) - Dual-path (form + chatbot), standard vs custom products
- Industry Resources (5 FRs) - Static educational content for SEO
- Multi-Language Support (4 FRs) - 8 languages via auto-translation
- Admin Content Management (6 FRs) - Inventory/pricing file uploads with validation
- Admin Analytics (7 FRs) - Visitor tracking, engagement metrics, conversion funnels
- Internal Quote Management (8 FRs) - Request queue, response tracking, follow-ups

**Non-Functional Requirements:**
- Performance: Core Web Vitals targets (LCP <2.5s, FCP <1.5s, TTI <3.5s)
- SEO: Server-side rendering, XML sitemap, hreflang for 8 languages
- Accessibility: WCAG 2.1 Level A compliance
- Security: TLS 1.2+, GDPR compliance, admin authentication
- Scalability: 100 concurrent visitors, 5x growth capacity
- Reliability: 99.5% uptime, <24h recovery point

**Scale & Complexity:**
- Primary domain: B2B web application
- Complexity level: Medium
- Estimated architectural components: ~12-15 (frontend pages, API endpoints, admin panel, integrations)

### Technical Constraints & Dependencies

**Required External Integrations:**
1. Auto-translation API - Critical for multi-language feature
2. AI/LLM service - Required for chatbot functionality (form is fallback)
3. Analytics platform - Required for tracking and reporting
4. Email service - Required for quote confirmations and notifications

**Data Dependencies:**
- Inventory/pricing data supplied via file upload (CSV format)
- No real-time ERP integration in MVP
- Weekly update cycle acceptable

**Browser/Platform Constraints:**
- Desktop-first responsive design
- Latest 2 versions of major browsers
- No IE support required

### Cross-Cutting Concerns Identified

1. **Image Optimization** - Production journey visuals must be high-quality yet performant across all pages
2. **Translation Integration** - All user-facing content must flow through translation layer
3. **Error Handling** - Graceful degradation when external services (chatbot, translation) fail
4. **Authentication** - Admin panel requires secure access control
5. **Analytics Tracking** - Consistent event tracking across all user interactions
6. **SEO Optimization** - Proper meta tags, structured data, and crawlability throughout

## Starter Template Evaluation

### Primary Technology Domain

**Full-stack web application with SSR/SSG** based on project requirements:
- SEO-critical B2B website with 8-language support
- High-quality imagery requiring optimization
- Interactive product catalog with filtering
- AI chatbot integration
- Admin panel for content management

### Starter Options Considered

| Option | Pros | Cons | Fit |
|--------|------|------|-----|
| **Next.js** | Best SSR/SSG, image optimization, largest ecosystem, Vercel deployment | React learning curve if new | ✅ Best fit |
| **Nuxt 4** | Excellent Vue-based alternative, similar capabilities | Smaller ecosystem than Next.js | Good alternative |
| **Remix** | Great performance, web standards focused | Less SSG support, smaller ecosystem | Partial fit |
| **Astro** | Excellent for static content | Less suited for dynamic catalog/forms | Partial fit |

### Selected Starter: Next.js (App Router)

**Rationale for Selection:**
1. **SEO Excellence** - Built-in SSR/SSG with automatic hreflang support for multi-language
2. **Image Optimization** - `next/image` component handles production journey visuals with lazy loading, WebP conversion, responsive sizing
3. **Hybrid Rendering** - Static pages (homepage, resources) + dynamic pages (catalog with ISR)
4. **Performance** - Turbopack for fast development, automatic code splitting, edge runtime support
5. **Ecosystem** - Rich library support for AI (Vercel AI SDK), forms, analytics
6. **Deployment** - Seamless Vercel deployment with edge functions, or self-host options

**Initialization Command:**

```bash
npx create-next-app@latest timber-international \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --turbopack \
  --src-dir \
  --import-alias "@/*"
```

### Architectural Decisions Provided by Starter

**Language & Runtime:**
- TypeScript for type safety and better developer experience
- Node.js 20+ runtime requirement
- React 19 with Server Components by default

**Styling Solution:**
- Tailwind CSS v4 for utility-first styling
- CSS Modules available as fallback
- No CSS-in-JS runtime overhead

**Build Tooling:**
- Turbopack for development (faster than Webpack)
- SWC for production builds
- Automatic code splitting and tree shaking

**Code Organization:**
- App Router with file-based routing
- `src/` directory for cleaner project root
- `@/*` import alias for clean imports

**Development Experience:**
- Fast Refresh for instant feedback
- TypeScript strict mode
- ESLint with Next.js rules
- Built-in error overlay

**Note:** Project initialization using this command should be the first implementation story.

## Core Architectural Decisions

### Decision Summary

| Category | Decision | Rationale |
|----------|----------|-----------|
| **Database** | Supabase (PostgreSQL) | Managed Postgres + Auth + API, great DX |
| **Auth** | Supabase Auth (email/password) | Built-in with database choice |
| **Translation** | next-intl + pre-translated JSON | SEO-friendly, no runtime costs |
| **AI Chatbot** | Vercel AI SDK + Anthropic | Best Next.js integration, Claude quality |
| **Email** | Resend | Modern API, generous free tier |
| **Analytics** | Vercel Analytics | Zero config, integrated hosting |
| **UI Components** | shadcn/ui | Tailwind-based, accessible, customizable |
| **State** | Server Components + URL state | Minimal complexity, App Router native |
| **Forms** | React Hook Form + Zod | Type-safe validation, industry standard |
| **Hosting** | Vercel | Optimal Next.js support, edge functions |
| **CI/CD** | Vercel Git Integration | Auto-deploy, preview branches |
| **Monitoring** | Vercel Logs | Built-in, Sentry as future option |

### Data Architecture

**Database: Supabase (PostgreSQL)**
- Managed PostgreSQL with built-in REST API
- Row Level Security (RLS) for data protection
- Real-time subscriptions available if needed later
- Generous free tier for MVP

**Data Models Required:**
- `products` - Catalog items with pricing, stock, specifications
- `quote_requests` - Customer quote submissions
- `admin_users` - Internal users with Supabase Auth

**Data Flow:**
- CSV upload → Validation → Supabase products table
- Quote form → Supabase quote_requests → Email notification via Resend

### Authentication & Security

**Admin Authentication: Supabase Auth**
- Email/password authentication for admin users
- Session management handled by Supabase
- Next.js middleware for route protection

**Security Measures:**
- HTTPS enforced (Vercel default)
- Environment variables for all secrets
- Row Level Security on Supabase tables
- CSRF protection via Next.js defaults

**Public Access:**
- No authentication for visitors
- Quote requests stored with contact info only

### API & Communication Patterns

**Internal API: Next.js API Routes + Server Actions**
- Server Actions for form submissions (quote requests)
- API routes for admin operations (data upload, quote management)
- Supabase client for database operations

**External Integrations:**

| Service | Purpose | Integration Method |
|---------|---------|-------------------|
| Supabase | Database + Auth | `@supabase/supabase-js` |
| Anthropic | AI Chatbot | Vercel AI SDK |
| Resend | Email notifications | `resend` npm package |
| Vercel Analytics | Tracking | `@vercel/analytics` |

**Error Handling:**
- Graceful degradation if chatbot unavailable (form fallback)
- Toast notifications for user feedback
- Structured error logging

### Frontend Architecture

**UI Components: shadcn/ui**
- Tailwind-based component library
- Accessible (Radix primitives)
- Customizable, code owned by project

**Key Components Needed:**
- Product filter sidebar
- Data table for catalog
- Quote request form
- AI chat interface
- Admin dashboard layout

**State Management: Minimal Approach**
- React Server Components for data fetching
- URL search params for catalog filter state
- `useState` for local UI interactions
- No global state library initially

**Form Handling: React Hook Form + Zod**
- Type-safe form validation
- Schema shared between client/server
- Progressive enhancement support

### Infrastructure & Deployment

**Hosting: Vercel**
- Automatic HTTPS
- Edge network for global performance
- Preview deployments for PR review
- Serverless functions for API routes

**CI/CD: Vercel Git Integration**
- Auto-deploy on push to `main`
- Preview deployments for feature branches
- Environment variables per deployment

**Environment Configuration:**
- Production secrets in Vercel dashboard
- `.env.local` for local development
- Separate Supabase projects for dev/prod recommended

**Monitoring:**
- Vercel Logs for request/error tracking
- Vercel Analytics for user metrics
- Sentry integration path available for future

### Technology Version Summary

| Technology | Version | Notes |
|------------|---------|-------|
| Next.js | 16.x | App Router, Turbopack |
| React | 19.x | Server Components |
| TypeScript | 5.x | Strict mode |
| Tailwind CSS | 4.x | Utility-first |
| Supabase | Latest | Managed service |
| Vercel AI SDK | 6.x | Anthropic provider |
| shadcn/ui | Latest | Component library |
| React Hook Form | Latest | Form handling |
| Zod | Latest | Schema validation |
| next-intl | Latest | i18n |
| Resend | Latest | Email |

## Implementation Patterns & Consistency Rules

These patterns ensure all AI agents write compatible, consistent code that works together seamlessly.

### Naming Patterns

**Database Naming (Supabase/PostgreSQL):**

| Element | Convention | Example |
|---------|------------|---------|
| Tables | snake_case, plural | `products`, `quote_requests`, `admin_users` |
| Columns | snake_case | `created_at`, `unit_price`, `stock_quantity` |
| Foreign keys | `{table_singular}_id` | `product_id`, `user_id` |
| Indexes | `idx_{table}_{column}` | `idx_products_sku`, `idx_quotes_email` |
| Enums | snake_case | `quote_status`, `product_type` |

**API & Route Naming (Next.js):**

| Element | Convention | Example |
|---------|------------|---------|
| API routes | kebab-case, plural | `/api/products`, `/api/quote-requests` |
| Dynamic routes | `[param]` format | `/products/[id]`, `/[locale]/products` |
| Query params | camelCase | `?sortBy=price&filterType=oak` |
| Route groups | `(groupName)` | `(public)`, `(admin)` |

**Code Naming (TypeScript/React):**

| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase file & export | `ProductCard.tsx` → `export function ProductCard()` |
| Hooks | camelCase with `use` prefix | `useProducts.ts` → `export function useProducts()` |
| Utilities | camelCase | `formatPrice.ts` → `export function formatPrice()` |
| Constants | UPPER_SNAKE_CASE | `MAX_PRODUCTS_PER_PAGE = 50` |
| Types/Interfaces | PascalCase, no prefix | `Product`, `QuoteRequest` (not `IProduct`) |
| Zod schemas | camelCase with Schema suffix | `productSchema`, `quoteRequestSchema` |

### Structure Patterns

**Project Organization:**

```
src/
├── app/                          # Next.js App Router
│   ├── (public)/                 # Public routes (no auth required)
│   │   ├── page.tsx              # Homepage + production journey
│   │   ├── products/
│   │   │   └── page.tsx          # Product catalog
│   │   ├── quote/
│   │   │   └── page.tsx          # Quote request form + chatbot
│   │   ├── resources/
│   │   │   └── page.tsx          # Industry resources
│   │   └── contact/
│   │       └── page.tsx          # Contact page
│   ├── (admin)/                  # Admin routes (auth required)
│   │   └── admin/
│   │       ├── page.tsx          # Dashboard
│   │       ├── quotes/
│   │       ├── products/
│   │       └── analytics/
│   ├── api/                      # API routes
│   │   ├── products/
│   │   ├── quotes/
│   │   └── admin/
│   ├── [locale]/                 # i18n locale wrapper
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── layout/                   # Header, Footer, Navigation
│   ├── features/                 # Feature-specific components
│   │   ├── products/             # ProductCard, ProductFilter, etc.
│   │   ├── quote/                # QuoteForm, ChatBot, etc.
│   │   └── admin/                # AdminTable, DataUpload, etc.
│   └── shared/                   # Shared components (LoadingSpinner, etc.)
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server client
│   │   └── admin.ts              # Admin client (service role)
│   ├── actions/                  # Server Actions
│   ├── validations/              # Zod schemas
│   └── utils/                    # Helper functions
├── types/
│   ├── database.ts               # Supabase generated types
│   └── index.ts                  # Shared types
├── hooks/                        # Custom React hooks
├── messages/                     # i18n translation files
│   ├── en.json
│   ├── fi.json
│   └── ...
└── config/                       # App configuration
    └── site.ts                   # Site metadata, navigation
```

**Test Organization:**

| Type | Location | Naming |
|------|----------|--------|
| Unit tests | Co-located | `ComponentName.test.tsx` |
| Integration tests | `tests/integration/` | `feature.test.ts` |
| E2E tests | `tests/e2e/` | `user-journey.spec.ts` |

### Format Patterns

**API Response Structure:**

```typescript
// Success response (single item)
{ data: Product }

// Success response (list)
{
  data: Product[],
  meta: { total: number, page: number, pageSize: number }
}

// Error response
{
  error: {
    message: string,      // User-friendly message
    code: string,         // Machine-readable code
    details?: unknown     // Optional validation details
  }
}

// Common error codes
"VALIDATION_ERROR" | "NOT_FOUND" | "UNAUTHORIZED" | "FORBIDDEN" | "INTERNAL_ERROR"
```

**Data Exchange Formats:**

| Data Type | Format | Example |
|-----------|--------|---------|
| Dates | ISO 8601 | `"2026-01-10T14:30:00Z"` |
| IDs | UUID | `"550e8400-e29b-41d4-a716-446655440000"` |
| Money | Number (cents) | `2500` for €25.00 |
| JSON fields | camelCase | `unitPrice`, `createdAt` |
| Booleans | true/false | `isActive: true` |

### Process Patterns

**Error Handling:**

```typescript
// Custom error class
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 500
  ) {
    super(message)
  }
}

// Server-side usage
throw new AppError("Product not found", "NOT_FOUND", 404)

// Client-side: toast notifications via sonner
import { toast } from "sonner"
toast.error("Failed to submit quote. Please try again.")

// Logging format
console.error("[API] Operation failed", {
  operation: "submitQuote",
  error: error.message,
  context: { quoteId }
})
```

**Loading State Patterns:**

| State | Variable Name | UI Pattern |
|-------|---------------|------------|
| Initial load | `isLoading` | Skeleton loader |
| Form submission | `isPending` | Button spinner + disabled |
| Background refresh | `isRefetching` | Subtle indicator |

**Server Action Pattern:**

```typescript
// Always return consistent shape
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export async function submitQuote(formData: FormData): Promise<ActionResult<Quote>> {
  // ... implementation
}
```

### Enforcement Guidelines

**All AI Agents MUST:**

1. Follow naming conventions exactly as specified above
2. Place files in the correct directories per structure patterns
3. Use the standard API response format for all endpoints
4. Handle errors using the AppError class and toast notifications
5. Use Server Components by default, Client Components only when needed
6. Validate all inputs with Zod schemas before processing

**Pattern Verification:**

- TypeScript strict mode catches naming/type issues
- ESLint rules enforce code style
- PR reviews verify structure compliance
- Co-located tests verify component behavior

### Anti-Patterns to Avoid

| Don't | Do |
|-------|-----|
| `IProduct`, `ProductInterface` | `Product` |
| `getUserData()` returning raw data | Return `{ data }` or `{ error }` |
| `onClick={() => fetch(...)}` | Use Server Actions or React Query |
| Inline styles | Tailwind classes |
| `any` type | Proper TypeScript types |
| Console.log in production | Structured logging |
| Storing secrets in code | Environment variables |

## Project Structure & Boundaries

### Complete Project Directory Structure

```
timber-international/
├── README.md
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
├── components.json                 # shadcn/ui config
├── .env.local                      # Local environment (gitignored)
├── .env.example                    # Environment template
├── .gitignore
├── .eslintrc.json
├── .github/
│   └── workflows/
│       └── ci.yml                  # GitHub Actions (lint, type-check)
│
├── public/
│   ├── images/
│   │   ├── journey/                # Production journey photos
│   │   │   ├── forest.webp
│   │   │   ├── logs.webp
│   │   │   ├── sawmill.webp
│   │   │   ├── kilns.webp
│   │   │   ├── panels.webp
│   │   │   ├── cnc.webp
│   │   │   └── finishing.webp
│   │   ├── products/               # Product thumbnails
│   │   └── hero/                   # Homepage hero images
│   ├── fonts/                      # Custom fonts (if any)
│   └── favicon.ico
│
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx              # Root layout (providers, analytics)
│   │   ├── not-found.tsx
│   │   │
│   │   ├── [locale]/               # i18n locale wrapper
│   │   │   ├── layout.tsx          # Locale layout
│   │   │   ├── page.tsx            # Homepage + production journey
│   │   │   │
│   │   │   ├── products/
│   │   │   │   └── page.tsx        # Product catalog (FR6-FR16)
│   │   │   │
│   │   │   ├── quote/
│   │   │   │   └── page.tsx        # Quote form + chatbot (FR17-FR26)
│   │   │   │
│   │   │   ├── resources/
│   │   │   │   └── page.tsx        # Industry resources (FR27-FR29)
│   │   │   │
│   │   │   └── contact/
│   │   │       └── page.tsx        # Contact page (FR30-FR31)
│   │   │
│   │   ├── admin/
│   │   │   ├── layout.tsx          # Admin layout (auth check)
│   │   │   ├── page.tsx            # Admin dashboard
│   │   │   ├── login/
│   │   │   │   └── page.tsx        # Admin login
│   │   │   ├── quotes/
│   │   │   │   ├── page.tsx        # Quote queue (FR49-FR56)
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx    # Quote detail
│   │   │   ├── products/
│   │   │   │   ├── page.tsx        # Product management
│   │   │   │   └── upload/
│   │   │   │       └── page.tsx    # CSV upload (FR36-FR41)
│   │   │   └── analytics/
│   │   │       └── page.tsx        # Analytics dashboard (FR42-FR48)
│   │   │
│   │   └── api/
│   │       ├── products/
│   │       │   └── route.ts        # GET products
│   │       ├── quotes/
│   │       │   └── route.ts        # POST quote request
│   │       ├── chat/
│   │       │   └── route.ts        # AI chatbot endpoint
│   │       └── admin/
│   │           ├── upload/
│   │           │   └── route.ts    # CSV upload handler
│   │           └── quotes/
│   │               └── [id]/
│   │                   └── route.ts # Quote management
│   │
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── table.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── skeleton.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/
│   │   │   ├── Header.tsx          # Sticky navigation
│   │   │   ├── Footer.tsx
│   │   │   ├── Navigation.tsx
│   │   │   ├── LanguageSwitcher.tsx
│   │   │   └── AdminSidebar.tsx
│   │   │
│   │   ├── features/
│   │   │   ├── home/
│   │   │   │   ├── HeroSection.tsx
│   │   │   │   ├── ProductionJourney.tsx
│   │   │   │   └── JourneyStep.tsx
│   │   │   │
│   │   │   ├── products/
│   │   │   │   ├── ProductCatalog.tsx
│   │   │   │   ├── ProductFilter.tsx
│   │   │   │   ├── ProductTable.tsx
│   │   │   │   ├── ProductRow.tsx
│   │   │   │   └── PriceDisplay.tsx
│   │   │   │
│   │   │   ├── quote/
│   │   │   │   ├── QuoteForm.tsx
│   │   │   │   ├── ChatBot.tsx
│   │   │   │   ├── ChatMessage.tsx
│   │   │   │   └── QuoteConfirmation.tsx
│   │   │   │
│   │   │   └── admin/
│   │   │       ├── QuoteQueue.tsx
│   │   │       ├── QuoteDetail.tsx
│   │   │       ├── DataUpload.tsx
│   │   │       ├── UploadPreview.tsx
│   │   │       └── AnalyticsChart.tsx
│   │   │
│   │   └── shared/
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── SEOHead.tsx
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           # Browser Supabase client
│   │   │   ├── server.ts           # Server Supabase client
│   │   │   ├── admin.ts            # Service role client
│   │   │   └── middleware.ts       # Auth middleware helper
│   │   │
│   │   ├── ai/
│   │   │   ├── anthropic.ts        # Anthropic client setup
│   │   │   └── prompts.ts          # Chat system prompts
│   │   │
│   │   ├── email/
│   │   │   ├── resend.ts           # Resend client
│   │   │   └── templates.tsx       # Email templates
│   │   │
│   │   ├── actions/
│   │   │   ├── quotes.ts           # submitQuote, getQuotes
│   │   │   ├── products.ts         # getProducts, uploadProducts
│   │   │   └── auth.ts             # login, logout
│   │   │
│   │   ├── validations/
│   │   │   ├── quote.ts            # quoteRequestSchema
│   │   │   ├── product.ts          # productSchema, uploadSchema
│   │   │   └── auth.ts             # loginSchema
│   │   │
│   │   └── utils/
│   │       ├── formatters.ts       # formatPrice, formatDate
│   │       ├── csv-parser.ts       # CSV upload parsing
│   │       └── errors.ts           # AppError class
│   │
│   ├── types/
│   │   ├── database.ts             # Supabase generated types
│   │   ├── product.ts              # Product, ProductFilter
│   │   ├── quote.ts                # QuoteRequest, QuoteResponse
│   │   └── index.ts                # Re-exports
│   │
│   ├── hooks/
│   │   ├── useProducts.ts          # Product fetching/filtering
│   │   ├── useQuoteForm.ts         # Quote form state
│   │   └── useLocale.ts            # i18n helpers
│   │
│   ├── config/
│   │   ├── site.ts                 # Site metadata, navigation
│   │   ├── i18n.ts                 # Locale configuration
│   │   └── products.ts             # Filter options, categories
│   │
│   ├── messages/                   # i18n translation files
│   │   ├── en.json
│   │   ├── fi.json
│   │   ├── sv.json
│   │   ├── no.json
│   │   ├── da.json
│   │   ├── nl.json
│   │   ├── de.json
│   │   └── es.json
│   │
│   └── middleware.ts               # Auth + i18n middleware
│
├── tests/
│   ├── components/                 # Component unit tests
│   ├── integration/                # API integration tests
│   └── e2e/                        # Playwright E2E tests
│       └── quote-flow.spec.ts
│
└── supabase/
    ├── migrations/                 # Database migrations
    │   └── 001_initial_schema.sql
    └── seed.sql                    # Development seed data
```

### Architectural Boundaries

**API Boundaries:**

| Boundary | Access | Auth Required |
|----------|--------|---------------|
| `/api/products` | Public | No |
| `/api/quotes` | Public | No |
| `/api/chat` | Public | No |
| `/api/admin/*` | Admin only | Yes (Supabase Auth) |

**Route Boundaries:**

| Route Group | Purpose | Auth |
|-------------|---------|------|
| `[locale]/*` | Public pages | None |
| `admin/*` | Admin panel | Required |
| `api/*` | API endpoints | Varies |

**Data Boundaries:**

| Layer | Responsibility |
|-------|---------------|
| Server Actions | Form submissions, data mutations |
| API Routes | External integrations (chat, webhooks) |
| Supabase Client | Direct database access (queries) |
| Supabase Admin | Service role operations (admin) |

### Requirements to Structure Mapping

**FR1-FR5 (Homepage & Journey):**
- `src/app/[locale]/page.tsx`
- `src/components/features/home/*`
- `public/images/journey/*`

**FR6-FR16 (Product Catalog):**
- `src/app/[locale]/products/page.tsx`
- `src/components/features/products/*`
- `src/lib/actions/products.ts`
- `src/hooks/useProducts.ts`

**FR17-FR26 (Quotation System):**
- `src/app/[locale]/quote/page.tsx`
- `src/components/features/quote/*`
- `src/app/api/chat/route.ts`
- `src/lib/ai/*`
- `src/lib/actions/quotes.ts`

**FR27-FR31 (Resources & Contact):**
- `src/app/[locale]/resources/page.tsx`
- `src/app/[locale]/contact/page.tsx`

**FR32-FR35 (Multi-Language):**
- `src/messages/*.json`
- `src/config/i18n.ts`
- `src/middleware.ts`
- `src/components/layout/LanguageSwitcher.tsx`

**FR36-FR41 (Admin Content Management):**
- `src/app/admin/products/upload/page.tsx`
- `src/components/features/admin/DataUpload.tsx`
- `src/lib/utils/csv-parser.ts`

**FR42-FR48 (Admin Analytics):**
- `src/app/admin/analytics/page.tsx`
- `src/components/features/admin/AnalyticsChart.tsx`

**FR49-FR56 (Quote Management):**
- `src/app/admin/quotes/page.tsx`
- `src/app/admin/quotes/[id]/page.tsx`
- `src/components/features/admin/QuoteQueue.tsx`
- `src/lib/email/*`

### Integration Points

**External Services:**

| Service | Integration Point | Files |
|---------|-------------------|-------|
| Supabase | Database + Auth | `src/lib/supabase/*` |
| Anthropic | AI Chatbot | `src/lib/ai/*`, `src/app/api/chat/route.ts` |
| Resend | Email | `src/lib/email/*` |
| Vercel Analytics | Tracking | `src/app/layout.tsx` |

**Data Flow:**

```
User Request → Middleware (auth/i18n)
    → Server Component (data fetch via Supabase)
    → Client Component (interactivity)
    → Server Action (mutations)
    → Supabase (database)
    → Email notification (Resend)
```

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** All technology choices are compatible and work together without conflicts. The stack (Next.js 16 + Supabase + TypeScript + Tailwind + shadcn/ui) is a proven, production-ready combination.

**Pattern Consistency:** All patterns align with technology conventions:
- Database patterns follow PostgreSQL/Supabase standards
- Code patterns follow React/TypeScript best practices
- API patterns align with Next.js App Router conventions

**Structure Alignment:** Project structure fully supports all architectural decisions with clear boundaries between public/admin routes and proper separation of concerns.

### Requirements Coverage ✅

**Functional Requirements:** All 56 FRs mapped to specific files and directories in the project structure.

**Non-Functional Requirements:**
- Performance: Addressed via Next.js optimizations, image handling, caching
- Security: Addressed via Supabase Auth, RLS, Vercel HTTPS
- SEO: Addressed via SSR/SSG, next-intl hreflang support
- Accessibility: Addressed via shadcn/ui (Radix primitives)
- Scalability: Addressed via serverless architecture, managed services

### Implementation Readiness ✅

**AI Agent Guidelines:**
- All critical decisions documented with specific versions
- Implementation patterns comprehensive with examples
- Project structure complete with file-level detail
- Anti-patterns documented to prevent common mistakes

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed (Medium)
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped (6 identified)

**✅ Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified (12 technologies)
- [x] Integration patterns defined (4 external services)
- [x] Performance considerations addressed

**✅ Implementation Patterns**
- [x] Naming conventions established (database, API, code)
- [x] Structure patterns defined (project organization)
- [x] Communication patterns specified (API responses, events)
- [x] Process patterns documented (error handling, loading states)

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
1. Modern, proven technology stack with excellent documentation
2. Clear separation between public website and admin panel
3. Comprehensive patterns preventing AI agent conflicts
4. All requirements explicitly mapped to implementation locations
5. Graceful degradation strategies for external services

**Areas for Future Enhancement:**
1. Database schema details (define in first migration)
2. E2E test coverage plan (define during testing phase)
3. Performance monitoring thresholds (configure post-launch)

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Refer to this document for all architectural questions

**First Implementation Priority:**

```bash
npx create-next-app@latest timber-international \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --turbopack \
  --src-dir \
  --import-alias "@/*"
```

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED ✅
**Total Steps Completed:** 8
**Date Completed:** 2026-01-10
**Document Location:** `_bmad-output/planning-artifacts/marketing-website/architecture.md`

### Final Architecture Deliverables

**Complete Architecture Document**
- All architectural decisions documented with specific versions
- Implementation patterns ensuring AI agent consistency
- Complete project structure with all files and directories
- Requirements to architecture mapping
- Validation confirming coherence and completeness

**Implementation Ready Foundation**
- 12 architectural decisions made
- 5 implementation pattern categories defined
- 8 architectural component areas specified
- 56 requirements fully supported

**AI Agent Implementation Guide**
- Technology stack with verified versions
- Consistency rules that prevent implementation conflicts
- Project structure with clear boundaries
- Integration patterns and communication standards

### Development Sequence

1. Initialize project using documented starter template
2. Set up Supabase project and database schema
3. Configure environment variables (Supabase, Anthropic, Resend)
4. Install shadcn/ui components
5. Set up next-intl for multi-language support
6. Implement core features following established patterns
7. Maintain consistency with documented rules

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

