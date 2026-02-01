# Story 7.3: User Credential Generation

Status: complete

## Story

As a Super Admin,
I want to generate login credentials for new users,
So that they can access the portal.

## Acceptance Criteria

### AC1: Auto-generate Temporary Password
**Given** I have created a new user
**When** the user is saved
**Then** a temporary password is auto-generated (12+ chars, mixed case, numbers)
**And** the user status is set to "Invited"

### AC2: Send Credentials Button
**Given** a user has status "Invited"
**When** I view their row in the Users table
**Then** I see a "Send Credentials" button

### AC3: Send Credentials Email
**Given** I click "Send Credentials"
**When** the action completes
**Then** an email is sent to the user with: login URL, email, temporary password
**And** I see a success toast "Credentials sent to {email}"
**And** `invited_at` timestamp is recorded

### AC4: First Login Status Change
**Given** the user logs in with the temporary password
**When** they successfully authenticate
**Then** their status changes from "Invited" to "Active"

## Tasks / Subtasks

- [x] Task 1: Create password generation utility (AC: 1)
  - [x] Create `generateTemporaryPassword()` function
  - [x] 12+ characters with mixed case and numbers
  - [x] Avoid ambiguous characters (0, O, l, 1, etc.)

- [x] Task 2: Create Supabase Auth user on credential send (AC: 1, 3)
  - [x] Use Supabase Admin API to create auth.users record
  - [x] Set email and temporary password
  - [x] Link auth_user_id in portal_users table

- [x] Task 3: Create sendUserCredentials action (AC: 2, 3)
  - [x] Accept userId parameter
  - [x] Generate temporary password
  - [x] Create auth.users record via Admin API
  - [x] Update portal_users with auth_user_id
  - [x] Send email with credentials
  - [x] Update invited_at, invited_by timestamps

- [x] Task 4: Set up email sending (AC: 3)
  - [x] Configure email provider (Resend, SendGrid, or Supabase built-in)
  - [x] Create email template for credentials
  - [x] Include: Login URL, Email, Temporary Password
  - [x] Style consistently with platform branding

- [x] Task 5: Add Send Credentials button to Users table (AC: 2)
  - [x] Show button only for status='invited' users
  - [x] Disable button while sending
  - [x] Show loading state during API call

- [x] Task 6: Update login flow for first login (AC: 4)
  - [x] After successful auth, check if status='invited'
  - [x] Update status to 'active' on first successful login
  - [x] Update last_login_at timestamp

- [x] Task 7: Verification (AC: all)
  - [x] Build passes: `npx turbo build --filter=@timber/portal`
  - [x] Send credentials button appears for invited users
  - [x] Email is sent successfully (console.log fallback when no RESEND_API_KEY)
  - [x] User can log in with temp password
  - [x] Status changes to Active after first login

## Dev Notes

### Password Generation

```typescript
function generateTemporaryPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  // Excludes: 0, O, l, 1, I to avoid ambiguity
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
```

### Supabase Admin API for User Creation

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Admin key
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data, error } = await supabaseAdmin.auth.admin.createUser({
  email: user.email,
  password: temporaryPassword,
  email_confirm: true, // Skip email confirmation
  user_metadata: { name: user.name, role: 'producer' }
});
```

### Email Template Structure

```
Subject: Your Timber World Portal Access

Hello {name},

Your account has been created for the Timber World Production Portal.

Login URL: https://portal.timber-world.com/login
Email: {email}
Temporary Password: {password}

Please log in and change your password after first access.

If you have questions, contact your administrator.

Best regards,
Timber World Team
```

### Environment Variables Needed

```env
# Supabase Admin (service role key)
SUPABASE_SERVICE_ROLE_KEY=

