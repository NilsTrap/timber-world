# Story 10.15: View As - User Impersonation

**Status:** Done
**Implemented:** 2026-02-01

## User Story

**As a** Super Admin,
**I want** to view the portal as a specific user,
**So that** I can see exactly what they see and debug issues.

## Acceptance Criteria

**Given** I am viewing an organization (in View As mode)
**When** I click "View as User"
**Then** I see a list of users in that organization

**Given** I select a user
**When** I confirm
**Then** my view switches to exactly what that user sees
**And** banner shows: "Viewing as: [User Name] @ [Org Name] - [Exit]"
**And** permissions match that user's effective permissions
**And** hidden features are hidden for me too

**Given** I am in user impersonation mode
**When** I toggle "Read-Only Mode"
**Then** I can view but not modify anything
**And** all action buttons are disabled
**And** this is the default for safety

**Given** I disable Read-Only Mode
**When** I perform actions
**Then** they execute as that user would
**And** audit log records: actual_user_id = me, acting_as_user_id = user

**Given** I exit user impersonation
**When** I click "Exit"
**Then** I return to org impersonation level
**And** clicking Exit again returns to platform view

## Implementation

### Files Created/Modified
- `apps/portal/src/features/view-as/actions/viewAs.ts` - Added user impersonation actions

### Server Actions
- `startViewAsUser(userId)` - Enter user impersonation
- `toggleViewAsReadOnly(readOnly)` - Toggle read-only mode
- Session context includes `viewAsUserId` when impersonating

### UI Components
- ViewAsSelector supports both org and user selection
- ViewAsBanner shows current impersonation context with exit button
