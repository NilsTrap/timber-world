# Story 10.9: Role Management UI

**Status:** Done
**Implemented:** 2026-02-01

## User Story

**As a** Super Admin,
**I want** to view and manage roles,
**So that** I can customize permission bundles.

## Acceptance Criteria

**Given** I am logged in as Super Admin
**When** I navigate to Admin > Roles
**Then** I see a table of all roles with columns:
- Name
- Description
- Permission Count
- System (yes/no)
- Actions

**Given** I click "Add Role"
**When** the form opens
**Then** I can enter: Name, Description
**And** I can select permissions from a categorized checkbox list
**And** I can save the new role

**Given** I edit an existing role
**When** I modify permissions and save
**Then** the role is updated
**And** users with this role get updated permissions immediately

**Given** I try to delete a system role
**When** I click delete
**Then** I see an error "System roles cannot be deleted"

**Given** I delete a custom role that has users assigned
**When** I confirm deletion
**Then** I see a warning with affected user count
**And** upon confirmation, role assignments are removed
**And** the role is deleted

## Implementation

### Files Created
- `apps/portal/src/app/(portal)/admin/roles/page.tsx`
- `apps/portal/src/features/roles/actions/getRoles.ts`
- `apps/portal/src/features/roles/actions/getFeatures.ts`
- `apps/portal/src/features/roles/actions/saveRole.ts`
- `apps/portal/src/features/roles/actions/index.ts`
- `apps/portal/src/features/roles/components/RolesTable.tsx`
- `apps/portal/src/features/roles/components/RoleFormDialog.tsx`
- `apps/portal/src/features/roles/components/index.ts`

### Files Modified
- `apps/portal/src/components/layout/SidebarWrapper.tsx` - Added Roles nav item
- `apps/portal/src/components/layout/SidebarLink.tsx` - Added Shield icon
- `packages/ui/src/components/checkbox.tsx` - New component
- `packages/ui/src/index.ts` - Export Checkbox

### UI Components
- RolesTable with user count per role
- RoleFormDialog with categorized permission checkboxes
- Category-level "select all" toggles
