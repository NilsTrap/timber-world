"use server";

/**
 * E4 · Access-group admin actions — groups CRUD, rights editing, per-org
 * user assignment. Replaces the per-user module toggles (UserModulesDialog)
 * as the thing that grants access; OrganisationModulesTab (the org ceiling)
 * stays.
 *
 * Guard = isSuperAdmin (same as the module-admin actions this replaces);
 * writes run on the user client so the platform-admin RLS applies too.
 * Every mutation busts the affected `user-modules:` + `access-profile:`
 * cache tags so changes take effect without a deploy (DoD).
 */

import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type {
  AccessGroupDetail,
  AccessGroupSummary,
  ActionResult,
  GroupRightsInput,
  UserGroupAssignment,
} from "../types";
import {
  getAccessGroupDetail as getAccessGroupDetailSvc,
  getUserAccessGroups as getUserAccessGroupsSvc,
  listAccessGroups as listAccessGroupsSvc,
  listPortalUsers as listPortalUsersSvc,
  type PortalUserRow,
} from "../services/groupsRead";
import {
  createAccessGroup as createAccessGroupSvc,
  updateAccessGroup as updateAccessGroupSvc,
  deleteAccessGroup as deleteAccessGroupSvc,
  saveGroupRights as saveGroupRightsSvc,
  updateUserAccessGroups as updateUserAccessGroupsSvc,
} from "../services/groupsWrite";
import { logAudit } from "@/features/audit/logAudit";

async function requireSuperAdmin(): Promise<
  { ok: true; client: any } | { ok: false; error: string; code: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isSuperAdmin(session)) return { ok: false, error: "Permission denied", code: "FORBIDDEN" };
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { ok: true, client: supabase as any };
}

/** Bust the module/profile caches of every member of a group. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function bustGroupMembers(client: any, groupId: string): Promise<void> {
  const { data } = await client
    .from("user_access_groups")
    .select("user_id, organization_id")
    .eq("group_id", groupId);
  for (const row of (data || []) as Array<{ user_id: string; organization_id: string }>) {
    updateTag(`user-modules:${row.user_id}:${row.organization_id}`);
    updateTag(`access-profile:${row.user_id}:${row.organization_id}`);
  }
}

/** The module registry (for the group editor's module-toggle list). */
export async function listPortalModules(): Promise<
  ActionResult<Array<{ code: string; name: string; category: string | null }>>
> {
  const g = await requireSuperAdmin();
  if (!g.ok) return { success: false, error: g.error, code: g.code };
  const { data, error } = await g.client
    .from("modules")
    .select("code, name, category, sort_order")
    .order("sort_order", { ascending: true });
  if (error) return { success: false, error: "Failed to load modules", code: "FETCH_FAILED" };
  return {
    success: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: (data || []).map((row: any) => ({
      code: row.code,
      name: row.name,
      category: row.category ?? null,
    })),
  };
}

export async function listAccessGroups(): Promise<ActionResult<AccessGroupSummary[]>> {
  const g = await requireSuperAdmin();
  if (!g.ok) return { success: false, error: g.error, code: g.code };
  // Delegate to the shared read service (same source the MCP surface calls).
  return listAccessGroupsSvc(g.client);
}

export async function getAccessGroupDetail(
  groupId: string,
): Promise<ActionResult<AccessGroupDetail>> {
  const g = await requireSuperAdmin();
  if (!g.ok) return { success: false, error: g.error, code: g.code };
  return getAccessGroupDetailSvc(g.client, groupId);
}

