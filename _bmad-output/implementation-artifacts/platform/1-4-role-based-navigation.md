# Story 1.4: Role-Based Navigation

## Story Information

| Field | Value |
|-------|-------|
| **Story ID** | 1.4 |
| **Epic** | Epic 1: Portal Foundation & User Access |
| **Title** | Role-Based Navigation |
| **Status** | done |
| **Created** | 2026-01-22 |
| **Priority** | High |

## User Story

**As a** logged-in user,
**I want** to see navigation appropriate to my role,
**So that** I can access the features relevant to me.

## Acceptance Criteria

### AC1: Admin Navigation
**Given** I am logged in as Admin
**When** I view the dashboard
**Then** I see navigation links: Dashboard, Inventory (manage), Products (manage)
**And** the dashboard shows an "Admin Overview" header

### AC2: Producer Navigation
**Given** I am logged in as Producer
**When** I view the dashboard
**Then** I see navigation links: Dashboard, Inventory (view), Production
**And** the dashboard shows a "Production Dashboard" header

### AC3: Route Protection
**Given** I am a Producer
**When** I try to access an Admin-only route (e.g., /products)
**Then** I am redirected to my dashboard with an "Access denied" message

---

## Technical Implementation Guide

### Architecture Context

This story implements role-based navigation by reading the user's role from the session and conditionally rendering navigation items. Route protection is enforced via middleware for admin-only routes.

**Key Patterns (from project-context.md):**
- Server Components for role-aware layouts (no "use client" unless needed)
- Simple role check (not full RBAC for MVP)
- URL-based route protection in middleware
- Toast notifications for access denied messages (sonner)

### Technology Stack

| Technology | Usage |
|------------|-------|
| Supabase Auth | Session with user metadata |
| Next.js Middleware | Route protection |
| Server Components | Role-aware navigation rendering |
| sonner | Toast notifications for access denied |

### Implementation Tasks

#### Task 1: Create Role-Aware Navigation Component
**Description:** Update TopNav to show different links based on user role.

**Files to create/modify:**
- `apps/portal/src/components/layout/TopNav.tsx` - Modify to accept role and render conditionally
- `apps/portal/src/lib/auth/getSession.ts` - Helper to get current user session with role

**Subtasks:**
1. Create `getSession()` helper that returns user with role from Supabase session
2. Update TopNav to be a Server Component that fetches session
3. Define navigation items per role:
   - **Admin:** Dashboard, Inventory, Products
   - **Producer:** Dashboard, Inventory, Production
4. Conditionally render navigation items based on role
5. Add role-specific icons using lucide-react

**Navigation Configuration:**
```typescript
const ADMIN_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/products", label: "Products", icon: Boxes },
];

const PRODUCER_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/production", label: "Production", icon: Factory },
];
```

#### Task 2: Create Session Helper
**Description:** Create a reusable helper to get current user session with role.

**Files to create:**
- `apps/portal/src/lib/auth/getSession.ts`

**Helper Implementation:**
```typescript
import { createClient } from "@/lib/supabase/server";

export type UserRole = "admin" | "producer";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export async function getSession(): Promise<SessionUser | null> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Get role from user metadata (set during registration)
  const role = (user.user_metadata?.role as UserRole) || "producer";
  const name = user.user_metadata?.name || user.email || "User";

  return {
    id: user.id,
    email: user.email || "",
    name,
    role,
  };
}
```

#### Task 3: Create Role-Specific Dashboard Headers
**Description:** Update dashboard page to show role-specific header.

**Files to modify:**
- `apps/portal/src/app/(portal)/dashboard/page.tsx`

**Subtasks:**
1. Fetch user session in dashboard page (Server Component)
2. Display "Admin Overview" header for admin role
3. Display "Production Dashboard" header for producer role
4. Add placeholder content sections appropriate to each role

**Dashboard Page Structure:**
```tsx
import { getSession } from "@/lib/auth/getSession";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const isAdmin = session.role === "admin";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        {isAdmin ? "Admin Overview" : "Production Dashboard"}
      </h1>

      {isAdmin ? (
        <AdminDashboardContent />
      ) : (
        <ProducerDashboardContent />
      )}
    </div>
  );
}
```

#### Task 4: Implement Admin-Only Route Protection
**Description:** Update middleware to protect admin-only routes.

