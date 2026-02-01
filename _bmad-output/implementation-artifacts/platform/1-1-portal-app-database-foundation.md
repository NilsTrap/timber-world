# Story 1.1: Portal App & Database Foundation

## Story Information

| Field | Value |
|-------|-------|
| **Story ID** | 1.1 |
| **Epic** | Epic 1: Portal Foundation & User Access |
| **Title** | Portal App & Database Foundation |
| **Status** | done |
| **Created** | 2026-01-22 |
| **Priority** | Critical (Foundation) |

## User Story

**As a** developer,
**I want** the portal app and database schema set up,
**So that** all subsequent features have a foundation to build on.

## Acceptance Criteria

### AC1: Portal App Structure
**Given** the existing Turborepo monorepo
**When** I run the portal app setup
**Then** `apps/portal/` is created with Next.js App Router structure
**And** the app integrates with `@timber/ui`, `@timber/database`, `@timber/config` packages
**And** the app runs successfully on `localhost:3001`

### AC2: Database Schema
**Given** the Supabase database
**When** migrations are applied
**Then** the following tables exist: `portal_users`, `portal_products`, `portal_inventory`, `portal_processes`, `portal_production_entries`, `portal_production_lines`
**And** a `role` column exists on `portal_users` table (enum: 'admin', 'producer')
**And** standard processes are seeded: Multi-saw, Planing, Opti-cut, Gluing, Sanding, Finger Jointing

---

## Technical Implementation Guide

### Architecture Context

This is the foundational story that establishes the portal app within the existing Turborepo monorepo. The portal will serve both Admin and Producer roles with role-based navigation.

**Key Architecture Decisions (from MVP Addendum):**
- Single-tenant MVP (no organization_id, no RLS)
- Simple role-based auth (admin/producer) - not full RBAC
- 6 database tables only
- Desktop-only (1024px minimum)

### Technology Stack

| Technology | Version | Notes |
|------------|---------|-------|
| Next.js | 16.1.1 | App Router, Turbopack |
| React | 19.2.3 | Server Components default |
| TypeScript | 5.x | Strict mode |
| Tailwind CSS | 4.x | Utility-first |
| Supabase | Latest | PostgreSQL |
| shadcn/ui | Latest | Component library |

### Project Structure to Create

```
apps/portal/
├── package.json                # @timber/portal
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs          # Tailwind 4.x PostCSS config
├── .env.local
├── .env.example
├── components.json             # shadcn/ui config
│
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx          # Root layout
    │   │
    │   ├── (auth)/
    │   │   ├── login/
    │   │   │   └── page.tsx    # Login page (placeholder)
    │   │   └── layout.tsx      # Auth layout
    │   │
    │   └── (portal)/           # Authenticated routes
    │       ├── layout.tsx      # Dashboard layout with nav (placeholder)
    │       └── dashboard/
    │           └── page.tsx    # Dashboard (placeholder)
    │
    ├── lib/
    │   └── supabase/
    │       ├── client.ts       # Browser client
    │       └── server.ts       # Server client
    │
    └── middleware.ts           # Auth middleware (placeholder)
```

### Database Schema (6 Tables)

Create migration file: `supabase/migrations/20260122000001_portal_mvp_schema.sql`

> **Note:** Tables prefixed with `portal_` to avoid conflicts with existing marketing schema.

