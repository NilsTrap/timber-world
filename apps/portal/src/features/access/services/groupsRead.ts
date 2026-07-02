/**
 * E7 · Access-group READ service — the `db`-based canonical source for reading
 * groups, group detail (decomposed rights), a user's group assignments, and the
 * portal user directory.
 *
 * WHY a service (not just the actions): the E4 group actions in
 * `../actions/groups.ts` are `"use server"`, session-bound (getSession +
 * isSuperAdmin) and cache-aware (next/cache) — none of which the MCP surface
 * has. E7 exposes group reads to the Oscar/Vilma agent, and the rule is "the
 * MCP calls the SAME services as the portal". So the read logic lives here,
 * taking `(db, …)`; `db` = caller-chosen Supabase client (the session user
 * client for the portal action after its admin guard, the admin client for the
 * MCP service identity). Permission is the caller's job — the portal action
 * still guards with isSuperAdmin; the MCP route only exposes these on a
 * full-access token and runs as the trusted service identity.
 *
 * Writes stay in the session/cache-bound actions (they must bust member caches
 * via next/cache) — deferred from the MCP surface per the E7 steer.
 */
import type { DealScope, FieldGrant } from "@/lib/access/types";
import type {
  AccessGroupDetail,
  AccessGroupSummary,
  ActionResult,
  UserGroupAssignment,
} from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbClient = any;

/** A row from the portal user directory (id + card fields, no secrets). */
export interface PortalUserRow {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Decompose the flat `access_group_rights` rows into the editor-shaped detail.
 * Shared by the portal group editor (via the action) and the MCP read tool so
 * the two never drift.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decomposeGroupRights(rows: any[]): Omit<AccessGroupDetail, "id" | "key" | "name" | "description" | "isSystem"> {
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

/** List every access group + its member count, ordered as in the editor. */
export async function listAccessGroups(db: DbClient): Promise<ActionResult<AccessGroupSummary[]>> {
  const [{ data: groups, error }, { data: members }] = await Promise.all([
    db
      .from("access_groups")
      .select("id, key, name, description, is_system, sort_order")
      .order("sort_order", { ascending: true }),
    db.from("user_access_groups").select("group_id"),
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

/** One group with its decomposed rights (modules, deal visibility, field grants, scope, actions). */
export async function getAccessGroupDetail(db: DbClient, groupId: string): Promise<ActionResult<AccessGroupDetail>> {
  const [{ data: group, error }, { data: rights }] = await Promise.all([
    db.from("access_groups").select("id, key, name, description, is_system").eq("id", groupId).maybeSingle(),
    db.from("access_group_rights").select("right_type, resource, key, value").eq("group_id", groupId),
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
      ...decomposeGroupRights(rights || []),
    },
  };
}

/** Every group + whether it is assigned to this user in this org. */
export async function getUserAccessGroups(
  db: DbClient,
  userId: string,
  organisationId: string,
): Promise<ActionResult<UserGroupAssignment[]>> {
  const [{ data: groups, error }, { data: assigned }] = await Promise.all([
    db.from("access_groups").select("id, key, name, is_system, sort_order").order("sort_order", { ascending: true }),
    db
      .from("user_access_groups")
      .select("group_id")
      .eq("user_id", userId)
      .eq("organization_id", organisationId),
  ]);
  if (error) return { success: false, error: "Failed to load groups", code: "FETCH_FAILED" };
  const assignedSet = new Set(((assigned || []) as Array<{ group_id: string }>).map((r) => r.group_id));
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

/**
 * List portal users (directory card only — id, email, name, role). Optional
 * substring query on name/email and an optional org filter (active memberships).
 * Lets the agent resolve a user id before reading that user's group assignments.
 */
export async function listPortalUsers(
  db: DbClient,
  opts: { query?: string | null; orgId?: string | null; limit?: number | null } = {},
): Promise<ActionResult<PortalUserRow[]>> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 200);

  // Optional org scope: restrict to the active members of one organisation.
  let allowedIds: Set<string> | null = null;
  if (opts.orgId) {
    const { data: mem, error: memErr } = await db
      .from("organization_memberships")
      .select("user_id")
      .eq("organization_id", opts.orgId)
      .eq("is_active", true);
    if (memErr) return { success: false, error: "Failed to load memberships", code: "FETCH_FAILED" };
    allowedIds = new Set(((mem || []) as Array<{ user_id: string }>).map((m) => m.user_id));
    if (allowedIds.size === 0) return { success: true, data: [] };
  }

  let q = db.from("portal_users").select("id, email, name, role").order("name", { ascending: true });
  // Strip PostgREST reserved chars before interpolating into the .or() filter
  // (the read-only MCP token can reach this via timber_list_users — don't let a
  // query inject filter grammar; mirrors listOrgs in orgService.ts).
  const safe = (opts.query ?? "").replace(/[,()*\\]/g, " ").trim();
  if (safe) {
    const like = `%${safe}%`;
    q = q.or(`name.ilike.${like},email.ilike.${like}`);
  }
  if (allowedIds) q = q.in("id", Array.from(allowedIds));
  q = q.limit(limit);

  const { data, error } = await q;
  if (error) return { success: false, error: "Failed to load users", code: "FETCH_FAILED" };
  return {
    success: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: (data || []).map((r: any) => ({ id: r.id, email: r.email, name: r.name, role: r.role })),
  };
}
