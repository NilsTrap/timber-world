import { createClient } from "@/lib/supabase/server";
import { SessionUser } from "./getSession";

/**
 * Permission Checking Infrastructure (Story 10.8)
 *
 * Three-layer permission model:
 * 1. Organization Features - what the org has access to
 * 2. Roles - bundles of permissions assigned to users
 * 3. User Overrides - per-user permission additions/removals
 *
 * Effective permission = (org has feature) AND (role grants OR override grants) AND NOT (override denies)
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
 * @param featureCode - Feature code to check (e.g., 'production.create')
 * @returns true if user has the permission
 */
export async function hasPermission(
  userId: string,
  organizationId: string | null,
  featureCode: string
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

  // Layer 1: Check if organization has this feature enabled
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgFeature } = await (supabase as any)
    .from("organization_features")
    .select("enabled")
    .eq("organization_id", organizationId)
    .eq("feature_code", featureCode)
    .single();

  // If feature is explicitly disabled, deny
  if (orgFeature && !orgFeature.enabled) {
    return false;
  }

  // If feature doesn't exist in org_features, check if it's in org type defaults
  if (!orgFeature) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orgTypes } = await (supabase as any)
      .from("organization_type_assignments")
      .select("organization_types(default_features)")
      .eq("organization_id", organizationId);

    const hasDefaultFeature = orgTypes?.some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ot: any) =>
        ot.organization_types?.default_features?.includes(featureCode) ||
        ot.organization_types?.default_features?.some(
          (f: string) => f === "*" || featureCode.startsWith(f.replace("*", ""))
        )
    );

    if (!hasDefaultFeature) {
      return false;
    }
  }

  // Layer 3: Check user overrides first (they take precedence)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: override } = await (supabase as any)
    .from("user_permission_overrides")
    .select("granted")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .eq("feature_code", featureCode)
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
      permissions.includes(featureCode) ||
      permissions.some(
        (p: string) =>
          p.endsWith("*") && featureCode.startsWith(p.replace("*", ""))
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
 * @returns Array of feature codes the user has access to
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
    // Platform admin has all features
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allFeatures } = await (supabase as any)
      .from("features")
      .select("code");
    return allFeatures?.map((f: { code: string }) => f.code) || [];
  }

  if (!organizationId) {
    return [];
  }

  // Get all features
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allFeatures } = await (supabase as any)
    .from("features")
    .select("code");

  const featureCodes = allFeatures?.map((f: { code: string }) => f.code) || [];
  const effectivePermissions: string[] = [];

  // Get organization's enabled features
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgFeatures } = await (supabase as any)
    .from("organization_features")
    .select("feature_code, enabled")
    .eq("organization_id", organizationId);

  const orgFeatureMap = new Map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orgFeatures?.map((f: any) => [f.feature_code, f.enabled]) || []
  );

  // Get org type default features
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgTypes } = await (supabase as any)
    .from("organization_type_assignments")
    .select("organization_types(default_features)")
    .eq("organization_id", organizationId);

  const defaultFeatures = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orgTypes?.forEach((ot: any) => {
    ot.organization_types?.default_features?.forEach((f: string) => {
      if (f === "*") {
        featureCodes.forEach((fc: string) => defaultFeatures.add(fc));
      } else if (f.endsWith("*")) {
        const prefix = f.replace("*", "");
        featureCodes
          .filter((fc: string) => fc.startsWith(prefix))
          .forEach((fc: string) => defaultFeatures.add(fc));
      } else {
        defaultFeatures.add(f);
      }
    });
  });

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
        featureCodes.forEach((fc: string) => rolePermissions.add(fc));
      } else if (p.endsWith("*")) {
        const prefix = p.replace("*", "");
        featureCodes
          .filter((fc: string) => fc.startsWith(prefix))
          .forEach((fc: string) => rolePermissions.add(fc));
      } else {
        rolePermissions.add(p);
      }
    });
  });

  // Get user overrides
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: overrides } = await (supabase as any)
    .from("user_permission_overrides")
    .select("feature_code, granted")
    .eq("user_id", userId)
    .eq("organization_id", organizationId);

  const grantOverrides = new Set<string>();
  const denyOverrides = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  overrides?.forEach((o: any) => {
    if (o.granted) {
      grantOverrides.add(o.feature_code);
    } else {
      denyOverrides.add(o.feature_code);
    }
  });

  // Calculate effective permissions
  for (const featureCode of featureCodes) {
    // Check if org has feature (explicit or default)
    const orgHasFeature =
      orgFeatureMap.get(featureCode) === true ||
      (orgFeatureMap.get(featureCode) === undefined &&
        defaultFeatures.has(featureCode));

    if (!orgHasFeature) continue;

    // Check if denied by override
    if (denyOverrides.has(featureCode)) continue;

    // Check if granted by override or role
    if (grantOverrides.has(featureCode) || rolePermissions.has(featureCode)) {
      effectivePermissions.push(featureCode);
    }
  }

  return effectivePermissions;
}

/**
 * Auth context with permission checking for server actions
 */
export interface AuthContext {
  session: SessionUser;
  hasPermission: (featureCode: string) => Promise<boolean>;
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
    hasPermission: async (featureCode: string) => {
      // Platform admins have all permissions
      if (session.isPlatformAdmin) return true;
      return permissions.includes(featureCode);
    },
    permissions,
  };
}

/**
 * Check permission and throw if denied
 * Use in server actions for clean permission enforcement
 */
export async function requirePermission(featureCode: string): Promise<void> {
  const ctx = await getAuthContext();

  if (!ctx) {
    throw new Error("Not authenticated");
  }

  const hasAccess = await ctx.hasPermission(featureCode);
  if (!hasAccess) {
    throw new Error(`Permission denied: ${featureCode}`);
  }
}
