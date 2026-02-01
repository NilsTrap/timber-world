# Story 10.7: Organization Switcher UI

> **Extends Story 6.5** - The Super Admin org filter (6.5) remains for platform-wide filtering. This adds an org switcher for regular users with multiple memberships. Single-org users see no switcher (same as before).

**Status:** Done
**Implemented:** 2026-02-01

## User Story

**As a** user with multiple organization memberships,
**I want** to switch between my organizations,
**So that** I can work in the context of each organization.

## Acceptance Criteria

**Given** I am logged in with multiple organization memberships
**When** I view the sidebar
**Then** I see my current organization name with a dropdown indicator

**Given** I click on the organization selector
**When** the dropdown opens
**Then** I see all my organization memberships
**And** my current organization is highlighted
**And** each option shows organization code and name

**Given** I select a different organization
**When** I click on it
**Then** my current_organization_id is updated in session/cookie
**And** the page refreshes with the new organization context
**And** all data views now show that organization's data

**Given** I have only one organization membership
**When** I view the sidebar
**Then** I see my organization name without dropdown (not clickable)

**Given** I am a Platform Admin
**When** I view the sidebar
**Then** I see "Timber World Platform" as current context
**And** I have access to the organization filter dropdown (existing behavior)

## Implementation

### Files Created
- `apps/portal/src/components/layout/OrganizationSwitcher.tsx`
- `apps/portal/src/app/api/auth/switch-organization/route.ts`

### Files Modified
- `apps/portal/src/components/layout/Sidebar.tsx` - Integrated OrganizationSwitcher
- `apps/portal/src/components/layout/SidebarWrapper.tsx` - Pass membership data to Sidebar

### UI Components
- OrganizationSwitcher uses Popover component from @timber/ui
- Shows dropdown only for users with >1 membership
- Single-org users see brand name only (no duplicate)
