import { createClient } from "@/lib/supabase/server";
import { SessionUser } from "./getSession";

/**
 * Permission Checking Infrastructure
 *
 * Two-layer permission model:
 * 1. Organization Modules - what the org has access to (ceiling)
 * 2. User Modules - what the individual user has access to within that org
 *
 * Effective permission = org has module enabled AND user has module enabled
 * Platform admin = all permissions granted (skip checks)
 */

export interface PermissionContext {
  userId: string;
  organizationId: string;
  isPlatformAdmin: boolean;
}

/**
 * Check if a user has a specific permission in an organization
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

  if (!orgModule || !orgModule.enabled) {
    return false;
  }

  // Layer 2: Check if user has this module enabled
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userModule } = await (supabase as any)
    .from("user_modules")
    .select("enabled")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("module_code", moduleCode)
    .single();

  return userModule?.enabled === true;
}

/**
 * Get all effective permissions for a user in an organization
 *
 * Returns the intersection of org modules and user modules.
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
      .from("modules")
      .select("code");
    return allModules?.map((m: { code: string }) => m.code) || [];
  }

  if (!organizationId) {
    return [];
  }

  // Get organization's enabled modules
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgModules } = await (supabase as any)
    .from("organization_modules")
    .select("module_code")
    .eq("organization_id", organizationId)
    .eq("enabled", true);

  const orgModuleSet = new Set(
    orgModules?.map((m: { module_code: string }) => m.module_code) || []
  );

  // Get user's enabled modules
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userModules } = await (supabase as any)
    .from("user_modules")
    .select("module_code")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("enabled", true);

  // Intersection: user has module AND org has module
  const effectivePermissions: string[] = [];
  (userModules || []).forEach((um: { module_code: string }) => {
    if (orgModuleSet.has(um.module_code)) {
      effectivePermissions.push(um.module_code);
    }
  });

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

  // Use portalUserId from session (already fetched by getSession)
  const portalUserId = session.portalUserId;

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