**Files to modify:**
- `apps/portal/src/middleware.ts`

**Admin-Only Routes:**
- `/products` - Product management (admin only)
- `/products/*` - Product detail/edit pages

**Middleware Logic:**
```typescript
// Add to existing middleware
const ADMIN_ONLY_ROUTES = ["/products"];

function isAdminOnlyRoute(pathname: string): boolean {
  return ADMIN_ONLY_ROUTES.some(
    route => pathname === route || pathname.startsWith(`${route}/`)
  );
}

// In middleware handler:
if (isAdminOnlyRoute(pathname)) {
  const role = user.user_metadata?.role;
  if (role !== "admin") {
    // Redirect to dashboard with access denied flag
    const redirectUrl = new URL("/dashboard", request.url);
    redirectUrl.searchParams.set("access_denied", "true");
    return NextResponse.redirect(redirectUrl);
  }
}
```

#### Task 5: Handle Access Denied Toast
**Description:** Show toast notification when user is redirected due to access denied.

**Files to create/modify:**
- `apps/portal/src/app/(portal)/dashboard/page.tsx` - Check for access_denied param
- `apps/portal/src/components/AccessDeniedHandler.tsx` - Client component for toast

**AccessDeniedHandler Component:**
```tsx
"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

export function AccessDeniedHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get("access_denied") === "true") {
      toast.error("Access denied. You don't have permission to view that page.");
      // Clean up URL
      router.replace("/dashboard");
    }
  }, [searchParams, router]);

  return null;
}
```

#### Task 6: Create Placeholder Route Pages
**Description:** Create stub pages for routes that don't exist yet.

**Files to create:**
- `apps/portal/src/app/(portal)/products/page.tsx` - Admin products page
- `apps/portal/src/app/(portal)/production/page.tsx` - Producer production page

**Subtasks:**
1. Create `/products` page with "Product Management" heading (admin only)
2. Create `/production` page with "Production Entry" heading (producer)
3. Each page should show placeholder "Coming in next story" message

---

## Dev Notes

### Critical Patterns to Follow

1. **Server Components First** - TopNav and Dashboard should be Server Components
   - Only add "use client" to small interactive pieces (like AccessDeniedHandler)

2. **Role from Session** - Get role from `user.user_metadata.role` (set during registration)

3. **Middleware Protection** - Admin routes checked in middleware, not just hidden in UI

4. **Clean URL After Redirect** - Remove `access_denied` param after showing toast

5. **Navigation Items as Config** - Define nav items as typed arrays for maintainability

### File Organization

```
apps/portal/src/
├── lib/
│   └── auth/
│       └── getSession.ts        # Session helper with role
├── components/
│   ├── layout/
│   │   └── TopNav.tsx           # Role-aware navigation
│   └── AccessDeniedHandler.tsx  # Toast handler
├── app/(portal)/
│   ├── dashboard/
│   │   └── page.tsx             # Role-specific dashboard
│   ├── products/
│   │   └── page.tsx             # Admin only
│   └── production/
│       └── page.tsx             # Producer only
└── middleware.ts                # Route protection
```

### Navigation Items Reference

| Role | Route | Label | Icon |
|------|-------|-------|------|
| Both | /dashboard | Dashboard | LayoutDashboard |
| Admin | /inventory | Inventory | Package |
| Admin | /products | Products | Boxes |
| Producer | /inventory | Inventory | Package |
| Producer | /production | Production | Factory |

### Route Protection Matrix