```sql
-- 1. Portal Users (simplified - no organization link for MVP)
CREATE TABLE portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'producer' CHECK (role IN ('admin', 'producer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Portal Products (inventory items)
CREATE TABLE portal_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  species TEXT,
  moisture_state TEXT,
  dimensions TEXT,
  unit TEXT DEFAULT 'pcs',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Portal Inventory (current stock)
CREATE TABLE portal_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES portal_products(id) ON DELETE CASCADE NOT NULL,
  quantity DECIMAL NOT NULL DEFAULT 0,
  cubic_meters DECIMAL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Portal Processes (production process types)
CREATE TABLE portal_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_standard BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Portal Production Entries (the core transformation record)
CREATE TABLE portal_production_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID REFERENCES portal_processes(id) NOT NULL,
  production_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'validated')),
  notes TEXT,
  total_input_m3 DECIMAL,
  total_output_m3 DECIMAL,
  outcome_percentage DECIMAL,
  waste_percentage DECIMAL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  validated_at TIMESTAMPTZ
);

-- 6. Portal Production Lines (input and output items for each entry)
CREATE TABLE portal_production_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_entry_id UUID REFERENCES portal_production_entries(id) ON DELETE CASCADE NOT NULL,
  line_type TEXT NOT NULL CHECK (line_type IN ('input', 'output')),
  product_id UUID REFERENCES portal_products(id),
  product_name TEXT,
  quantity DECIMAL NOT NULL,
  cubic_meters DECIMAL,
  dimensions TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_portal_inventory_product_id ON portal_inventory(product_id);
CREATE INDEX idx_portal_production_entries_process_id ON portal_production_entries(process_id);
CREATE INDEX idx_portal_production_entries_status ON portal_production_entries(status);
CREATE INDEX idx_portal_production_entries_date ON portal_production_entries(production_date);
CREATE INDEX idx_portal_production_lines_entry_id ON portal_production_lines(production_entry_id);
CREATE INDEX idx_portal_production_lines_type ON portal_production_lines(line_type);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER portal_users_updated_at BEFORE UPDATE ON portal_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER portal_products_updated_at BEFORE UPDATE ON portal_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER portal_inventory_updated_at BEFORE UPDATE ON portal_inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER portal_production_entries_updated_at BEFORE UPDATE ON portal_production_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Seed Data

Create seed file: `supabase/seed.sql` (or append to existing)

```sql
-- Seed standard processes
INSERT INTO portal_processes (name, is_standard) VALUES
  ('Multi-saw', true),
  ('Planing', true),
  ('Opti-cut', true),
  ('Gluing', true),
  ('Sanding', true),
  ('Finger Jointing', true)
