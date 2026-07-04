"use server";

import { updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import { resolveAddPersonScope } from "./_addPersonScope";
import { updateUserAccessGroups as updateUserAccessGroupsSvc } from "@/features/access/services/groupsWrite";

/**
 * Remove User From Organisation (K3)
 *
 * Deactivates the user's organization_memberships row for this org and strips
 * their access-group assignments there (defence in depth — effective rights are
 * computed from user_access_groups, so leaving them would keep access alive).
 *
 * REFUSES to remove the user's last or PRIMARY organisation — that would strand
 * the account or leave it without a home org. The caller must set a different
 * primary first. Their legacy home org (portal_users.organisation_id) counts as
 * a primary org and cannot be removed here either.
 *
 * AUTHORISATION (Q2): same wall as add/create — admins for any org; a book-scoped
 * non-admin only for an org in their clients/suppliers book.
 */
export async function removeUserFromOrganisation(
  userId: string,
  organisationId: string,
): Promise<ActionResult<{ userId: string; organisationId: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }
  if (!isValidUUID(userId) || !isValidUUID(organisationId)) {
    return { success: false, error: "Invalid ID", code: "INVALID_ID" };
  }

  // Q2 wall — same scope as add/create.
  const scope = await resolveAddPersonScope(session, organisationId);
  if (!scope.ok) {
    return { success: false, error: scope.error, code: scope.code };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // Active memberships of the user.
  const { data: memsData, error: memErr } = await admin
    .from("organization_memberships")
    .select("id, organization_id, is_primary")
    .eq("user_id", userId)
    .eq("is_active", true);
  if (memErr) {
    console.error("Failed to load memberships for removal:", memErr);
    return { success: false, error: "Failed to load memberships", code: "FETCH_FAILED" };
  }
  const active = (memsData ?? []) as Array<{ id: string; organization_id: string; is_primary: boolean }>;

  // Legacy home org (portal_users.organisation_id) — treated as a primary org.
  const { data: pu } = await admin
    .from("portal_users")
    .select("organisation_id")
    .eq("id", userId)
    .maybeSingle();
  const legacyOrgId = (pu?.organisation_id as string | null) ?? null;

  const target = active.find((m) => m.organization_id === organisationId) ?? null;

  // No membership row for this org.
  if (!target) {
    if (legacyOrgId === organisationId) {
      return {
        success: false,
        error: "This is the user's home organisation and cannot be removed. Set a different primary organisation first.",
        code: "PRIMARY_ORG",
      };
    }
    return { success: false, error: "User is not a member of this organisation", code: "NOT_MEMBER" };
  }

  // Distinct orgs the user belongs to (memberships + legacy home org).
  const orgSet = new Set(active.map((m) => m.organization_id));
  if (legacyOrgId) orgSet.add(legacyOrgId);
  if (orgSet.size <= 1) {
    return {
      success: false,
      error: "Cannot remove the user's only organisation — deactivate or delete the user instead.",
      code: "LAST_ORG",
    };
  }

  // Refuse the primary org (membership flag OR legacy home org).
  if (target.is_primary || legacyOrgId === organisationId) {
    return {
      success: false,
      error: "This is the user's primary organisation. Set a different primary first, then remove.",
      code: "PRIMARY_ORG",
    };
  }

  // Deactivate the membership.
  const { error: updErr } = await admin
    .from("organization_memberships")
    .update({ is_active: false })
    .eq("id", target.id);
  if (updErr) {
    console.error("Failed to deactivate membership:", updErr);
    return { success: false, error: "Failed to remove user from organisation", code: "UPDATE_FAILED" };
  }

  // Strip their access-group assignments for this org (revokes effective rights).
  await updateUserAccessGroupsSvc(admin, userId, organisationId, []);
  updateTag(`user-modules:${userId}:${organisationId}`);
  updateTag(`access-profile:${userId}:${organisationId}`);

  return { success: true, data: { userId, organisationId } };
}