| Route | Admin | Producer |
|-------|-------|----------|
| /dashboard | Yes | Yes |
| /inventory | Yes | Yes |
| /products | Yes | Redirect to dashboard |
| /products/* | Yes | Redirect to dashboard |
| /production | Yes* | Yes |
| /history | Yes* | Yes |

*Admin can technically access producer routes (no restriction for MVP)

### What NOT to Build in This Story

- Full RBAC permission system (deferred to Phase 2)
- User-level function overrides
- Dynamic permission checking in Server Actions
- Role management UI
- Multiple organizations

### Testing Checklist

- [x] Admin sees correct navigation items (Dashboard, Inventory, Products)
- [x] Producer sees correct navigation items (Dashboard, Inventory, Production)
- [x] Admin dashboard shows "Admin Overview" header
- [x] Producer dashboard shows "Production Dashboard" header
- [x] Producer cannot access /products route
- [x] Producer accessing /products is redirected to dashboard
- [x] Access denied toast appears when redirected
- [x] URL is cleaned after access denied toast
- [x] All placeholder pages render correctly
- [x] TopNav highlights current active route
- [x] No TypeScript errors
- [x] Code follows project conventions

---

## Definition of Done

- [x] TopNav shows role-appropriate navigation items
- [x] Dashboard shows role-specific header text
- [x] Middleware protects admin-only routes (/products)
- [x] Non-admin users redirected with access denied message
- [x] Access denied toast notification works
- [x] Placeholder pages exist for all nav routes
- [x] getSession helper created and working
- [x] No TypeScript errors
- [x] Code follows project conventions

---

## File List

| File | Action | Description |
|------|--------|-------------|
| `apps/portal/src/lib/auth/getSession.ts` | Create | Session helper with role |
| `apps/portal/src/lib/auth/index.ts` | Create | Barrel export |
| `apps/portal/src/components/layout/TopNav.tsx` | Modify | Role-aware navigation |
| `apps/portal/src/components/layout/NavLink.tsx` | Create | Active route highlighting component |
| `apps/portal/src/components/AccessDeniedHandler.tsx` | Create | Toast handler for access denied |
| `apps/portal/src/app/(portal)/dashboard/page.tsx` | Modify | Role-specific dashboard |
| `apps/portal/src/app/(portal)/products/page.tsx` | Create | Admin products page |
| `apps/portal/src/app/(portal)/production/page.tsx` | Create | Producer production page |
| `apps/portal/src/app/(portal)/history/page.tsx` | Create | Producer history page |
| `apps/portal/src/middleware.ts` | Modify | Add admin route protection |
| `apps/portal/src/app/(portal)/inventory/page.tsx` | Create | Inventory page (both roles) |
| `apps/portal/src/app/(portal)/profile/page.tsx` | Create | Profile page (both roles) |

---

## Dev Agent Record

### Implementation Summary
Completed 2026-01-22. All acceptance criteria met.

### Files Created/Modified
| File | Action | Description |
|------|--------|-------------|
| `apps/portal/src/lib/auth/getSession.ts` | Created | Session helper with role, isAdmin, isProducer functions |
| `apps/portal/src/lib/auth/index.ts` | Created | Barrel export for auth lib |
| `apps/portal/src/components/layout/TopNav.tsx` | Modified | Role-aware navigation with ADMIN_NAV_ITEMS and PRODUCER_NAV_ITEMS |
| `apps/portal/src/components/layout/NavLink.tsx` | Created | Client component for active route highlighting with aria-labels |
| `apps/portal/src/components/AccessDeniedHandler.tsx` | Created | Client component for access denied toast |
| `apps/portal/src/app/(portal)/dashboard/page.tsx` | Modified | Role-specific headers and content (AdminDashboardContent, ProducerDashboardContent) |
| `apps/portal/src/app/(portal)/products/page.tsx` | Created | Admin-only products page |
| `apps/portal/src/app/(portal)/production/page.tsx` | Created | Production page placeholder |
| `apps/portal/src/app/(portal)/inventory/page.tsx` | Created | Inventory page with role-aware content |
| `apps/portal/src/app/(portal)/profile/page.tsx` | Created | Profile page showing session info |
| `apps/portal/src/middleware.ts` | Modified | Added ADMIN_ONLY_ROUTES and role-based route protection |

### Notes
- TopNav is now a Server Component that fetches session to determine role
- AccessDeniedHandler wrapped in Suspense for Next.js useSearchParams compatibility
- Middleware protects /products route; non-admins redirected with access_denied=true
- Profile page shows current user session info (name, email, role)
- All placeholder pages include context about which Epic/Story will implement them
- Hardcoded strings used instead of i18n (tech debt - TODO comments added)

### Code Review Fixes (2026-01-22)
| Issue | Severity | Fix Applied |
|-------|----------|-------------|
| H1: Testing Checklist not marked done | HIGH | Updated all checklist items to [x] |
| M1: No active route highlighting | MEDIUM | Created NavLink client component with usePathname() |
| M3: Missing aria-labels | MEDIUM | Added aria-labels to all nav links and nav element |
| M4: Unclear redundant check comment | MEDIUM | Improved comment to explain defense-in-depth pattern |
