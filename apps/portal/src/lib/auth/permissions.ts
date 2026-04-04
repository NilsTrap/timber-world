import { createClient } from "@/lib/supabase/server";
import { SessionUser } from "./getSession";

/**
 * Permission Checking Infrastructure (Story 10.8)
 *
 * Three-layer permission model:
 * 1. Organization Modules - what the org has access to
 * 2. Roles - bundles of permissions assigned to users
 * 3. User Overrides - per-user permission additions/removals
 *
 * Effective permission = (org has module) AND (role grants OR override grants) AND NOT (override denies)
 */

export interface PermissionContext {
  userId: string;
  organizationId: string;
  isPlatformAdmin: boolean;
}

/**
 * Check if a user has a specific permission in an organization
 *
 * @param userId - Portal user ID (not auth user ID)
 * @param organizationId - Organization ID to check permissions for
 * @param moduleCode - Module code to check (e.g., 'production.create')
 * @returns true if user has the permission
 */
export async function hasPermission(
  userId: string,
  organizationId: string | null,
  moduleCode: string
): Promise<boolean> {
  const supabase = await createClient();

  // Check if user is platform admin (has all permissions)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: user } = await (supabase as any)
    .from("portal_users")
    .select("is_platform_admin")
    .eq("id", userId)
    .single();

  if (user?.is_platform_admin) {
    return true;
  }

  // If no organization context, non-admin users have no permissions
  if (!organizationId) {
    return false;
  }

  // Layer 1: Check if organization has this module enabled
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgModule } = await (supabase as any)
    .from("organization_modules")
    .select("enabled")
    .eq("organization_id", organizationId)
    .eq("module_code", moduleCode)
    .single();

  // If module is explicitly disabled or not set, deny
  if (!orgModule || !orgModule.enabled) {
    return false;
  }

  // Layer 3: Check user overrides first (they take precedence)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: override } = await (supabase as any)
    .from("user_permission_overrides")
    .select("granted")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("module_code", moduleCode)
    .single();

  if (override) {
    return override.granted;
  }

  // Layer 2: Check roles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userRoles } = await (supabase as any)
    .from("user_roles")
    .select("roles(permissions)")
    .eq("user_id", userId)
    .eq("organization_id", organizationId);

  if (!userRoles || userRoles.length === 0) {
    return false;
  }

  // Check if any role grants this permission
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasRolePermission = userRoles.some((ur: any) => {
    const permissions = ur.roles?.permissions || [];
    return (
      permissions.includes("*") ||
      permissions.includes(moduleCode) ||
      permissions.some(
        (p: string) =>
          p.endsWith("*") && moduleCode.startsWith(p.replace("*", ""))
      )
    );
  });

  return hasRolePermission;
}

/**
 * Get all effective permissions for a user in an organization
 *
 * @param userId - Portal user ID
 * @param organizationId - Organization ID
 * @returns Array of module codes the user has access to
 */
export async function getEffectivePermissions(
  userId: string,
  organizationId: string | null
): Promise<string[]> {
  const supabase = await createClient();

  // Check if user is platform admin
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: user } = await (supabase as any)
    .from("portal_users")
    .select("is_platform_admin")
    .eq("id", userId)
    .single();

  if (user?.is_platform_admin) {
    // Platform admin has all modules
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allModules } = await (supabase as any)
      .from("features")
      .select("code");
    return allModules?.map((f: { code: string }) => f.code) || [];
  }

  if (!organizationId) {
    return [];
  }

  // Get all features
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allModules } = await (supabase as any)
    .from("features")
    .select("code");

  const moduleCodes = allModules?.map((f: { code: string }) => f.code) || [];
  const effectivePermissions: string[] = [];

  // Get organization's enabled modules
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgModules } = await (supabase as any)
    .from("organization_modules")
    .select("module_code, enabled")
    .eq("organization_id", organizationId);

  const orgModuleMap = new Map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orgModules?.map((m: any) => [m.module_code, m.enabled]) || []
  );

  // Get user's role permissions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userRoles } = await (supabase as any)
    .from("user_roles")
    .select("roles(permissions)")
    .eq("user_id", userId)
    .eq("organization_id", organizationId);

  const rolePermissions = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userRoles?.forEach((ur: any) => {
    ur.roles?.permissions?.forEach((p: string) => {
      if (p === "*") {
        moduleCodes.forEach((mc: string) => rolePermissions.add(mc));
      } else if (p.endsWith("*")) {
        const prefix = p.replace("*", "");
        moduleCodes
          .filter((mc: string) => mc.startsWith(prefix))
          .forEach((mc: string) => rolePermissions.add(mc));
      } else {
        rolePermissions.add(p);
      }
    });
  });

  // Get user overrides
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: overrides } = await (supabase as any)
    .from("user_permission_overrides")
    .select("module_code, granted")
    .eq("user_id", userId)
    .eq("organization_id", organizationId);

  const grantOverrides = new Set<string>();
  const denyOverrides = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  overrides?.forEach((o: any) => {
    if (o.granted) {
      grantOverrides.add(o.module_code);
    } else {
      denyOverrides.add(o.module_code);
    }
  });

  // Calculate effective permissions
  for (const moduleCode of moduleCodes) {
    // Check if org has module explicitly enabled
    const orgHasModule = orgModuleMap.get(moduleCode) === true;

    if (!orgHasModule) continue;

    // Check if denied by override
    if (denyOverrides.has(moduleCode)) continue;

    // Check if granted by override or role
    if (grantOverrides.has(moduleCode) || rolePermissions.has(moduleCode)) {
      effectivePermissions.push(moduleCode);
    }
  }

  return effectivePermissions;
}

/**
 * Auth context with permission checking for server actions
 */
export interface AuthContext {
  session: SessionUser;
  hasPermission: (moduleCode: string) => Promise<boolean>;
  permissions: string[];
}

/**
 * Get auth context for server actions
 * Includes session and permission checking
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const { getSession } = await import("./getSession");
  const session = await getSession();

  if (!session) {
    return null;
  }

  // Get portal user ID
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: portalUser } = await (supabase as any)
    .from("portal_users")
    .select("id")
    .eq("auth_user_id", session.id)
    .single();

  const portalUserId = portalUser?.id;

  if (!portalUserId) {
    return null;
  }

  const permissions = await getEffectivePermissions(
    portalUserId,
    session.currentOrganizationId
  );

  return {
    session,
    hasPermission: async (moduleCode: string) => {
      // Platform admins have all permissions
      if (session.isPlatformAdmin) return true;
      return permissions.includes(moduleCode);
    },
    permissions,
  };
}

/**
 * Check permission and throw if denied
 * Use in server actions for clean permission enforcement
 */
export async function requirePermission(moduleCode: string): Promise<void> {
  const ctx = await getAuthContext();

  if (!ctx) {
    throw new Error("Not authenticated");
  }

  const hasAccess = await ctx.hasPermission(moduleCode);
  if (!hasAccess) {
    throw new Error(`Permission denied: ${moduleCode}`);
  }
}