# Email provider (example: Resend)
RESEND_API_KEY=
EMAIL_FROM=noreply@timber-world.com
```

### Files to Create/Modify

**New Files:**
- `apps/portal/src/lib/utils/generatePassword.ts`
- `apps/portal/src/features/organisations/actions/sendUserCredentials.ts`
- `apps/portal/src/lib/email/sendCredentialsEmail.ts`
- `apps/portal/src/lib/supabase/admin.ts` (admin client)

**Modified Files:**
- `apps/portal/src/features/organisations/components/OrganisationUsersTable.tsx`
- `apps/portal/src/lib/auth/getSession.ts` (update status on login)
- `apps/portal/src/features/auth/actions/loginUser.ts` (update status)

### Security Considerations

- Service role key must never be exposed to client
- Temporary passwords should be reasonably secure
- Consider password expiry policy (future enhancement)
- Log credential send events for audit

### References

- [Source: epics.md#Story-7.3-User-Credential-Generation]
- [Story 7.2: User Management within Organization] (dependency)
- [Supabase Auth Admin API](https://supabase.com/docs/reference/javascript/auth-admin-createuser)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Password Generation**: Created `generateTemporaryPassword()` in `/apps/portal/src/lib/utils/generatePassword.ts`. Generates 12+ char passwords with mixed case and numbers, excluding ambiguous characters (0, O, l, 1, I). Includes validation to ensure at least one uppercase, lowercase, and number.

2. **Supabase Admin Client**: Created admin client wrapper in `/apps/portal/src/lib/supabase/admin.ts` that re-exports from `@timber/database`. The admin client was already implemented in the shared package.

3. **Send Credentials Action**: Created `/apps/portal/src/features/organisations/actions/sendUserCredentials.ts` that:
   - Validates Super Admin permissions
   - Generates temporary password
   - Creates auth.users record via Supabase Admin API
   - Links auth_user_id to portal_users
   - Sends credentials email
   - Updates invited_at timestamp

4. **Email Sending**: Created `/apps/portal/src/lib/email/sendCredentialsEmail.ts` with:
   - HTML and plain text email templates
   - Resend API integration when RESEND_API_KEY is configured
   - Console.log fallback for development (when no API key)
   - Timber World branded styling

5. **OrganisationUser Type Update**: Added `authUserId` field to OrganisationUser interface and updated all related actions (getOrganisationUsers, createOrganisationUser, updateOrganisationUser, toggleUserActive) to include auth_user_id in queries.

6. **Send Credentials Button**: Updated OrganisationUsersTable.tsx with:
   - Send icon button (mail/send icon from lucide-react)
   - Shows only for invited users without auth_user_id
   - Loading spinner during send operation
   - Success toast with email address

7. **First Login Status Change**: Updated login.ts to:
   - Check portal_users status after successful auth
   - Update status from 'invited' to 'active' on first login
   - Update last_login_at for all logins

### Change Log

- 2026-01-25: Story 7.3 created and ready for development
- 2026-01-25: Story 7.3 implementation complete

### File List

- apps/portal/src/lib/utils/generatePassword.ts (created)
- apps/portal/src/features/organisations/actions/sendUserCredentials.ts (created)
- apps/portal/src/lib/email/sendCredentialsEmail.ts (created)
- apps/portal/src/lib/supabase/admin.ts (created)
- apps/portal/src/lib/supabase/index.ts (modified - added admin export)
- apps/portal/src/features/organisations/types.ts (modified - added authUserId)
- apps/portal/src/features/organisations/actions/index.ts (modified - added sendUserCredentials export)
- apps/portal/src/features/organisations/actions/getOrganisationUsers.ts (modified - added auth_user_id)
- apps/portal/src/features/organisations/actions/createOrganisationUser.ts (modified - added auth_user_id)
- apps/portal/src/features/organisations/actions/updateOrganisationUser.ts (modified - added auth_user_id)
- apps/portal/src/features/organisations/actions/toggleUserActive.ts (modified - added auth_user_id)
- apps/portal/src/features/organisations/components/OrganisationUsersTable.tsx (modified - added Send Credentials button)
- apps/portal/src/features/auth/actions/login.ts (modified - first login status update)
