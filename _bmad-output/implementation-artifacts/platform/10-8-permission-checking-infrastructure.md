# Story 10.8: Permission Checking Infrastructure

**Status:** Done
**Implemented:** 2026-02-01

## User Story

**As a** developer,
**I want** a permission checking system based on the new model,
**So that** access control uses org features, roles, and overrides.

## Acceptance Criteria

**Given** the permission tables exist with data
**When** I call hasPermission(userId, orgId, featureCode)
**Then** it calculates effective permissions:
1. Check if org has feature enabled (organization_features)
2. Get all role permissions for user in org (user_roles → roles.permissions)
3. Apply user overrides (user_permission_overrides)
4. Return true if feature is in effective set

**And** a usePermissions() hook is available for client components:
```typescript
const { hasPermission, permissions } = usePermissions();
if (hasPermission('production.create')) { ... }
```

**And** a checkPermission() helper for server actions:
```typescript
export async function createProduction(data) {
  const ctx = await getAuthContext();
  if (!ctx.hasPermission('production.create')) {
    return { success: false, error: 'Permission denied' };
  }
  // ... proceed
}
```

**And** permission checks are cached per request to avoid repeated DB queries

## Implementation

### Files Created
- `apps/portal/src/lib/auth/permissions.ts` - Server-side permission functions
- `apps/portal/src/lib/auth/usePermissions.ts` - Client-side hook
- `apps/portal/src/app/api/auth/permissions/route.ts` - API endpoint

### Key Functions
- `hasPermission(userId, orgId, featureCode)` - Check single permission
- `getEffectivePermissions(userId, orgId)` - Get all permissions
- `getAuthContext()` - Get full auth context with permission helpers
- `requirePermission(featureCode)` - Throws if permission denied

### Permission Model (3 Layers)
1. Organization Features - What the org can access
2. Roles - Permission bundles assigned to users
3. User Overrides - Per-user grants/denies
