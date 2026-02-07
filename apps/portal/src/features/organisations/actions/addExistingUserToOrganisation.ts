"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";

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
 * Add Existing User To Organisation
 *
 * Adds an existing user to an organization via organization_memberships.
 * Super Admin only.
 */
export async function addExistingUserToOrganisation(
  userId: string,
  organisationId: string
): Promise<ActionResult<{ userId: string; organisationId: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!isSuperAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  if (!isValidUUID(userId)) {
    return { success: false, error: "Invalid user ID", code: "INVALID_USER_ID" };
  }

  if (!isValidUUID(organisationId)) {
    return { success: false, error: "Invalid organisation ID", code: "INVALID_ORG_ID" };
  }

  const supabase = await createClient();

  // Verify user exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: user, error: userError } = await (supabase as any)
    .from("portal_users")
    .select("id, name, email")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    return { success: false, error: "User not found", code: "USER_NOT_FOUND" };
  }

  // Verify organisation exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: org, error: orgError } = await (supabase as any)
    .from("organisations")
    .select("id")
    .eq("id", organisationId)
    .single();

  if (orgError || !org) {
    return { success: false, error: "Organisation not found", code: "ORG_NOT_FOUND" };
  }

  // Check if membership already exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingMembership } = await (supabase as any)
    .from("organization_memberships")
    .select("id, is_active")
    .eq("user_id", userId)
    .eq("organization_id", organisationId)
    .single();

  if (existingMembership) {
    if (existingMembership.is_active) {
      return { success: false, error: "User is already a member of this organisation", code: "ALREADY_MEMBER" };
    }

    // Reactivate inactive membership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from("organization_memberships")
      .update({ is_active: true })
      .eq("id", existingMembership.id);

    if (updateError) {
      console.error("Failed to reactivate membership:", updateError);
      return { success: false, error: "Failed to add user to organisation", code: "UPDATE_FAILED" };
    }

    return { success: true, data: { userId, organisationId } };
  }

  // Check if user's legacy organisation_id matches this org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userWithOrg } = await (supabase as any)
    .from("portal_users")
    .select("organisation_id")
    .eq("id", userId)
    .single();

  if (userWithOrg?.organisation_id === organisationId) {
    return { success: false, error: "User is already a member of this organisation", code: "ALREADY_MEMBER" };
  }

  // Get current user's portal_users ID for invited_by
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentPortalUser } = await (supabase as any)
    .from("portal_users")
    .select("id")
    .eq("auth_user_id", session.id)
    .single();

  const invitedById = currentPortalUser?.id ?? null;

  // Create new membership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase as any)
    .from("organization_memberships")
    .insert({
      user_id: userId,
      organization_id: organisationId,
      is_active: true,
      is_primary: false,
      invited_at: new Date().toISOString(),
      invited_by: invitedById,
    });

  if (insertError) {
    console.error("Failed to create membership:", insertError);
    return { success: false, error: "Failed to add user to organisation", code: "INSERT_FAILED" };
  }

  return { success: true, data: { userId, organisationId } };
}
