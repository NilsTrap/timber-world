# Story 1.5: User Profile Management

## Story Information

| Field | Value |
|-------|-------|
| **Story ID** | 1.5 |
| **Epic** | Epic 1: Portal Foundation & User Access |
| **Title** | User Profile Management |
| **Status** | done |
| **Created** | 2026-01-22 |
| **Priority** | High |

## User Story

**As a** logged-in user,
**I want** to view and update my profile,
**So that** my information stays current.

## Acceptance Criteria

### AC1: View Profile Information
**Given** I am logged in
**When** I navigate to my profile page
**Then** I see my current name, email, and role displayed
**And** my role is displayed but not editable

### AC2: Update Name
**Given** I am on my profile page
**When** I update my name and click Save
**Then** my name is updated in the database
**And** I see a success toast "Profile updated"

### AC3: Validation
**Given** I am on my profile page
**When** I try to save with an empty name field
**Then** I see a validation error "Name is required"
**And** the form is not submitted

---

## Technical Implementation Guide

### Architecture Context

This story enhances the existing profile page placeholder (created in Story 1.4) to allow users to edit their profile information. The profile data is stored in Supabase Auth `user_metadata` and optionally synced to `portal_users` table.

**Key Patterns (from project-context.md):**
- Server Actions with `ActionResult<T>` return type
- Zod validation on all form inputs
- React Hook Form for form management
- Toast notifications for feedback (sonner)
- No "use client" on page.tsx files - only on form components

### Technology Stack

| Technology | Usage |
|------------|-------|
| Supabase Auth | User metadata storage via `auth.updateUser()` |
| React Hook Form | Form state management |
| Zod | Runtime validation |
| Server Actions | Profile update handling |
| sonner | Toast notifications |

### Implementation Tasks

#### Task 1: Create Profile Update Schema
**Description:** Define Zod validation schema for profile form.

**Files to create:**
- `apps/portal/src/features/profile/schemas/profile.ts`

**Schema:**
```typescript
import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
});

export type ProfileInput = z.infer<typeof profileSchema>;
```

#### Task 2: Create Profile Update Server Action
**Description:** Implement the server-side profile update logic.

**Files to create:**
- `apps/portal/src/features/profile/actions/updateProfile.ts`

**Server Action Logic:**
```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { profileSchema, type ProfileInput } from "../schemas/profile";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export async function updateProfile(
  input: ProfileInput
): Promise<ActionResult<{ message: string }>> {
  // 1. Validate input
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { name } = parsed.data;
  const supabase = await createClient();

  // 2. Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  // 3. Update user metadata in Supabase Auth
  const { error: updateError } = await supabase.auth.updateUser({
    data: { name },
  });

  if (updateError) {
    return { success: false, error: "Failed to update profile" };
  }

  // 4. Also update portal_users table (keep in sync)
  const { error: dbError } = await supabase
    .from("portal_users")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("auth_user_id", user.id);

  if (dbError) {
    console.error("Failed to sync portal_users:", dbError);
    // Don't fail - auth metadata is primary source
  }

  return {
    success: true,
    data: { message: "Profile updated successfully" },
  };
}
```

#### Task 3: Create Profile Form Component
**Description:** Create the editable profile form.

**Files to create:**
- `apps/portal/src/features/profile/components/ProfileForm.tsx`

**Component Structure:**
```typescript
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Input, Label } from "@timber/ui";
import { profileSchema, type ProfileInput } from "../schemas/profile";
import { updateProfile } from "../actions/updateProfile";

interface ProfileFormProps {
  initialName: string;
}

export function ProfileForm({ initialName }: ProfileFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: initialName },
  });

  const onSubmit = async (data: ProfileInput) => {
    setIsLoading(true);
    try {
      const result = await updateProfile(data);
      if (result.success) {
        toast.success("Profile updated");
        router.refresh(); // Refresh to update session data
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Form fields */}
    </form>
  );
}
```

#### Task 4: Update Profile Page
**Description:** Replace placeholder profile page with working form.

**Files to modify:**
- `apps/portal/src/app/(portal)/profile/page.tsx`

**Subtasks:**
1. Keep Server Component that fetches session
2. Import and render ProfileForm with initial data
3. Display email and role as read-only fields
4. Show last updated timestamp if available

#### Task 5: Create Feature Barrel Exports
**Description:** Set up proper module organization for profile feature.

**Files to create:**
- `apps/portal/src/features/profile/schemas/index.ts`
- `apps/portal/src/features/profile/actions/index.ts`
- `apps/portal/src/features/profile/components/index.ts`
- `apps/portal/src/features/profile/index.ts`

---

## Dev Notes

### Critical Patterns to Follow

1. **Server Action Return Type** - Always use `ActionResult<T>`:
   ```typescript
   type ActionResult<T> =
     | { success: true; data: T }
     | { success: false; error: string; code?: string };
   ```

2. **Zod Validation** - Validate on both client (UX) and server (security)

3. **Form Component** - Use "use client" only on the form component, not the page

4. **Profile Data Source** - Primary source is `user.user_metadata`, synced to `portal_users`

5. **No Role Editing** - Role is displayed but not editable by users

### File Organization

```
apps/portal/src/features/profile/
├── actions/
│   ├── updateProfile.ts    # Server Action
│   └── index.ts            # Barrel export
├── components/
│   ├── ProfileForm.tsx     # Client Component
│   └── index.ts            # Barrel export
├── schemas/
│   ├── profile.ts          # Zod schema
│   └── index.ts            # Barrel export
└── index.ts                # Feature barrel export
```

