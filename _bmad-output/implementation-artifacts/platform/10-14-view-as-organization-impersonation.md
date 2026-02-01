# Story 10.14: View As - Organization Impersonation

> **Extends Story 6.5 and 9.2** - Goes beyond filtering (6.5) and per-org breakdown (9.2) to full impersonation. Super Admin sees exactly what org users see, including their navigation and permissions.

**Status:** Done
**Implemented:** 2026-02-01

## User Story

**As a** Super Admin,
**I want** to view the portal as any organization,
**So that** I can test and support users.

## Acceptance Criteria

**Given** I am logged in as Super Admin
**When** I am in platform view
**Then** I see "View as Organization" button in the header

**Given** I click "View as Organization"
**When** the selector opens
**Then** I see a searchable list of all organizations

**Given** I select an organization
**When** I confirm
**Then** my view switches to that organization's context
**And** I see a banner: "Viewing as: [Org Name] - [Exit View As]"
**And** I see the same sidebar/navigation that org's users see
**And** I see only that org's data
**And** the URL includes ?viewAs=orgId for bookmarking

**Given** I am in View As mode
**When** I click "Exit View As"
**Then** I return to platform admin view
**And** the banner disappears
**And** I see consolidated data again

**Given** I am in View As mode
**When** I perform actions (create, edit, delete)
**Then** actions are performed as that organization
**And** audit log records: actual_user_id = me, acting_as_org_id = org

## Implementation

### Files Created
- `apps/portal/src/features/view-as/actions/viewAs.ts` - Server actions
- `apps/portal/src/features/view-as/actions/index.ts`
- `apps/portal/src/features/view-as/components/ViewAsBanner.tsx`
- `apps/portal/src/features/view-as/components/ViewAsBannerWrapper.tsx`
- `apps/portal/src/features/view-as/components/ViewAsSelector.tsx`
- `apps/portal/src/features/view-as/components/index.ts`

### Files Modified
- `apps/portal/src/app/(portal)/layout.tsx` - Added ViewAsBannerWrapper
- `apps/portal/src/components/layout/SidebarLink.tsx` - Added Eye icon

### Server Actions
- `startViewAsOrg(organizationId)` - Enter org impersonation
- `exitViewAs()` - Exit impersonation mode
- Audit logging for impersonation events
