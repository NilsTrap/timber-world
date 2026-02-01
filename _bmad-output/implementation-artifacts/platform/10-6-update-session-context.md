# Story 10.6: Update Session Context

> **Supersedes Story 6.2** - Enhances session from single org context to multi-org aware. Session now includes all memberships and current_organization (switchable). Backward compatible: single-org users work exactly as before.

**Status:** Done
**Implemented:** 2026-02-01

## User Story

**As a** user,
**I want** my session to include my organization memberships,
**So that** I can work in the context of my organization(s).

## Acceptance Criteria

**Given** I log in successfully
**When** my session is created
**Then** the session includes:
```typescript
{
  user_id: string;
  email: string;
  name: string;
  is_platform_admin: boolean;
  current_organization_id: string | null;
  current_organization_code: string | null;
  current_organization_name: string | null;
  memberships: Array<{
    organization_id: string;
    organization_code: string;
    organization_name: string;
    is_primary: boolean;
  }>;
}
```

**And** if I have one membership, current_organization is set to that org
**And** if I have multiple memberships, current_organization is set to my primary org
**And** if I am platform admin, current_organization is null (platform view)

**And** session context is available in:
- Server components via getSession()
- Server actions via getAuthContext()
- Client components via useSession() hook

## Implementation

### Files Modified
- `apps/portal/src/lib/auth/getSession.ts` - Enhanced SessionUser interface with memberships, viewAs context
- `apps/portal/src/lib/auth/index.ts` - Updated exports

### Key Changes
- SessionUser interface extended with:
  - `isPlatformAdmin: boolean`
  - `currentOrganizationId/Code/Name: string | null`
  - `memberships: OrganizationMembership[]`
  - `viewAsOrganizationId/viewAsUserId: string | null`
- getSession() queries organization_memberships table
- Backward compatibility maintained with legacy `organisationId` field