export async function createAccessGroup(input: {
  name: string;
  description?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const g = await requireSuperAdmin();
  if (!g.ok) return { success: false, error: g.error, code: g.code };
  // Delegate to the shared write service (same source the MCP surface calls).
  const res = await createAccessGroupSvc(g.client, input);
  if (res.success) {
    await logAudit({
      action: "access_group.create",
      resourceType: "access_group",
      resourceId: res.data.id,
      metadata: { name: input.name },
    });
  }
  return res;
}

export async function updateAccessGroup(
  groupId: string,
  input: { name?: string; description?: string | null },
): Promise<ActionResult<{ id: string }>> {
  const g = await requireSuperAdmin();
  if (!g.ok) return { success: false, error: g.error, code: g.code };
  const res = await updateAccessGroupSvc(g.client, groupId, input);
  if (res.success) {
    await logAudit({
      action: "access_group.update",
      resourceType: "access_group",
      resourceId: groupId,
      metadata: { fields: Object.keys(input) },
    });
  }
  return res;
}

export async function deleteAccessGroup(groupId: string): Promise<ActionResult<{ id: string }>> {
  const g = await requireSuperAdmin();
  if (!g.ok) return { success: false, error: g.error, code: g.code };
  // Bust members' caches BEFORE the cascade removes them (harmless if the delete
  // is then refused for a system group — that just recomputes to identical values).
  await bustGroupMembers(g.client, groupId);
  const res = await deleteAccessGroupSvc(g.client, groupId);
  if (res.success) {
    await logAudit({
      action: "access_group.delete",
      resourceType: "access_group",
      resourceId: groupId,
    });
  }
  return res;
}

/** Full-replace of a group's rights (the editor saves the whole matrix). */
export async function saveGroupRights(
  groupId: string,
  input: GroupRightsInput,
): Promise<ActionResult<{ id: string }>> {
  const g = await requireSuperAdmin();
  if (!g.ok) return { success: false, error: g.error, code: g.code };
  const res = await saveGroupRightsSvc(g.client, groupId, input);
  // Bust member caches on success (rights changed → effective permissions changed).
  if (res.success) {
    await bustGroupMembers(g.client, groupId);
    await logAudit({
      action: "access_group.save_rights",
      resourceType: "access_group",
      resourceId: groupId,
      metadata: {
        modules: input.modules?.length ?? 0,
        actions: input.actions?.length ?? 0,
        scope: input.scope,
      },
    });
  }
  return res;
}

/** All groups + which are assigned to this user in this org (for the dialog). */
export async function getUserAccessGroups(
  userId: string,
  organisationId: string,
): Promise<ActionResult<UserGroupAssignment[]>> {
  const g = await requireSuperAdmin();
  if (!g.ok) return { success: false, error: g.error, code: g.code };
  return getUserAccessGroupsSvc(g.client, userId, organisationId);
}

/** Replace a user's group assignments in one org (delete-then-insert). */
export async function updateUserAccessGroups(
  userId: string,
  organisationId: string,
  groupIds: string[],
): Promise<ActionResult<{ count: number }>> {
  const g = await requireSuperAdmin();
  if (!g.ok) return { success: false, error: g.error, code: g.code };
  const res = await updateUserAccessGroupsSvc(g.client, userId, organisationId, groupIds);
  if (res.success) {
    updateTag(`user-modules:${userId}:${organisationId}`);
    updateTag(`access-profile:${userId}:${organisationId}`);
    await logAudit({
      action: "user.set_access_groups",
      resourceType: "portal_user",
      resourceId: userId,
      organisationId,
      metadata: { groupCount: groupIds.length },
    });
  }
  return res;
}

// ── I2 · discoverable group assignment (People chips + group Members tab) ──────

/** I2 · Assigned group names for EVERY user in one org — drives the People tab's
 *  "Access groups" chips column in one batch (not N per-user calls). */
export async function getOrgUsersGroups(
  organisationId: string,
): Promise<ActionResult<Record<string, { groupId: string; groupName: string }[]>>> {
  const g = await requireSuperAdmin();
  if (!g.ok) return { success: false, error: g.error, code: g.code };
  const { data: rows, error } = await g.client
    .from("user_access_groups")
    .select("user_id, group_id")
    .eq("organization_id", organisationId);
  if (error) return { success: false, error: "Failed to load group assignments", code: "FETCH_FAILED" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = (rows ?? []) as Array<{ user_id: string; group_id: string }>;
  const groupIds = Array.from(new Set(list.map((r) => r.group_id)));
  const names = new Map<string, string>();
  if (groupIds.length) {
    const { data: groups } = await g.client.from("access_groups").select("id, name").in("id", groupIds);
    for (const gr of (groups ?? []) as Array<{ id: string; name: string }>) names.set(gr.id, gr.name);
  }
  const out: Record<string, { groupId: string; groupName: string }[]> = {};
  for (const r of list) (out[r.user_id] ??= []).push({ groupId: r.group_id, groupName: names.get(r.group_id) ?? "?" });
  return { success: true, data: out };
}

export interface GroupMember { userId: string; organisationId: string; userName: string; orgName: string }

/** I2 · Members (user + org) of one access group — for the group-detail Members tab. */
export async function getGroupMembers(groupId: string): Promise<ActionResult<GroupMember[]>> {
  const g = await requireSuperAdmin();
  if (!g.ok) return { success: false, error: g.error, code: g.code };
  const { data: rows, error } = await g.client
    .from("user_access_groups")
    .select("user_id, organization_id")
    .eq("group_id", groupId);
  if (error) return { success: false, error: "Failed to load members", code: "FETCH_FAILED" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = (rows ?? []) as Array<{ user_id: string; organization_id: string }>;
  const userIds = Array.from(new Set(list.map((r) => r.user_id)));
  const orgIds = Array.from(new Set(list.map((r) => r.organization_id)));
  const uName = new Map<string, string>();
  const oName = new Map<string, string>();
  if (userIds.length) {
    const { data } = await g.client.from("portal_users").select("id, name").in("id", userIds);
    for (const u of (data ?? []) as Array<{ id: string; name: string }>) uName.set(u.id, u.name);
  }
  if (orgIds.length) {
    const { data } = await g.client.from("organisations").select("id, name").in("id", orgIds);
    for (const o of (data ?? []) as Array<{ id: string; name: string }>) oName.set(o.id, o.name);
  }
  return {
    success: true,
    data: list.map((r) => ({ userId: r.user_id, organisationId: r.organization_id, userName: uName.get(r.user_id) ?? "?", orgName: oName.get(r.organization_id) ?? "?" })),
  };
}

/** I2 · Add/remove ONE user↔group membership in an org. updateUserAccessGroups is
 *  a full-replace, so a single-row edit round-trips the user's whole set. Both the
 *  People row and the group Members tab write through here → the two views agree. */
export async function setUserGroupMembership(
  userId: string,
  organisationId: string,
  groupId: string,
  member: boolean,
): Promise<ActionResult<{ count: number }>> {
  const current = await getUserAccessGroups(userId, organisationId);
  if (!current.success) return current as unknown as ActionResult<{ count: number }>;
  const assigned = new Set(current.data.filter((a) => a.assigned).map((a) => a.groupId));
  if (member) assigned.add(groupId); else assigned.delete(groupId);
  return updateUserAccessGroups(userId, organisationId, Array.from(assigned));
}

/** I2 · Add a user to a group from the GROUP side. A group membership is per-org;
 *  the picker only knows the user, so we resolve their (single active) org. If the
 *  user belongs to several orgs, the caller must pass which one (organisationId). */
export async function addUserToGroup(
  userId: string,
  groupId: string,
  organisationId?: string | null,
): Promise<ActionResult<{ count: number }>> {
  const g = await requireSuperAdmin();
  if (!g.ok) return { success: false, error: g.error, code: g.code };
  let orgId = organisationId ?? null;
  if (!orgId) {
    const { data: mems } = await g.client
      .from("organization_memberships")
      .select("organization_id, is_primary")
      .eq("user_id", userId)
      .eq("is_active", true);
    const list = (mems ?? []) as Array<{ organization_id: string; is_primary: boolean }>;
    if (list.length > 1) return { success: false, error: "User belongs to several organisations — assign the group from that user's People row instead", code: "MULTI_ORG" };
    if (list.length === 1) {
      orgId = list[0]!.organization_id;
    } else {
      // No membership row — fall back to the user's home org (portal_users.organisation_id).
      // Some users are linked to their org this way rather than via organization_memberships.
      const { data: pu } = await g.client
        .from("portal_users")
        .select("organisation_id")
        .eq("id", userId)
        .maybeSingle();
      orgId = (pu?.organisation_id as string | null) ?? null;
      if (!orgId) return { success: false, error: "User has no organisation — cannot assign a group", code: "NO_ORG" };
    }
  }
  return setUserGroupMembership(userId, orgId, groupId, true);
}

/** I2 · Users assignable as group members (super-admin picker). */
export async function listAssignableUsers(query?: string | null): Promise<ActionResult<PortalUserRow[]>> {
  const g = await requireSuperAdmin();
  if (!g.ok) return { success: false, error: g.error, code: g.code };
  return listPortalUsersSvc(g.client, { query, limit: 50 });
}
