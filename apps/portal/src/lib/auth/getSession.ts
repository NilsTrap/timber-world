import { createClient } from "@/lib/supabase/server";

/**
 * User Role Types (Legacy - kept for backward compatibility)
 *
 * MVP supports two simple roles:
 * - admin: Timber World staff with full access
 * - producer: Factory managers with production access
 */
export type UserRole = "admin" | "producer";

/**
 * Organization Membership
 */
export interface OrganizationMembership {
  organizationId: string;
  organizationCode: string;
  organizationName: string;
  isPrimary: boolean;
}

/**
 * Session User (Epic 10 - Enhanced with multi-org support)
 */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole; // Legacy role (kept for backward compatibility)
  isPlatformAdmin: boolean;

  // Current organization context (switchable for multi-org users)
  currentOrganizationId: string | null;
  currentOrganizationCode: string | null;
  currentOrganizationName: string | null;

  // All organization memberships
  memberships: OrganizationMembership[];

  // View As context (for Super Admin impersonation)
  viewAsOrganizationId?: string | null;
  viewAsUserId?: string | null;

  // Legacy fields (kept for backward compatibility)
  organisationId: string | null;
  organisationCode: string | null;
  organisationName: string | null;
}

/**
 * Get Current User Session
 *
 * Retrieves the authenticated user from Supabase and extracts role from metadata.
 * Queries portal_users and organization_memberships for multi-org context.
 *
 * Multi-tenancy context (Epic 10):
 * - Platform Admins (is_platform_admin = true) have access to all organizations
 * - Users with memberships can switch between their organizations
 * - Current organization is determined by: viewAs > cookie > primary membership
 *
 * @returns SessionUser if authenticated, null otherwise
 */
export async function getSession(): Promise<SessionUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Get role from user metadata (set during registration)
  const role = (user.user_metadata?.role as UserRole) || "producer";
  const name = (user.user_metadata?.name as string) || user.email || "User";

  // Query portal_users for user details
  // Note: Must specify the FK explicitly due to multiple relationships (Epic 10 added user_roles, user_permission_overrides)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: portalUser, error: portalUserError } = await (supabase as any)
    .from("portal_users")
    .select(`
      id,
      organisation_id,
      is_platform_admin,
      organisations!portal_users_party_id_fkey(code, name)
    `)
    .eq("auth_user_id", user.id)
    .single();

  if (portalUserError) {
    console.error("[getSession] Failed to fetch portal_user:", portalUserError);
  }

  if (!portalUser) {
    // Legacy auth-only user - return minimal session
    return {
      id: user.id,
      email: user.email || "",
      name,
      role,
      isPlatformAdmin: false,
      currentOrganizationId: null,
      currentOrganizationCode: null,
      currentOrganizationName: null,
      memberships: [],
      organisationId: null,
      organisationCode: null,
      organisationName: null,
    };
  }

  const isPlatformAdmin = portalUser.is_platform_admin ?? false;
  const portalUserId = portalUser.id;

  // Query organization memberships
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membershipsData } = await (supabase as any)
    .from("organization_memberships")
    .select(`
      organization_id,
      is_primary,
      organisations!organization_memberships_organization_id_fkey(code, name)
    `)
    .eq("user_id", portalUserId)
    .eq("is_active", true);

  const memberships: OrganizationMembership[] = (membershipsData || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m: any) => ({
      organizationId: m.organization_id,
      organizationCode: m.organisations?.code || "",
      organizationName: m.organisations?.name || "",
      isPrimary: m.is_primary,
    })
  );

  // Determine current organization
  // Priority: 1) viewAs (from cookie/URL), 2) primary membership, 3) first membership, 4) legacy org_id
  let currentOrganizationId: string | null = null;
  let currentOrganizationCode: string | null = null;
  let currentOrganizationName: string | null = null;

  // TODO: Check for viewAs cookie/parameter (Story 10.14)

  // Find primary membership or first membership
  const primaryMembership = memberships.find((m) => m.isPrimary);
  const firstMembership = memberships[0];
  const activeMembership = primaryMembership || firstMembership;

  if (activeMembership) {
    currentOrganizationId = activeMembership.organizationId;
    currentOrganizationCode = activeMembership.organizationCode;
    currentOrganizationName = activeMembership.organizationName;
  } else if (portalUser.organisation_id) {
    // Fallback to legacy organisation_id
    currentOrganizationId = portalUser.organisation_id;
    currentOrganizationCode = portalUser.organisations?.code ?? null;
    currentOrganizationName = portalUser.organisations?.name ?? null;
  }

  // For platform admins, current org is null (platform view) unless explicitly set
  if (isPlatformAdmin && !activeMembership) {
    currentOrganizationId = null;
    currentOrganizationCode = null;
    currentOrganizationName = null;
  }

  return {
    id: user.id,
    email: user.email || "",
    name,
    role,
    isPlatformAdmin,
    currentOrganizationId,
    currentOrganizationCode,
    currentOrganizationName,
    memberships,
    // Legacy fields for backward compatibility
    organisationId: currentOrganizationId,
    organisationCode: currentOrganizationCode,
    organisationName: currentOrganizationName,
  };
}

/**
 * Check if user has admin role (legacy check)
 */
export function isAdmin(session: SessionUser | null): boolean {
  return session?.role === "admin";
}

/**
 * Check if user has producer role (legacy check)
 */
export function isProducer(session: SessionUser | null): boolean {
  return session?.role === "producer";
}

/**
 * Check if user is Platform Admin
 *
 * Platform Admin has access to all organizations and platform settings.
 * This replaces the old isSuperAdmin check.
 */
export function isPlatformAdmin(session: SessionUser | null): boolean {
  return session?.isPlatformAdmin === true;
}

/**
 * Check if user is Super Admin
 *
 * For backward compatibility, checks both:
 * - New: is_platform_admin flag
 * - Legacy: admin role with no organization
 */
export function isSuperAdmin(session: SessionUser | null): boolean {
  if (!session) return false;
  // New Epic 10 check
  if (session.isPlatformAdmin) return true;
  // Legacy fallback: admin role with no organization
  return session.role === "admin" && session.currentOrganizationId === null;
}

/**
 * Check if user is Organisation User (scoped access)
 *
 * Organisation User has at least one organization membership.
 */
export function isOrganisationUser(session: SessionUser | null): boolean {
  return (
    session !== null &&
    (session.memberships.length > 0 || session.currentOrganizationId !== null)
  );
}

/**
 * Check if user has multiple organization memberships
 */
export function hasMultipleOrganizations(session: SessionUser | null): boolean {
  return session !== null && session.memberships.length > 1;
}