### Previous Story Intelligence (from Story 1.4)

**Patterns established:**
- `getSession()` helper exists at `@/lib/auth` - reuse for fetching current user
- Profile page placeholder exists at `apps/portal/src/app/(portal)/profile/page.tsx`
- Session returns `{ id, email, name, role }` structure
- Toast notifications via sonner are working

**Code review learnings:**
- Always add aria-labels for accessibility
- Mark Testing Checklist items as [x] when complete
- Use defense-in-depth pattern for security checks

### Integration Points

- Uses `@/lib/auth/getSession` for session data (created in Story 1.4)
- Uses `@timber/ui` components: Button, Input, Label
- Uses sonner for toast notifications
- Updates both `auth.user_metadata` AND `portal_users` table

### What NOT to Build in This Story

- Email change (requires verification flow)
- Password change (separate security-focused story)
- Avatar/profile picture upload
- Role editing (admin-only in future story)
- Account deletion

### Data Flow

1. User navigates to `/profile`
2. Server Component calls `getSession()` to get current data
3. ProfileForm receives `initialName` as prop
4. User edits name, submits form
5. Server Action validates with Zod
6. Updates `auth.user_metadata.name` via `supabase.auth.updateUser()`
7. Syncs to `portal_users.name` for consistency
8. Shows success toast, refreshes page to show updated data

### Testing Checklist

- [x] Profile page displays current name, email, role
- [x] Role is visible but not editable
- [x] Name field is editable
- [x] Empty name shows validation error
- [x] Successful update shows success toast
- [x] Page refreshes to show updated name
- [x] Name updates in auth.user_metadata
- [x] Name syncs to portal_users table
- [x] Loading state shown during save
- [x] Cancel/reset works if user changes mind
- [x] No TypeScript errors
- [x] Code follows project conventions

---

## Definition of Done

- [x] Profile page shows current name, email, role
- [x] Name can be edited and saved
- [x] Validation prevents empty name
- [x] Success toast shown on save
- [x] Name updates in Supabase Auth metadata
- [x] Name syncs to portal_users table
- [x] Role displayed but not editable
- [x] No TypeScript errors
- [x] Code follows project conventions

---

## File List

| File | Action | Description |
|------|--------|-------------|
| `apps/portal/src/features/profile/schemas/profile.ts` | Create | Zod validation schema |
| `apps/portal/src/features/profile/schemas/index.ts` | Create | Schema barrel export |
| `apps/portal/src/features/profile/actions/updateProfile.ts` | Create | Profile update Server Action |
| `apps/portal/src/features/profile/actions/index.ts` | Create | Actions barrel export |
| `apps/portal/src/features/profile/components/ProfileForm.tsx` | Create | Editable profile form |
| `apps/portal/src/features/profile/components/index.ts` | Create | Components barrel export |
| `apps/portal/src/features/profile/index.ts` | Create | Feature barrel export |
| `apps/portal/src/app/(portal)/profile/page.tsx` | Modify | Use ProfileForm component |

---

## Dev Agent Record

### Implementation Summary
Completed 2026-01-22. All acceptance criteria met.

### Files Created/Modified
| File | Action | Description |
|------|--------|-------------|
| `apps/portal/src/features/profile/schemas/profile.ts` | Created | Zod validation schema with name field |
| `apps/portal/src/features/profile/schemas/index.ts` | Created | Schema barrel export |
| `apps/portal/src/features/profile/actions/updateProfile.ts` | Created | Server Action for profile updates |
| `apps/portal/src/features/profile/actions/index.ts` | Created | Actions barrel export |
| `apps/portal/src/features/profile/components/ProfileForm.tsx` | Created | Client form component with validation |
| `apps/portal/src/features/profile/components/index.ts` | Created | Components barrel export |
| `apps/portal/src/features/profile/index.ts` | Created | Feature barrel export |
| `apps/portal/src/app/(portal)/profile/page.tsx` | Modified | Integrated ProfileForm, added read-only sections |

### Notes
- Used `ActionResult<T>` pattern for Server Action returns
- Zod validation on both client (UX) and server (security)
- ProfileForm uses React Hook Form with zodResolver
- Profile page is Server Component, only form is "use client"
- Updates both auth.user_metadata AND portal_users table
- Used type assertion for portal_users update due to TypeScript inference issue with generated types
- Cancel button only appears when form is dirty (isDirty)
- Loading state disables form during save
- TODO [i18n] comments added for future internationalization

---

## Code Review Record

### Review Summary
- **Reviewed:** 2026-01-22
- **Issues Found:** 6 (2 MEDIUM, 4 LOW)
- **Issues Fixed:** 2

### Issues Found & Resolution

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| 1 | MEDIUM | Missing `updated_at` in portal_users sync | Fixed - added updated_at field |
| 2 | LOW | Overly broad type assertion | Added TODO comment for future fix |
| 3 | LOW | Console.error in production | Accepted - minor risk |
| 4 | LOW | Form reset timing | Accepted - standard behavior |
| 5 | MEDIUM | Missing aria-describedby for accessibility | Fixed - added proper ARIA association |
| 6 | LOW | Duplicate user info display | Accepted - intentional design |

### Files Modified During Review
| File | Change |
|------|--------|
| `apps/portal/src/features/profile/actions/updateProfile.ts` | Added `updated_at` field, added TODO comment |
| `apps/portal/src/features/profile/components/ProfileForm.tsx` | Added `aria-describedby` and `role="alert"` to error message |

### Verification
- Portal app build passes successfully
