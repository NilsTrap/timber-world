import { createClient } from "@/lib/supabase/server";

/**
 * User Role Types
 *
 * MVP supports two simple roles:
 * - admin: Timber World staff with full access
 * - producer: Factory managers with production access
 */
export type UserRole = "admin" | "producer";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organisationId: string | null;
  organisationCode: string | null;
  organisationName: string | null;
}

/**
 * Get Current User Session
 *
 * Retrieves the authenticated user from Supabase and extracts role from metadata.
 * Queries portal_users to get organisation context for ALL users.
 *
 * Multi-tenancy context:
 * - Users with organisation_id = NULL are Super Admins (platform-level access)
 * - Users with organisation_id set are Organisation Users (scoped access)
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

  // Query portal_users for organisation context for ALL users
  // Super Admin users will have organisation_id = NULL
  // Organisation users will have organisation_id set
  let organisationId: string | null = null;
  let organisationCode: string | null = null;
  let organisationName: string | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: portalUser } = await (supabase as any)
    .from("portal_users")
    .select("organisation_id, organisations(code, name)")
    .eq("auth_user_id", user.id)
    .single();

  if (portalUser) {
    organisationId = portalUser.organisation_id ?? null;
    organisationCode = portalUser.organisations?.code ?? null;
    organisationName = portalUser.organisations?.name ?? null;
  }
  // If user not found in portal_users, all org fields remain null (legacy auth-only user)

  return {
    id: user.id,
    email: user.email || "",
    name,
    role,
    organisationId,
    organisationCode,
    organisationName,
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
 * Check if user is Super Admin (platform-level access)
 *
 * Super Admin = admin role with no organisation (organisation_id = NULL)
 * Has access to all organisations' data.
 *
 * Note: Requires both admin role AND null organisationId to prevent
 * legacy/orphaned auth users from being misidentified as Super Admin.
 */
export function isSuperAdmin(session: SessionUser | null): boolean {
  return session !== null && session.role === "admin" && session.organisationId === null;
}

/**
 * Check if user is Organisation User (scoped access)
 *
 * Organisation User = authenticated user with organisation_id set
 * Can only see data for their own organisation.
 */
export function isOrganisationUser(session: SessionUser | null): boolean {
  return session !== null && session.organisationId !== null;
}
