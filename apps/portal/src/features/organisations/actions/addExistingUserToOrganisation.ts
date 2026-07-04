"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import { resolveAddPersonScope, applyAddPersonGroups } from "./_addPersonScope";

/**
 * Existing user info returned by search
 */
export interface ExistingUserInfo {
  id: string;
  email: string;
  name: string;
  currentOrganisations: Array<{
    id: string;
    code: string;
    name: string;
  }>;
}

/**
 * Search User By Email
 *
 * Searches for an existing portal user by email.
 * Returns user info including their current organizations.
 * Super Admin only.
 */
export async function searchUserByEmail(
  email: string
): Promise<ActionResult<ExistingUserInfo | null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { success: true, data: null };
  }

  const supabase = await createClient();

  // Search for user by email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: user, error } = await (supabase as any)
    .from("portal_users")
    .select("id, email, name")
    .eq("email", normalizedEmail)
    .single();

  if (error || !user) {
    // User not found is not an error, just return null
    return { success: true, data: null };
  }

  // Get user's current organization memberships
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: memberships } = await (supabase as any)
    .from("organization_memberships")
    .select(`
      organization_id,
      organisation:organisations(id, code, name)
    `)
    .eq("user_id", user.id)
    .eq("is_active", true);

  // Also check the legacy organisation_id field on portal_users
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: legacyOrg } = await (supabase as any)
    .from("portal_users")
    .select(`
      organisation_id,
      organisation:organisations!portal_users_organisation_id_fkey(id, code, name)
    `)
    .eq("id", user.id)
    .single();

  const orgs: Array<{ id: string; code: string; name: string }> = [];

  // Add legacy org if exists
  if (legacyOrg?.organisation) {
    orgs.push({
      id: legacyOrg.organisation.id,
      code: legacyOrg.organisation.code,
      name: legacyOrg.organisation.name,
    });
  }

  // Add memberships (avoiding duplicates)
  if (memberships) {
    for (const m of memberships) {
      if (m.organisation && !orgs.some(o => o.id === m.organisation.id)) {
        orgs.push({
          id: m.organisation.id,
          code: m.organisation.code,
          name: m.organisation.name,
        });
      }
    }
  }

  return {
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      currentOrganisations: orgs,
    },
  };
}

/**
 * Add Existing User To Organisation (K3 · Q2 book-scoped)
 *
 * Adds an existing user to an organisation via organization_memberships, then
 * assigns access groups inline (one pass).
 *
 * AUTHORISATION (Q2): admins may add to ANY org and pass `groupIds` (full
 * picker). A book-scoped non-admin (salesperson/purchasing) may add ONLY to an
 * org in their clients/suppliers book — enforced by resolveAddPersonScope — and
 * the access group is FORCED server-side; any `groupIds` they pass are ignored.
 * Trader orgs are admin-only. The gate is the wall: after it passes, writes run
 * on the service-role client (the same pattern as counterparties' orgContacts).
 */
export async function addExistingUserToOrganisation(
  userId: string,
  organisationId: string,
  groupIds?: string[],
): Promise<ActionResult<{ userId: string; organisationId: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isValidUUID(userId)) {
    return { success: false, error: "Invalid user ID", code: "INVALID_USER_ID" };
  }

  if (!isValidUUID(organisationId)) {
    return { success: false, error: "Invalid organisation ID", code: "INVALID_ORG_ID" };
  }

  // Q2 wall — may this caller add a user to this org? (admin | scoped | no)
  const scope = await resolveAddPersonScope(session, organisationId);
  if (!scope.ok) {
    return { success: false, error: scope.error, code: scope.code };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // Verify user exists
  const { data: user, error: userError } = await supabase
    .from("portal_users")
    .select("id, name, email, organisation_id")
    .eq("id", userId)
    .maybeSingle();

  if (userError || !user) {
    return { success: false, error: "User not found", code: "USER_NOT_FOUND" };
  }

  // Verify organisation exists
  const { data: org, error: orgError } = await supabase
    .from("organisations")
    .select("id")
    .eq("id", organisationId)
    .maybeSingle();

  if (orgError || !org) {
    return { success: false, error: "Organisation not found", code: "ORG_NOT_FOUND" };
  }

  // Existing membership?
  const { data: existingMembership } = await supabase
    .from("organization_memberships")
    .select("id, is_active")
    .eq("user_id", userId)
    .eq("organization_id", organisationId)
    .maybeSingle();

  if (existingMembership) {
    if (existingMembership.is_active) {
      return { success: false, error: "User is already a member of this organisation", code: "ALREADY_MEMBER" };
    }

    // Reactivate inactive membership
    const { error: updateError } = await supabase
      .from("organization_memberships")
      .update({ is_active: true })
      .eq("id", existingMembership.id);

    if (updateError) {
      console.error("Failed to reactivate membership:", updateError);
      return { success: false, error: "Failed to add user to organisation", code: "UPDATE_FAILED" };
    }
  } else if (user.organisation_id === organisationId) {
    // Their legacy home org already IS this org — already a member.
    return { success: false, error: "User is already a member of this organisation", code: "ALREADY_MEMBER" };
  } else {
    // Current user's portal_users id for invited_by
    const { data: currentPortalUser } = await supabase
      .from("portal_users")
      .select("id")
      .eq("auth_user_id", session.id)
      .maybeSingle();

    const { error: insertError } = await supabase
      .from("organization_memberships")
      .insert({
        user_id: userId,
        organization_id: organisationId,
        is_active: true,
        is_primary: false,
        invited_at: new Date().toISOString(),
        invited_by: currentPortalUser?.id ?? null,
      });

    if (insertError) {
      console.error("Failed to create membership:", insertError);
      return { success: false, error: "Failed to add user to organisation", code: "INSERT_FAILED" };
    }
  }

  // Inline access-group assignment (Q2 forced group for scoped callers;
  // validated picker for admins) + cache-tag bust.
  const groupRes = await applyAddPersonGroups(supabase, scope, userId, organisationId, groupIds);
  if (!groupRes.success) {
    return { success: false, error: `User added but group assignment failed: ${groupRes.error}`, code: "GROUP_ASSIGN_FAILED" };
  }

  return { success: true, data: { userId, organisationId } };
}
