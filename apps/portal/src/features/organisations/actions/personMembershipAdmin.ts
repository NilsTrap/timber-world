"use server";

import { updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/features/audit/logAudit";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import {
  listAssignableGroups,
  setMembershipActive as setMembershipActiveSvc,
  setMembershipGroups as setMembershipGroupsSvc,
  setPrimaryMembership as setPrimaryMembershipSvc,
  type OnboardingGroupOption,
} from "../services/personOnboarding";
import { ADMIN_DENIED, requirePlatformAdmin } from "./_platformAdmin";

function validPair(userId: string, organisationId: string): boolean {
  return isValidUUID(userId) && isValidUUID(organisationId);
}

export async function getMembershipGroupOptions(
  userId: string,
  organisationId: string,
): Promise<ActionResult<Array<OnboardingGroupOption & { assigned: boolean }>>> {
  const guard = await requirePlatformAdmin();
  if (!guard.ok || !validPair(userId, organisationId)) return ADMIN_DENIED;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: membership } = await admin.from("organization_memberships").select("id").eq("user_id", userId).eq("organization_id", organisationId).eq("is_active", true).maybeSingle();
  if (!membership) return ADMIN_DENIED;
  const [groups, assignedRes] = await Promise.all([
    listAssignableGroups(admin, organisationId),
    admin.from("user_access_groups").select("group_id").eq("user_id", userId).eq("organization_id", organisationId),
  ]);
  const assigned = new Set(((assignedRes.data ?? []) as Array<{ group_id: string }>).map((r) => r.group_id));
  return { success: true, data: groups.map((g) => ({ ...g, assigned: assigned.has(g.id) })) };
}

export async function updateMembershipGroups(
  userId: string,
  organisationId: string,
  groupIds: string[],
): Promise<ActionResult<{ count: number }>> {
  const guard = await requirePlatformAdmin();
  if (!guard.ok || !validPair(userId, organisationId) || !Array.isArray(groupIds) || groupIds.some((id) => !isValidUUID(id))) return ADMIN_DENIED;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const result = await setMembershipGroupsSvc(admin, userId, organisationId, groupIds);
  if (!result.ok) return { success: false, error: result.code === "ACCESS_ABOVE_ORG_CEILING" ? "Selected access is unavailable for this organisation" : "Permission denied", code: result.code };
  updateTag(`user-modules:${userId}:${organisationId}`);
  updateTag(`access-profile:${userId}:${organisationId}`);
  await logAudit({ action: "membership.set_access", resourceType: "portal_user", resourceId: userId, organisationId, metadata: { groupCount: result.count } });
  return { success: true, data: { count: result.count } };
}

export async function setPrimaryMembership(
  userId: string,
  organisationId: string,
): Promise<ActionResult<{ userId: string; organisationId: string }>> {
  const guard = await requirePlatformAdmin();
  if (!guard.ok || !validPair(userId, organisationId)) return ADMIN_DENIED;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const result = await setPrimaryMembershipSvc(admin, userId, organisationId);
  if (!result.ok) return ADMIN_DENIED;
  await logAudit({ action: "membership.set_primary", resourceType: "portal_user", resourceId: userId, organisationId });
  return { success: true, data: { userId, organisationId } };
}

export async function setMembershipActive(
  userId: string,
  organisationId: string,
  isActive: boolean,
): Promise<ActionResult<{ userId: string; organisationId: string; isActive: boolean }>> {
  const guard = await requirePlatformAdmin();
  if (!guard.ok || !validPair(userId, organisationId) || typeof isActive !== "boolean") return ADMIN_DENIED;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const result = await setMembershipActiveSvc(admin, userId, organisationId, isActive);
  if (!result.ok) {
    if (result.code === "PRIMARY_OR_ONLY_MEMBERSHIP") return { success: false, error: "Choose another primary organisation before deactivating this membership", code: result.code };
    return ADMIN_DENIED;
  }
  updateTag(`user-modules:${userId}:${organisationId}`);
  updateTag(`access-profile:${userId}:${organisationId}`);
  await logAudit({ action: isActive ? "membership.activate" : "membership.deactivate", resourceType: "portal_user", resourceId: userId, organisationId });
  return { success: true, data: { userId, organisationId, isActive } };
}
