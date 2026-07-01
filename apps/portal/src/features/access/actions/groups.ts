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
import type { DealScope, FieldGrant } from "@/lib/access/types";
import type {
  AccessGroupDetail,
  AccessGroupSummary,
  AccessRightRow,
  ActionResult,
  GroupRightsInput,
  UserGroupAssignment,
} from "../types";

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
  const [{ data: groups, error }, { data: members }] = await Promise.all([
    g.client
      .from("access_groups")
      .select("id, key, name, description, is_system, sort_order")
      .order("sort_order", { ascending: true }),
    g.client.from("user_access_groups").select("group_id"),
  ]);
  if (error) return { success: false, error: "Failed to load groups", code: "FETCH_FAILED" };
  const counts = new Map<string, number>();
  for (const m of (members || []) as Array<{ group_id: string }>) {
    counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1);
  }
  return {
    success: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: (groups || []).map((row: any) => ({
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description ?? null,
      isSystem: row.is_system === true,
      sortOrder: row.sort_order,
      memberCount: counts.get(row.id) ?? 0,
    })),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decomposeRights(rows: any[]): Omit<AccessGroupDetail, "id" | "key" | "name" | "description" | "isSystem"> {
  const modules: string[] = [];
  const dealVisibility: string[] = [];
  const fieldDomains: AccessGroupDetail["fieldDomains"] = {};
  const fieldOverrides: Record<string, FieldGrant> = {};
  const actions: string[] = [];
  let scope: DealScope = "company";
  for (const r of rows) {
    const grant = (): FieldGrant => {
      const v = (r.value ?? {}) as Record<string, unknown>;
      return { visible: v.visible !== false, editable: v.editable === true };
    };
    if (r.right_type === "module") modules.push(r.key);
    else if (r.right_type === "visibility" && r.resource === "deal") dealVisibility.push(r.key);
    else if (r.right_type === "visibility" && r.resource === "deal_fields")
      fieldDomains[r.key as keyof typeof fieldDomains] = grant();
    else if (r.right_type === "field") fieldOverrides[r.key] = grant();
    else if (r.right_type === "action") actions.push(`${r.resource}:${r.key}`);
    else if (r.right_type === "scope") {
      const v = typeof r.value === "string" ? r.value : null;
      if (v === "mine" || v === "company" || v === "all") scope = v;
    }
  }
  return { modules, dealVisibility, fieldDomains, fieldOverrides, scope, actions };
}

export async function getAccessGroupDetail(
  groupId: string,
): Promise<ActionResult<AccessGroupDetail>> {
  const g = await requireSuperAdmin();
  if (!g.ok) return { success: false, error: g.error, code: g.code };
  const [{ data: group, error }, { data: rights }] = await Promise.all([
    g.client
      .from("access_groups")
      .select("id, key, name, description, is_system")
      .eq("id", groupId)
      .single(),
    g.client
      .from("access_group_rights")
      .select("right_type, resource, key, value")
      .eq("group_id", groupId),
  ]);
  if (error || !group) return { success: false, error: "Group not found", code: "NOT_FOUND" };
  return {
    success: true,
    data: {
      id: group.id,
      key: group.key,
      name: group.name,
      description: group.description ?? null,
      isSystem: group.is_system === true,
      ...decomposeRights(rights || []),
    },
  };
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
  const [{ data: groups, error }, { data: assigned }] = await Promise.all([
    g.client
      .from("access_groups")
      .select("id, key, name, is_system, sort_order")
      .order("sort_order", { ascending: true }),
    g.client
      .from("user_access_groups")
      .select("group_id")
      .eq("user_id", userId)
      .eq("organization_id", organisationId),
  ]);
  if (error) return { success: false, error: "Failed to load groups", code: "FETCH_FAILED" };
  const assignedSet = new Set(
    ((assigned || []) as Array<{ group_id: string }>).map((r) => r.group_id),
  );
  return {
    success: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: (groups || []).map((row: any) => ({
      groupId: row.id,
      groupKey: row.key,
      groupName: row.name,
      isSystem: row.is_system === true,
      assigned: assignedSet.has(row.id),
    })),
  };
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
