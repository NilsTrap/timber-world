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
  AccessRightRow,
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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function createAccessGroup(input: {
  name: string;
  description?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const g = await requireSuperAdmin();
  if (!g.ok) return { success: false, error: g.error, code: g.code };
  const name = input.name.trim();
  if (!name) return { success: false, error: "Name is required", code: "VALIDATION_ERROR" };
  const key = slugify(name);
  if (!key) return { success: false, error: "Name must contain letters or digits", code: "VALIDATION_ERROR" };
  const { data, error } = await g.client
    .from("access_groups")
    .insert({ key, name, description: input.description ?? null, is_system: false, sort_order: 2000 })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505")
      return { success: false, error: "A group with this name already exists", code: "DUPLICATE" };
    return { success: false, error: "Failed to create group", code: "CREATE_FAILED" };
  }
  return { success: true, data: { id: data.id } };
}

export async function updateAccessGroup(
  groupId: string,
  input: { name?: string; description?: string | null },
): Promise<ActionResult<{ id: string }>> {
  const g = await requireSuperAdmin();
  if (!g.ok) return { success: false, error: g.error, code: g.code };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description;
  const { error } = await g.client.from("access_groups").update(patch).eq("id", groupId);
  if (error) return { success: false, error: "Failed to update group", code: "UPDATE_FAILED" };
  return { success: true, data: { id: groupId } };
}

export async function deleteAccessGroup(groupId: string): Promise<ActionResult<{ id: string }>> {
  const g = await requireSuperAdmin();
  if (!g.ok) return { success: false, error: g.error, code: g.code };
  const { data: group } = await g.client
    .from("access_groups")
    .select("is_system")
    .eq("id", groupId)
    .single();
  if (!group) return { success: false, error: "Group not found", code: "NOT_FOUND" };
  if (group.is_system)
    return { success: false, error: "System groups cannot be deleted (edit their rights instead)", code: "FORBIDDEN" };
  await bustGroupMembers(g.client, groupId);
  const { error } = await g.client.from("access_groups").delete().eq("id", groupId);
  if (error) return { success: false, error: "Failed to delete group", code: "DELETE_FAILED" };
  return { success: true, data: { id: groupId } };
}

/** Full-replace of a group's rights (the editor saves the whole matrix). */
export async function saveGroupRights(
  groupId: string,
  input: GroupRightsInput,
): Promise<ActionResult<{ id: string }>> {
  const g = await requireSuperAdmin();
  if (!g.ok) return { success: false, error: g.error, code: g.code };

  const rows: Array<Omit<AccessRightRow, "value"> & { value: unknown }> = [];
  for (const code of new Set(input.modules))
    rows.push({ rightType: "module", resource: "portal", key: code, value: {} });
  for (const key of new Set(input.dealVisibility))
    rows.push({ rightType: "visibility", resource: "deal", key, value: {} });
  for (const [domain, grant] of Object.entries(input.fieldDomains)) {
    if (!grant?.visible && !grant?.editable) continue;
    rows.push({ rightType: "visibility", resource: "deal_fields", key: domain, value: grant });
  }
  for (const [field, grant] of Object.entries(input.fieldOverrides))
    rows.push({ rightType: "field", resource: "deal", key: field, value: grant });
  rows.push({ rightType: "scope", resource: "deal", key: "deals", value: input.scope });
  for (const action of new Set(input.actions)) {
    const idx = action.indexOf(":");
    if (idx <= 0) continue;
    rows.push({
      rightType: "action",
      resource: action.slice(0, idx),
      key: action.slice(idx + 1),
      value: {},
    });
  }

  // Upsert-then-delete-stale (NOT delete-then-insert): a failed write must
  // never leave the group rights-less, which would instantly strip every
  // member of modules, deal-row visibility (RLS) and field grants. We upsert
  // the new matrix on the unique key first, then delete only rows no longer
  // present. Either failure leaves the OLD rights intact.
  const desired = rows.map((r) => ({
    group_id: groupId,
    right_type: r.rightType,
    resource: r.resource,
    key: r.key,
    value: r.value,
  }));

  if (desired.length > 0) {
    const { error: upError } = await g.client
      .from("access_group_rights")
      .upsert(desired, { onConflict: "group_id,right_type,resource,key" });
    if (upError) return { success: false, error: "Failed to save rights", code: "UPDATE_FAILED" };
  }

  // Delete stale rows: everything for this group NOT in the desired key set.
  const { data: current, error: readError } = await g.client
    .from("access_group_rights")
    .select("id, right_type, resource, key")
    .eq("group_id", groupId);
  if (readError) return { success: false, error: "Failed to save rights", code: "UPDATE_FAILED" };
  const keep = new Set(desired.map((r) => `${r.right_type}|${r.resource}|${r.key}`));
  const staleIds = ((current || []) as Array<{ id: string; right_type: string; resource: string; key: string }>)
    .filter((r) => !keep.has(`${r.right_type}|${r.resource}|${r.key}`))
    .map((r) => r.id);
  if (staleIds.length > 0) {
    const { error: delError } = await g.client
      .from("access_group_rights")
      .delete()
      .in("id", staleIds);
    if (delError) return { success: false, error: "Failed to save rights", code: "UPDATE_FAILED" };
  }

  // Bust member caches regardless of which branch ran (the write succeeded).
  await bustGroupMembers(g.client, groupId);
  return { success: true, data: { id: groupId } };
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
  const { error: delError } = await g.client
    .from("user_access_groups")
    .delete()
    .eq("user_id", userId)
    .eq("organization_id", organisationId);
  if (delError) return { success: false, error: "Failed to update groups", code: "UPDATE_FAILED" };
  const unique = Array.from(new Set(groupIds));
  if (unique.length > 0) {
    const { error: insError } = await g.client.from("user_access_groups").insert(
      unique.map((groupId) => ({
        user_id: userId,
        organization_id: organisationId,
        group_id: groupId,
      })),
    );
    if (insError) return { success: false, error: "Failed to update groups", code: "UPDATE_FAILED" };
  }
  updateTag(`user-modules:${userId}:${organisationId}`);
  updateTag(`access-profile:${userId}:${organisationId}`);
  return { success: true, data: { count: unique.length } };
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
    if (list.length === 0) return { success: false, error: "User has no active organisation membership", code: "NO_ORG" };
    if (list.length > 1) return { success: false, error: "User belongs to several organisations — assign the group from that user's People row instead", code: "MULTI_ORG" };
    orgId = (list.find((m) => m.is_primary) ?? list[0])!.organization_id;
  }
  return setUserGroupMembership(userId, orgId, groupId, true);
}

/** I2 · Users assignable as group members (super-admin picker). */
export async function listAssignableUsers(query?: string | null): Promise<ActionResult<PortalUserRow[]>> {
  const g = await requireSuperAdmin();
  if (!g.ok) return { success: false, error: g.error, code: g.code };
  return listPortalUsersSvc(g.client, { query, limit: 50 });
}
