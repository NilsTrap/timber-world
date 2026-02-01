# Story 1.3: User Login & Session

## Story Information

| Field | Value |
|-------|-------|
| **Story ID** | 1.3 |
| **Epic** | Epic 1: Portal Foundation & User Access |
| **Title** | User Login & Session |
| **Status** | done |
| **Created** | 2026-01-22 |
| **Priority** | High |

## User Story

**As a** registered user,
**I want** to log in to the portal,
**So that** I can access my role-specific features.

## Acceptance Criteria

### AC1: Successful Login with Role-Based Redirect
**Given** I am on the login page
**When** I enter valid email and password
**Then** I am authenticated via Supabase Auth
**And** I am redirected to my role-appropriate dashboard:
  - Admin role → `/dashboard` (Admin Overview)
  - Producer role → `/dashboard` (Production Dashboard)
**And** my session persists across page refreshes

### AC2: Invalid Credentials Handling
**Given** I enter incorrect credentials
**When** I submit the login form
**Then** I see an error message "Invalid email or password"
**And** I remain on the login page
**And** the password field is cleared

### AC3: Logout Functionality
**Given** I am logged in
**When** I click "Logout"
**Then** my session is terminated
**And** I am redirected to the login page
**And** I cannot access protected routes without logging in again

### AC4: Protected Route Enforcement
**Given** I try to access a protected route without being logged in
**When** the page loads
**Then** I am redirected to the login page
**And** after login I am redirected to my original destination (optional: redirect to dashboard)

---

## Technical Implementation Guide

### Architecture Context

This story implements authentication using Supabase Auth with cookie-based sessions. The MVP uses simple auth (no full RBAC) with two roles: `admin` and `producer`. Role-based redirect happens after successful login.

**Key Patterns (from project-context.md):**
- Server Actions with `ActionResult<T>` return type
- Zod validation on all form inputs
- React Hook Form for form management
- Toast notifications for feedback (sonner)
- No "use client" on page.tsx files
- Middleware for auth route protection

**MVP Simplification (from Architecture Addendum):**
- Simple auth check only (no complex RBAC)
- Single permission level per role
- No `hasFunction()` checks needed for MVP

### Technology Stack

| Technology | Usage |
|------------|-------|
| Supabase Auth | Email/password authentication |
| React Hook Form | Form state management |
| Zod | Runtime validation |
| Server Actions | Form submission handling |
| sonner | Toast notifications |
| Next.js Middleware | Route protection |

### Implementation Tasks

#### Task 1: Create Login Zod Schema
**Description:** Define validation rules for login form.

**Files to create:**
- `apps/portal/src/features/auth/schemas/login.ts`

**Schema:**
```typescript
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
```

**Subtasks:**
1. Create login schema file
2. Export from `schemas/index.ts`

---

#### Task 2: Create Login Server Action
**Description:** Implement the server-side login logic.

**Files to create:**
- `apps/portal/src/features/auth/actions/login.ts`

**Server Action Logic:**
```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { loginSchema, type LoginInput } from "../schemas/login";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/**
 * Log in a user with email and password.
 *
 * NOTE: This is a PUBLIC endpoint - no authentication required.
 * After successful login, redirects to dashboard (role handled client-side or middleware).
 */
export async function loginUser(
  input: LoginInput
): Promise<ActionResult<{ redirectTo: string }>> {
  // 1. Validate input with Zod
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { email, password } = parsed.data;
  const supabase = await createClient();

  // 2. Authenticate with Supabase
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Generic error for security (don't reveal if email exists)
    return { success: false, error: "Invalid email or password", code: "INVALID_CREDENTIALS" };
  }

  if (!data.user) {
    return { success: false, error: "Login failed", code: "LOGIN_FAILED" };
  }

  // 3. Determine redirect based on role
  // Role is stored in user metadata from registration
  const role = data.user.user_metadata?.role as string | undefined;
  const redirectTo = "/dashboard"; // Both roles go to same dashboard, UI differs

  return {
    success: true,
    data: { redirectTo },
  };
}
```

**Subtasks:**
1. Create login action file
2. Export from `actions/index.ts`
3. Handle error cases consistently

---

#### Task 3: Create Logout Server Action
**Description:** Implement the server-side logout logic.

**Files to create:**
- `apps/portal/src/features/auth/actions/logout.ts`