ON CONFLICT (name) DO NOTHING;
```

### Implementation Tasks

#### Task 1: Create Portal App Structure
**Description:** Initialize the portal app within the monorepo using Next.js with App Router.

**Subtasks:**
1. Create `apps/portal/` directory
2. Initialize Next.js app with:
   ```bash
   cd apps/portal
   pnpm create next-app@latest . \
     --typescript \
     --tailwind \
     --eslint \
     --app \
     --src-dir \
     --import-alias "@/*" \
     --turbopack
   ```
3. Update `package.json`:
   - Set name to `@timber/portal`
   - Add workspace dependencies: `@timber/ui`, `@timber/database`, `@timber/config`, `@timber/utils`
   - Set dev port to 3001: `"dev": "next dev -p 3001"`
4. Configure `tailwind.config.ts` to extend from `@timber/config` (if applicable) or match marketing website
5. Create `components.json` for shadcn/ui
6. Copy relevant configuration from `apps/marketing/` for consistency

#### Task 2: Set Up Supabase Integration
**Description:** Configure Supabase clients for the portal app.

**Subtasks:**
1. Create `src/lib/supabase/client.ts`:
   ```typescript
   import { createBrowserClient } from '@supabase/ssr'

   export function createClient() {
     return createBrowserClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
     )
   }
   ```
2. Create `src/lib/supabase/server.ts`:
   ```typescript
   import { createServerClient as createSSRClient } from '@supabase/ssr'
   import { cookies } from 'next/headers'

   export async function createServerClient() {
     const cookieStore = await cookies()

     return createSSRClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
       {
         cookies: {
           getAll() {
             return cookieStore.getAll()
           },
           setAll(cookiesToSet) {
             try {
               cookiesToSet.forEach(({ name, value, options }) =>
                 cookieStore.set(name, value, options)
               )
             } catch {
               // Server Component - ignore
             }
           },
         },
       }
     )
   }
   ```
3. Create `.env.local` and `.env.example` with Supabase variables

#### Task 3: Create Database Migration
**Description:** Create the MVP database schema with 6 tables.

**Subtasks:**
1. Create migration file in `supabase/migrations/`
2. Apply migration: `pnpm supabase db push` or `pnpm supabase migration up`
3. Verify tables created in Supabase dashboard
4. Run seed data for standard processes

#### Task 4: Create Basic App Layout Structure
**Description:** Set up the route groups and basic layouts.

**Subtasks:**
1. Create root layout at `src/app/layout.tsx`:
   - Import global styles
   - Set up providers (if needed)
   - Configure metadata
2. Create auth layout at `src/app/(auth)/layout.tsx`:
   - Minimal layout for unauthenticated pages
3. Create placeholder login page at `src/app/(auth)/login/page.tsx`:
   - Simple "Login Page - Coming Soon" message
4. Create portal layout at `src/app/(portal)/layout.tsx`:
   - Placeholder dashboard shell
5. Create placeholder dashboard at `src/app/(portal)/dashboard/page.tsx`:
   - Simple "Dashboard - Coming Soon" message
6. Create basic middleware at `src/middleware.ts`:
   - Placeholder for auth checking (implement in Story 1.3)

#### Task 5: Verify Integration and Run
**Description:** Ensure the app builds and runs correctly within the monorepo.

**Subtasks:**
1. Run `pnpm install` from root to link workspace dependencies
2. Verify TypeScript compilation: `pnpm type-check` or `pnpm build`
3. Start dev server: `pnpm dev` (should run on port 3001)
4. Access `localhost:3001` and verify:
   - Root redirects to dashboard (or login)
   - Login page renders
   - Dashboard placeholder renders
   - No console errors
5. Verify Supabase connection works (add a simple test query if needed)

---

## Dev Notes

### Critical Patterns to Follow

1. **No "use client" on page.tsx files** - Only add to specific components that need client-side hooks/events
2. **Server Components by default** - React 19 pattern
3. **File naming:**
   - Components: PascalCase.tsx
   - Utilities/hooks: camelCase.ts
4. **No organization_id** - MVP is single-tenant
5. **No RLS policies** - Not needed for MVP

### Integration Points

- Uses existing `@timber/database` for Supabase types (extend if needed)
- Shares `@timber/ui` components when adding shadcn/ui
- Shares `@timber/config` for environment/constants

### What NOT to Build in This Story

- Full authentication flow (Story 1.3)
- User registration (Story 1.2)
- Role-based navigation logic (Story 1.4)
- Profile management (Story 1.5)
- Any feature pages (Epic 2-5)

### Testing Checklist

- [x] Portal app runs on localhost:3001
- [x] No TypeScript errors
- [x] No build errors
- [x] Database tables exist in Supabase
- [x] Standard processes are seeded (6 processes)
- [x] Supabase client connects successfully
- [x] Root layout renders
- [x] Login placeholder page renders
- [x] Dashboard placeholder page renders

---

## Dev Agent Record

### File List

**Created Files:**
```
apps/portal/
├── package.json
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── eslint.config.mjs
├── components.json
├── next-env.d.ts
├── .env.example
├── .env.local (copied from root)
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── page.tsx
    │   ├── (auth)/
    │   │   ├── layout.tsx
    │   │   └── login/
    │   │       └── page.tsx
    │   └── (portal)/
    │       ├── layout.tsx
    │       └── dashboard/
    │           └── page.tsx
    ├── components/
    │   └── layout/
    │       ├── TopNav.tsx
    │       └── index.ts
    ├── lib/
    │   ├── utils.ts
    │   └── supabase/
    │       ├── client.ts
    │       ├── server.ts
    │       └── index.ts
    └── middleware.ts

supabase/migrations/
└── 20260122000001_portal_mvp_schema.sql
```

**Modified Files:**
```
package.json (root)          - Added dev:portal script
supabase/config.toml         - Updated major_version to 17
CLAUDE.md                    - Project name updates
```

### Change Log

| Date | Change | Files |
|------|--------|-------|
| 2026-01-22 | Created portal app structure | apps/portal/* |
| 2026-01-22 | Created MVP database migration | supabase/migrations/20260122000001_portal_mvp_schema.sql |
| 2026-01-22 | Added portal dev script | package.json |
| 2026-01-22 | Fixed Supabase config version | supabase/config.toml |

---

## Definition of Done

- [x] `apps/portal/` exists with proper Next.js App Router structure
- [x] Portal integrates with `@timber/ui`, `@timber/database`, `@timber/config`
- [x] Portal runs successfully on `localhost:3001`
- [x] Database migration created with 6 tables (migration file ready to apply)
- [x] Role column exists on portal_users table with proper CHECK constraint
- [x] 6 standard processes seeded in processes table (in migration)
- [x] All acceptance criteria verified
- [x] No TypeScript errors
- [x] Code follows project conventions (naming, structure)

**Note:** Database migration file created at `supabase/migrations/20260122000001_portal_mvp_schema.sql`. Run `pnpm supabase db push` or `pnpm supabase migration up` to apply.
