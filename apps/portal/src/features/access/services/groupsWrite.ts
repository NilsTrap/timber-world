/**
 * E4/J3 · Access-group WRITE service — the `(db, …)` canonical source for group
 * CRUD, rights editing and per-org user↔group assignment. The twin of the READ
 * service `groupsRead.ts`; the session-bound `actions/groups.ts` delegates here
 * (one implementation, no logic duplication) and keeps the two things a service
 * cannot do: the `isSuperAdmin` session guard AND busting the affected
 * `user-modules:` / `access-profile:` next/cache tags.
 *
 * Cache note: these functions do NOT bust caches (no next/cache in a service).
 * The portal action busts after a successful write; the MCP route cannot, so an
 * MCP-driven permission change is DB-correct immediately but the portal serves
 * affected members' cached effective-permissions until those tags' next natural
 * revalidation (documented on the tools).
 */
import type { AccessRightRow, ActionResult, GroupRightsInput } from "../types";
import { getUserAccessGroups, type DbClient } from "./groupsRead";

export function slugifyGroupKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function createAccessGroup(
  db: DbClient,
  input: { name: string; description?: string | null },
): Promise<ActionResult<{ id: string }>> {
  const name = (input.name ?? "").trim();
  if (!name) return { success: false, error: "Name is required", code: "VALIDATION_ERROR" };
  const key = slugifyGroupKey(name);
  if (!key) return { success: false, error: "Name must contain letters or digits", code: "VALIDATION_ERROR" };
  const { data, error } = await db
    .from("access_groups")
    .insert({ key, name, description: input.description ?? null, is_system: false, sort_order: 2000 })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { success: false, error: "A group with this name already exists", code: "DUPLICATE" };
    return { success: false, error: "Failed to create group", code: "CREATE_FAILED" };
  }
  return { success: true, data: { id: data.id } };
}

export async function updateAccessGroup(
  db: DbClient,
  groupId: string,
  input: { name?: string; description?: string | null },
): Promise<ActionResult<{ id: string }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description;
  if (Object.keys(patch).length === 0) return { success: true, data: { id: groupId } };
  const { error } = await db.from("access_groups").update(patch).eq("id", groupId);
  if (error) return { success: false, error: "Failed to update group", code: "UPDATE_FAILED" };
  return { success: true, data: { id: groupId } };
}

/** Delete a non-system group. Members + rights cascade (ON DELETE CASCADE). The
 *  is_system guard is authoritative and travels with the code; the caller busts
 *  the (now-removed) members' caches BEFORE calling this (they're gone after). */
export async function deleteAccessGroup(db: DbClient, groupId: string): Promise<ActionResult<{ id: string }>> {
  const { data: group } = await db.from("access_groups").select("is_system").eq("id", groupId).single();
  if (!group) return { success: false, error: "Group not found", code: "NOT_FOUND" };
  if (group.is_system) return { success: false, error: "System groups cannot be deleted (edit their rights instead)", code: "FORBIDDEN" };
  const { error } = await db.from("access_groups").delete().eq("id", groupId);
  if (error) return { success: false, error: "Failed to delete group", code: "DELETE_FAILED" };
  return { success: true, data: { id: groupId } };
}

/**
 * Full-replace of a group's rights matrix (the editor saves the whole thing).
 * Upsert-then-delete-stale (NOT delete-then-insert): a failed write must never
 * leave the group rights-less, which would instantly strip every member of
 * modules, deal-row visibility (RLS) and field grants.
 */
export async function saveGroupRights(
  db: DbClient,
  groupId: string,
  input: GroupRightsInput,
): Promise<ActionResult<{ id: string }>> {
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
    rows.push({ rightType: "action", resource: action.slice(0, idx), key: action.slice(idx + 1), value: {} });
  }

  const desired = rows.map((r) => ({
    group_id: groupId,
    right_type: r.rightType,
    resource: r.resource,
    key: r.key,
    value: r.value,
  }));

  if (desired.length > 0) {
    const { error: upError } = await db
      .from("access_group_rights")
      .upsert(desired, { onConflict: "group_id,right_type,resource,key" });
    if (upError) return { success: false, error: "Failed to save rights", code: "UPDATE_FAILED" };
  }

  const { data: current, error: readError } = await db
    .from("access_group_rights")
    .select("id, right_type, resource, key")
    .eq("group_id", groupId);
  if (readError) return { success: false, error: "Failed to save rights", code: "UPDATE_FAILED" };
  const keep = new Set(desired.map((r) => `${r.right_type}|${r.resource}|${r.key}`));
  const staleIds = ((current || []) as Array<{ id: string; right_type: string; resource: string; key: string }>)
    .filter((r) => !keep.has(`${r.right_type}|${r.resource}|${r.key}`))
    .map((r) => r.id);
  if (staleIds.length > 0) {
    const { error: delError } = await db.from("access_group_rights").delete().in("id", staleIds);
    if (delError) return { success: false, error: "Failed to save rights", code: "UPDATE_FAILED" };
  }
  return { success: true, data: { id: groupId } };
}

/** Replace a user's group assignments in one org (delete-then-insert). */
export async function updateUserAccessGroups(
  db: DbClient,
  userId: string,
  organisationId: string,
  groupIds: string[],
): Promise<ActionResult<{ count: number }>> {
  const { error: delError } = await db
    .from("user_access_groups")
    .delete()
    .eq("user_id", userId)
    .eq("organization_id", organisationId);
  if (delError) return { success: false, error: "Failed to update groups", code: "UPDATE_FAILED" };
  const unique = Array.from(new Set(groupIds));
  if (unique.length > 0) {
    const { error: insError } = await db.from("user_access_groups").insert(
      unique.map((groupId) => ({ user_id: userId, organization_id: organisationId, group_id: groupId })),
    );
    if (insError) return { success: false, error: "Failed to update groups", code: "UPDATE_FAILED" };
  }
  return { success: true, data: { count: unique.length } };
}

/** Add/remove ONE user↔group membership in an org — round-trips the user's whole
 *  set via updateUserAccessGroups (a full-replace), so the two views stay in sync. */
export async function setUserGroupMembership(
  db: DbClient,
  userId: string,
  organisationId: string,
  groupId: string,
  member: boolean,
): Promise<ActionResult<{ count: number }>> {
  const current = await getUserAccessGroups(db, userId, organisationId);
  if (!current.success) return current as unknown as ActionResult<{ count: number }>;
  const assigned = new Set(current.data.filter((a) => a.assigned).map((a) => a.groupId));
  if (member) assigned.add(groupId); else assigned.delete(groupId);
  return updateUserAccessGroups(db, userId, organisationId, Array.from(assigned));
}
