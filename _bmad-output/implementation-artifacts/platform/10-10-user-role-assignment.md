# Story 10.10: User Role Assignment

> **Extends Story 7.2** - Adds role assignment capability to the existing user management UI. The simple "producer" role default (7.2) is replaced by explicit role assignment using the new roles system.

**Status:** Done (Backend ready, UI in org detail page pending)
**Implemented:** 2026-02-01

## User Story

**As a** Super Admin or Org Admin,
**I want** to assign roles to users within an organization,
**So that** users have appropriate permissions.

## Acceptance Criteria

**Given** I am viewing a user in an organization
**When** I click "Manage Roles"
**Then** I see a list of available roles with checkboxes
**And** currently assigned roles are checked

**Given** I check/uncheck roles
**When** I save changes
**Then** user_roles records are updated
**And** user's effective permissions change immediately
**And** I see success toast "Roles updated"

**Given** I am an Org Admin (not Super Admin)
**When** I view the role assignment UI
**Then** I can only assign roles that I have permission to assign
**And** I cannot assign roles with more permissions than I have

**Given** a user has no roles assigned
**When** I view their profile
**Then** they have no permissions (except explicitly granted overrides)

## Implementation

### Backend Infrastructure (Done)
- `user_roles` table created with (user_id, organization_id, role_id) PK
- Migration assigns default roles based on existing user role column
- Permission checking respects user_roles assignments

### UI (Pending)
- Role assignment UI to be added to organization user detail page
- This would be in `/admin/organisations/[id]` user management section