**Server Action Logic:**
```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Log out the current user.
 * Terminates session and redirects to login.
 */
export async function logoutUser(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

**Subtasks:**
1. Create logout action file
2. Export from `actions/index.ts`

---

#### Task 4: Create LoginForm Client Component
**Description:** Create the login form with React Hook Form and Zod validation.

**Files to create:**
- `apps/portal/src/features/auth/components/LoginForm.tsx`

**Component Structure:**
```typescript
"use client";

/**
 * Login Form Component
 *
 * TODO [i18n]: Replace all hardcoded strings with useTranslations() from next-intl
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Input, Label } from "@timber/ui";
import { loginSchema, type LoginInput } from "../schemas/login";
import { loginUser } from "../actions/login";

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    resetField,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);

    try {
      const result = await loginUser(data);

      if (result.success) {
        toast.success("Welcome back!");
        router.push(result.data.redirectTo);
        router.refresh(); // Refresh to update session state
      } else {
        toast.error(result.error);
        resetField("password"); // Clear password on error (AC2)
      }
    } catch (error) {
      toast.error("An unexpected error occurred. Please try again.");
      console.error("Login error:", error);
      resetField("password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter your email"
          {...register("email")}
          aria-invalid={errors.email ? "true" : "false"}
          disabled={isLoading}
          autoComplete="email"
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Enter your password"
          {...register("password")}
          aria-invalid={errors.password ? "true" : "false"}
          disabled={isLoading}
          autoComplete="current-password"
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  );
}
```

**Subtasks:**
1. Create LoginForm component
2. Add `autoComplete` attributes for password managers
3. Clear password field on failed login (AC2)
4. Export from `components/index.ts`

---

#### Task 5: Update Login Page
**Description:** Update the login page to use the LoginForm component.

**Files to modify:**
- `apps/portal/src/app/(auth)/login/page.tsx`

**Page Structure:**
```typescript
import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/features/auth/components";

export const metadata: Metadata = {
  title: "Login",
};

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Timber World Portal
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in to access the production management portal
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <LoginForm />
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-primary hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}
```

---

#### Task 6: Create/Update Auth Middleware
**Description:** Implement middleware for route protection.

**Files to create/modify:**
- `apps/portal/src/middleware.ts`

**Middleware Logic:**
```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Protected routes require authentication
  const isProtectedRoute = request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/inventory") ||
    request.nextUrl.pathname.startsWith("/production") ||
    request.nextUrl.pathname.startsWith("/history") ||
    request.nextUrl.pathname.startsWith("/settings");

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/register");

  if (isProtectedRoute && !user) {
    // Redirect to login if not authenticated
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthRoute && user) {
    // Redirect to dashboard if already authenticated
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Subtasks:**
1. Create or update middleware.ts
2. Define protected routes
3. Redirect unauthenticated users to login (AC4)
4. Redirect authenticated users away from auth pages

---

#### Task 7: Add Logout Button to Dashboard
**Description:** Add logout functionality to the portal layout.

**Files to modify:**
- `apps/portal/src/app/(portal)/layout.tsx` or header component

**Logout Button:**
```typescript
"use client";

import { Button } from "@timber/ui";
import { logoutUser } from "@/features/auth/actions";

export function LogoutButton() {
  return (
    <form action={logoutUser}>
      <Button type="submit" variant="ghost">
        Logout
      </Button>
    </form>
  );
}
```

**Subtasks:**
1. Create LogoutButton component
2. Add to portal layout header
3. Test logout flow (AC3)

---

#### Task 8: Update Feature Barrel Exports
**Description:** Update all index.ts files to export new components and actions.

**Files to modify:**
- `apps/portal/src/features/auth/schemas/index.ts`
- `apps/portal/src/features/auth/actions/index.ts`
- `apps/portal/src/features/auth/components/index.ts`
- `apps/portal/src/features/auth/index.ts`

---

## Dev Notes

### Critical Patterns to Follow

1. **Server Action Return Type** - Always use `ActionResult<T>`:
   ```typescript
   type ActionResult<T> =
     | { success: true; data: T }
     | { success: false; error: string; code?: string };
   ```

2. **Security** - Don't reveal if email exists (use generic "Invalid email or password")

3. **Form Component** - Use "use client" only on the form component, not the page

4. **Password Managers** - Add `autoComplete` attributes to input fields

5. **Session Refresh** - Call `router.refresh()` after login to update server components

### Previous Story (1.2) Learnings

| Learning | Application |
|----------|-------------|
| Type assertions needed for portal tables | Same pattern if querying portal_users |
| Hardcoded strings (i18n deferred) | Add TODO comment, use constants |
| Feature module structure works well | Follow same patterns |
| Toast notifications via sonner | Use for success/error feedback |
| Zod validation both client and server | Implement consistently |

### Files Created in Story 1.2 (Reference)

```
apps/portal/src/features/auth/
├── actions/
│   ├── index.ts
│   └── register.ts
├── components/
│   ├── index.ts
│   └── RegisterForm.tsx
├── schemas/
│   ├── index.ts
│   └── register.ts
└── index.ts
```

### Integration Points

- Uses `@timber/database` via `createClient()` from `@/lib/supabase/server`
- Uses shadcn/ui components: Button, Input, Label from `@timber/ui`
- Uses sonner for toast notifications
- Middleware uses `@supabase/ssr` for cookie handling

### What NOT to Build in This Story

- Password reset flow (Story 1.5 or separate story)
- Remember me checkbox (nice-to-have)
- OAuth/social login (not in MVP scope)
- Full RBAC permission checks (MVP uses simple auth)
- Session timeout warnings (future enhancement)

### Testing Checklist

- [x] Login page renders at `/login` with form
- [x] Valid credentials redirect to `/dashboard`
- [x] Invalid credentials show error toast
- [x] Password field clears on failed login
- [x] Session persists across page refresh
- [x] Logout terminates session
- [x] Logout redirects to login page
- [x] Protected routes redirect to login when not authenticated
- [x] Auth pages redirect to dashboard when already logged in
- [x] Loading state shown during login
- [x] Link to register page works

---

## Definition of Done

- [x] Login page has working email/password form
- [x] Login validates credentials via Supabase Auth
- [x] Invalid credentials show "Invalid email or password" error
- [x] Successful login redirects to `/dashboard`
- [x] Session persists across page refresh
- [x] Logout action terminates session
- [x] Logout redirects to login page
- [x] Middleware protects routes from unauthenticated access
- [x] Authenticated users redirected away from auth pages
- [x] No TypeScript errors
- [x] Code follows project conventions

---

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Implementation Summary
Completed 2026-01-22. All acceptance criteria met. Login, logout, and route protection implemented.

### Completion Notes List
- Used `@supabase/ssr` directly in middleware (hoisted from @timber/database dependency)
- Both roles redirect to `/dashboard` - role-specific UI will be in Story 1.4
- LogoutButton uses form action pattern for Server Action
- Middleware handles root path redirect to login/dashboard
- Added TODO comments for i18n on hardcoded strings

### File List

| File | Action | Description |
|------|--------|-------------|
| `apps/portal/src/features/auth/schemas/login.ts` | Created | Zod validation schema for login |
| `apps/portal/src/features/auth/schemas/index.ts` | Modified | Added login schema export |
| `apps/portal/src/features/auth/actions/login.ts` | Created | Server Action for login |
| `apps/portal/src/features/auth/actions/logout.ts` | Created | Server Action for logout |
| `apps/portal/src/features/auth/actions/index.ts` | Modified | Added login/logout exports |
| `apps/portal/src/features/auth/components/LoginForm.tsx` | Created | Login form component |
| `apps/portal/src/features/auth/components/LogoutButton.tsx` | Created | Logout button component |
| `apps/portal/src/features/auth/components/index.ts` | Modified | Added component exports |
| `apps/portal/src/app/(auth)/login/page.tsx` | Modified | Replaced placeholder with LoginForm |
| `apps/portal/src/middleware.ts` | Modified | Full auth route protection |
| `apps/portal/src/components/layout/TopNav.tsx` | Modified | Added LogoutButton to header |

### Code Review Fixes (2026-01-22)

| Issue | Severity | Fix Applied |
|-------|----------|-------------|
| C1: LogoutButton not in UI | CRITICAL | Added LogoutButton import and render in TopNav.tsx |
| H1: Return to original destination | HIGH | Documented as optional in AC4 - deferred |
| M1: Hardcoded text | MEDIUM | Already has TODO comments - known tech debt |
| M2: Unused role variable | MEDIUM | Removed dead code, updated comment |
| M3: Missing aria-labels | MEDIUM | Added aria-label to email, password inputs and logout button |
| L1: TopNav not in File List | LOW | Added TopNav.tsx to File List |
