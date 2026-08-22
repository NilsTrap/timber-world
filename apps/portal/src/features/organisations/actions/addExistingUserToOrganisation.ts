"use server";

import { updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/features/audit/logAudit";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import { attachPersonMembership, listAssignableGroups, setMembershipGroups } from "../services/personOnboarding";
import { sendPasswordlessInvite } from "../services/passwordlessInvite";
import { ADMIN_DENIED, requirePlatformAdmin } from "./_platformAdmin";

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
  groupIds: string[] = [],
  options: { makePrimary?: boolean; sendInvite?: boolean } = {},
): Promise<ActionResult<AttachedPersonResult>> {
  const guard = await requirePlatformAdmin();
  if (!guard.ok || !isValidUUID(userId) || !isValidUUID(organisationId)) return ADMIN_DENIED;
  if (!Array.isArray(groupIds) || groupIds.some((id) => !isValidUUID(id))) return ADMIN_DENIED;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const [{ data: user }, groupOptions] = await Promise.all([
    admin.from("portal_users").select("id").eq("id", userId).maybeSingle(),
    listAssignableGroups(admin, organisationId),
  ]);
  if (!user) return ADMIN_DENIED;
  const optionsById = new Map(groupOptions.map((g) => [g.id, g]));
  if (groupIds.some((id) => !optionsById.has(id) || optionsById.get(id)?.disabled)) {
    return { success: false, error: "Selected access is unavailable for this organisation", code: "ACCESS_ABOVE_ORG_CEILING" };
  }
  const attached = await attachPersonMembership(admin, {
    userId,
    organisationId,
    makePrimary: options.makePrimary === true,
    invitedBy: guard.session.portalUserId,
  });
  if (!attached.ok) {
    return attached.code === "ALREADY_MEMBER"
      ? { success: false, error: "User is already a member of this organisation", code: attached.code }
      : ADMIN_DENIED;
  }
  const groups = await setMembershipGroups(admin, userId, organisationId, groupIds);
  if (!groups.ok) return { success: false, error: "Membership added but access could not be assigned", code: groups.code };
  updateTag(`user-modules:${userId}:${organisationId}`);
  updateTag(`access-profile:${userId}:${organisationId}`);

  let inviteSent = false;
  let inviteError: string | null = null;
  if (options.sendInvite) {
    const invite = await sendPasswordlessInvite(admin, admin, userId, organisationId, guard.session.portalUserId);
    inviteSent = invite.ok;
    inviteError = invite.ok || invite.code === "ALREADY_ACTIVE" ? null : "Membership added; invitation email can be retried";
  }
  await logAudit({ action: "membership.attach", resourceType: "portal_user", resourceId: userId, organisationId, metadata: { makePrimary: options.makePrimary === true, groupCount: groupIds.length, inviteSent } });
  return { success: true, data: { userId, organisationId, inviteSent, inviteError } };
}
