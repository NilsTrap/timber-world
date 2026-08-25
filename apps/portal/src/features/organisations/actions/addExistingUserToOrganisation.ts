"use server";

import { updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/features/audit/logAudit";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import { getOrganisationRoleGroup, setMembershipActive, setMembershipGroups } from "../services/personOnboarding";
import { sendPasswordlessInvite } from "../services/passwordlessInvite";
import { ADMIN_DENIED, requirePlatformAdmin } from "./_platformAdmin";
import { requirePersonOnboardingAccess } from "./_personOnboardingAccess";

export interface ExistingUserInfo {
  id: string;
  email: string;
  name: string;
  currentOrganisations: Array<{ id: string; code: string; name: string }>;
}

export async function searchUserByEmail(email: string): Promise<ActionResult<ExistingUserInfo | null>> {
  const guard = await requirePlatformAdmin();
  if (!guard.ok) return ADMIN_DENIED;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return { success: true, data: null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: user } = await admin.from("portal_users").select("id, email, name").eq("email", normalizedEmail).maybeSingle();
  if (!user) return { success: true, data: null };
  const { data: memberships } = await admin.from("organization_memberships")
    .select("organization_id, organisation:organisations(id, code, name)")
    .eq("user_id", user.id).eq("is_active", true);
  return {
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      currentOrganisations: ((memberships ?? []) as Array<{ organisation: { id: string; code: string; name: string } | null }>).flatMap((m) => m.organisation ? [m.organisation] : []),
    },
  };
}

export interface AttachedPersonResult {
  userId: string;
  organisationId: string;
  inviteSent: boolean;
  inviteError: string | null;
}

export async function addExistingUserToOrganisation(
  userId: string,
  organisationId: string,
): Promise<ActionResult<AttachedPersonResult>> {
  if (!isValidUUID(userId) || !isValidUUID(organisationId)) return ADMIN_DENIED;
  const guard = await requirePersonOnboardingAccess(organisationId);
  if (!guard.ok) return ADMIN_DENIED;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const [{ data: user }, { data: memberships }, role] = await Promise.all([
    admin.from("portal_users").select("id, is_active, status").eq("id", userId).maybeSingle(),
    admin.from("organization_memberships").select("organization_id, is_active").eq("user_id", userId),
    getOrganisationRoleGroup(admin, organisationId),
  ]);
  if (!user || !role.ok) return ADMIN_DENIED;
  const membershipRows = (memberships ?? []) as Array<{ organization_id: string; is_active: boolean }>;
  const targetMembership = membershipRows.find((m) => m.organization_id === organisationId);
  if (!targetMembership || membershipRows.some((m) => m.organization_id !== organisationId && m.is_active)) {
    return { success: false, error: "This person cannot be added to this company", code: "EMAIL_UNAVAILABLE" };
  }

  if (user.status === "active" && user.is_active === true && targetMembership.is_active) {
    return { success: false, error: "This person already has active access", code: "ALREADY_ACTIVE" };
  }
  if (!targetMembership.is_active) {
    const reactivated = await setMembershipActive(admin, userId, organisationId, true);
    if (!reactivated.ok) return ADMIN_DENIED;
  }
  if (user.is_active !== true) {
    const { error } = await admin.from("portal_users").update({ is_active: true, updated_at: new Date().toISOString() }).eq("id", userId);
    if (error) return { success: false, error: "Could not reactivate this person", code: "UPDATE_FAILED" };
  }

  const groups = await setMembershipGroups(admin, userId, organisationId, [role.group.id]);
  if (!groups.ok) return { success: false, error: "Access could not be assigned", code: groups.code };
  updateTag(`user-modules:${userId}:${organisationId}`);
  updateTag(`access-profile:${userId}:${organisationId}`);

  const invite = user.status === "active"
    ? null
    : await sendPasswordlessInvite(admin, admin, userId, organisationId, guard.session.portalUserId);
  const inviteSent = invite?.ok === true;
  const inviteError = invite === null || invite.ok ? null : "Access restored; invitation email can be retried";
  await logAudit({ action: "portal_user.reinvite", resourceType: "portal_user", resourceId: userId, organisationId, metadata: { inheritedRole: role.group.key, inviteSent } });
  return { success: true, data: { userId, organisationId, inviteSent, inviteError } };
}
