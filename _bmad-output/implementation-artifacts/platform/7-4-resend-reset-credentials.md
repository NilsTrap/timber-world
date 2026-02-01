# Story 7.4: Resend and Reset Credentials

Status: complete

## Story

As a Super Admin,
I want to resend or reset user credentials,
So that I can help users who lost access.

## Acceptance Criteria

### AC1: Resend for Invited Users
**Given** a user has status "Invited" (never logged in)
**When** I click "Resend Credentials"
**Then** a new temporary password is generated
**And** the email is sent again with new credentials

### AC2: Reset for Active Users
**Given** a user has status "Active" (has logged in before)
**When** I click "Reset Password"
**Then** a new temporary password is generated
**And** the user receives an email with reset instructions
**And** their next login requires the new password

### AC3: Credential History
**Given** I want to view credential send history
**When** I view a user's details
**Then** I see when credentials were last sent (`invited_at`)
**And** I see who sent them (`invited_by`)

## Tasks / Subtasks

- [x] Task 1: Create resendUserCredentials action (AC: 1)
  - [x] Accept userId parameter
  - [x] Verify user status is 'invited'
  - [x] Generate new temporary password
  - [x] Update auth.users password via Admin API
  - [x] Send email with new credentials
  - [x] Update invited_at timestamp

- [x] Task 2: Create resetUserPassword action (AC: 2)
  - [x] Accept userId parameter
  - [x] Works for any user status
  - [x] Generate new temporary password
  - [x] Update auth.users password via Admin API
  - [x] Send password reset email
  - [x] Status stays as 'active' (password reset doesn't change status)

- [x] Task 3: Update Users table actions column (AC: 1, 2)
  - [x] For 'invited' users without auth_user_id: show "Send Credentials" button (existing)
  - [x] For 'invited' users with auth_user_id: show "Resend Credentials" button (RefreshCw icon)
  - [x] For 'active' users: show "Reset Password" button (KeyRound icon)
  - [x] Handle loading and success/error states

- [x] Task 4: Add credential history to user details (AC: 3)
  - [x] Show invited_at timestamp (formatted as "25 Jan 2026, 14:30")
  - [x] Show invited_by user name (via joined query)
  - [x] Display in EditUserDialog with status, last login info

- [x] Task 5: Create password reset email template (AC: 2)
  - [x] Different from initial credentials email (warning styling, different message)
  - [x] Include: Login URL, Email, New Password
  - [x] Note that this is a password reset by administrator

- [x] Task 6: Verification (AC: all)
  - [x] Build passes: `pnpm turbo build --filter=@timber/portal`
  - [x] Resend works for invited users
  - [x] Reset works for active users
  - [x] Credential history displays correctly

## Dev Notes

### Button Logic by Status

| User Status | is_active | Button(s) Shown |
|-------------|-----------|-----------------|
| invited     | true      | Resend Credentials |
| active      | true      | Reset Password |
| invited     | false     | Activate, Resend Credentials |
| active      | false     | Activate, Reset Password |

### Resend vs Reset

**Resend Credentials** (invited users):
- User never logged in
- Same flow as initial send
- Updates invited_at

**Reset Password** (active users):
- User has logged in before
- Generates new password
- User must use new password on next login
- Consider: should status change to 'invited' or stay 'active'?

### Email Templates

**Resend Credentials Email:**
```
Subject: Your Timber World Portal Access (Resent)

Hello {name},

Your login credentials have been resent.

Login URL: https://portal.timber-world.com/login
Email: {email}
Temporary Password: {password}

Please log in and change your password after first access.
```

**Password Reset Email:**
```
Subject: Timber World Portal - Password Reset

Hello {name},

Your password has been reset by an administrator.

Login URL: https://portal.timber-world.com/login
Email: {email}
New Password: {password}

Please log in with this new password.
```

### Files to Create/Modify

**New Files:**
- `apps/portal/src/features/organisations/actions/resendUserCredentials.ts`
- `apps/portal/src/features/organisations/actions/resetUserPassword.ts`
- `apps/portal/src/lib/email/sendPasswordResetEmail.ts`

**Modified Files:**
- `apps/portal/src/features/organisations/components/OrganisationUsersTable.tsx`
- `apps/portal/src/features/organisations/components/EditUserDialog.tsx` (add history)

### Audit Trail Consideration

For compliance/security, consider logging:
- Who reset/resent credentials
- When it was done
- To which user

This could be a separate `credential_events` table or stored in portal_users.

### References

- [Source: epics.md#Story-7.4-Resend-and-Reset-Credentials]
- [Story 7.3: User Credential Generation] (dependency)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

1. **Resend Credentials Action**: Created action that verifies user is in 'invited' status with existing auth_user_id, generates new password using `supabaseAdmin.auth.admin.updateUserById()`, updates invited_at timestamp, and sends the existing credentials email template.

2. **Reset Password Action**: Created action for active users that generates new password, updates auth via Admin API, and sends a dedicated password reset email (different template from credentials email).

3. **Password Reset Email Template**: Created new email utility `sendPasswordResetEmail.ts` with distinct styling (amber warning banner) and messaging indicating "reset by administrator". Includes console fallback for development without RESEND_API_KEY.

4. **Users Table Buttons**: Updated OrganisationUsersTable with three distinct credential actions:
   - Send Credentials (Send icon) - invited users without auth_user_id
   - Resend Credentials (RefreshCw icon) - invited users with auth_user_id
   - Reset Password (KeyRound icon) - active users with auth_user_id

5. **Credential History Display**: Added to EditUserDialog:
   - User status badge (Active/Invited/Inactive)
   - "Credentials sent" date with Clock icon
   - "Sent by" with inviter's name (via joined query)
   - Last login timestamp
   - All dates formatted European style (e.g., "25 Jan 2026, 14:30")

6. **Type Updates**: Added `invitedByName` field to OrganisationUser type and updated all actions that return users to include this field (getOrganisationUsers fetches via Supabase join, other actions set to null).

### Change Log

- 2026-01-25: Story 7.4 created and ready for development
- 2026-01-25: Story 7.4 implemented and completed

### File List

- apps/portal/src/features/organisations/actions/resendUserCredentials.ts (created)
- apps/portal/src/features/organisations/actions/resetUserPassword.ts (created)
- apps/portal/src/lib/email/sendPasswordResetEmail.ts (created)
- apps/portal/src/features/organisations/actions/index.ts (modified - exports)
- apps/portal/src/features/organisations/actions/getOrganisationUsers.ts (modified - join for inviter name)
- apps/portal/src/features/organisations/actions/createOrganisationUser.ts (modified - added invitedByName)
- apps/portal/src/features/organisations/actions/toggleUserActive.ts (modified - added invitedByName)
- apps/portal/src/features/organisations/actions/updateOrganisationUser.ts (modified - added invitedByName)
- apps/portal/src/features/organisations/types.ts (modified - added invitedByName field)
- apps/portal/src/features/organisations/components/OrganisationUsersTable.tsx (modified - Resend/Reset buttons)
- apps/portal/src/features/organisations/components/EditUserDialog.tsx (modified - credential history)
