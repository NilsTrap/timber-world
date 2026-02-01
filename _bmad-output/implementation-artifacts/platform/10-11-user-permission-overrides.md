# Story 10.11: User Permission Overrides

> **Extends Story 7.2** - Adds per-user permission fine-tuning to the existing user management UI. This is the third layer of the permission model (org features → roles → user overrides).

**Status:** Done (Backend ready, UI in org detail page pending)
**Implemented:** 2026-02-01

## User Story

**As a** Super Admin,
**I want** to add or remove specific permissions for a user,
**So that** I can fine-tune access beyond role templates.

## Acceptance Criteria

**Given** I am viewing a user's permissions
**When** I click "Permission Overrides"
**Then** I see:
- Current effective permissions (from roles)
- List of all features with override options: [Inherit] [Grant] [Deny]

**Given** I set a feature to "Grant"
**When** I save
**Then** user gets that permission even if no role provides it
**And** it only works if the org has the feature enabled

**Given** I set a feature to "Deny"
**When** I save
**Then** user loses that permission even if roles provide it

**Given** I set a feature to "Inherit"
**When** I save
**Then** the override is removed
**And** permission comes from roles only

**Given** overrides exist for a user
**When** I view their permissions
**Then** overridden permissions are visually marked (e.g., with + or - icon)

## Implementation

### Backend Infrastructure (Done)
- `user_permission_overrides` table created
- `getEffectivePermissions()` applies overrides after role permissions
- Override model: `granted = true` adds permission, `granted = false` removes it

### UI (Pending)
- Permission override UI to be added to organization user detail page
- Would show tri-state toggles: Inherit / Grant / Deny
