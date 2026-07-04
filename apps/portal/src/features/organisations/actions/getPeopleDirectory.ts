"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

/**
 * K2 · Person-centric People directory reader.
 *
 * Returns every portal user ONCE, with the full set of organisations they belong
 * to (memberships + legacy home org, primary flagged) and their access groups per
 * org. Batched: one query per dimension (users, memberships, orgs, group
 * assignments, group names) then mapped in memory — no N+1.
 *
 * ADMIN-ONLY (isSuperAdmin): this is the only place that enumerates people across
 * ALL organisations, so an org-scoped non-admin must never reach it. Reads run on
 * the service-role client after the guard (the gate is the wall).
 */

export interface PersonOrgRef {
  id: string;
  name: string;
  code: string;
  isPrimary: boolean;
}

export interface PersonGroupRef {
  orgId: string;
  groupId: string;
  groupName: string;
}

export interface DirectoryPerson {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: "admin" | "user";
  isActive: boolean;
  status: "created" | "invited" | "active";
  lastLoginAt: string | null;
  authUserId: string | null;
  /** The org used for person-level credential/toggle ops (legacy home, else primary membership). */
  primaryOrgId: string | null;
  orgs: PersonOrgRef[];
  groups: PersonGroupRef[];
}

export async function getPeopleDirectory(): Promise<ActionResult<DirectoryPerson[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isSuperAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // One query per dimension — mapped in memory below (no per-user round-trips).
  const [usersRes, memsRes, orgsRes, uagRes] = await Promise.all([
    admin
      .from("portal_users")
      .select("id, email, name, phone, role, organisation_id, auth_user_id, is_active, status, last_login_at")
      .order("name", { ascending: true }),
    admin
      .from("organization_memberships")
      .select("user_id, organization_id, is_primary")
      .eq("is_active", true),
    admin.from("organisations").select("id, name, code"),
    admin.from("user_access_groups").select("user_id, group_id, organization_id"),
  ]);

  if (usersRes.error) {
    console.error("Failed to load people directory:", usersRes.error);
    return { success: false, error: "Failed to load people", code: "FETCH_FAILED" };
  }

  const users = (usersRes.data ?? []) as Array<{
    id: string; email: string; name: string; phone: string | null;
    role: "admin" | "user"; organisation_id: string | null; auth_user_id: string | null;
    is_active: boolean; status: "created" | "invited" | "active"; last_login_at: string | null;
  }>;
  const mems = (memsRes.data ?? []) as Array<{ user_id: string; organization_id: string; is_primary: boolean }>;
  const orgs = (orgsRes.data ?? []) as Array<{ id: string; name: string; code: string }>;
  const uag = (uagRes.data ?? []) as Array<{ user_id: string; group_id: string; organization_id: string }>;

  // Group-name lookup (one query for the referenced groups only).
  const groupIds = Array.from(new Set(uag.map((r) => r.group_id)));
  const groupNames = new Map<string, string>();
  if (groupIds.length) {
    const { data: groups } = await admin.from("access_groups").select("id, name").in("id", groupIds);
    for (const g of (groups ?? []) as Array<{ id: string; name: string }>) groupNames.set(g.id, g.name);
  }

  const orgMap = new Map<string, { name: string; code: string }>();
  for (const o of orgs) orgMap.set(o.id, { name: o.name, code: o.code });

  const memsByUser = new Map<string, Array<{ orgId: string; isPrimary: boolean }>>();
  for (const m of mems) {
    const list = memsByUser.get(m.user_id) ?? [];
    list.push({ orgId: m.organization_id, isPrimary: m.is_primary === true });
    memsByUser.set(m.user_id, list);
  }

  const groupsByUser = new Map<string, PersonGroupRef[]>();
  for (const r of uag) {
    const list = groupsByUser.get(r.user_id) ?? [];
    list.push({ orgId: r.organization_id, groupId: r.group_id, groupName: groupNames.get(r.group_id) ?? "?" });
    groupsByUser.set(r.user_id, list);
  }

  const people: DirectoryPerson[] = users.map((u) => {
    const legacy = u.organisation_id && orgMap.has(u.organisation_id) ? u.organisation_id : null;

    // Distinct orgs: legacy home first, then memberships (dedup).
    const orgRefs: PersonOrgRef[] = [];
    const seen = new Set<string>();
    if (legacy) {
      orgRefs.push({ id: legacy, ...orgMap.get(legacy)!, isPrimary: false });
      seen.add(legacy);
    }
    for (const m of memsByUser.get(u.id) ?? []) {
      if (seen.has(m.orgId) || !orgMap.has(m.orgId)) continue;
      orgRefs.push({ id: m.orgId, ...orgMap.get(m.orgId)!, isPrimary: false });
      seen.add(m.orgId);
    }

    // Primary org: legacy home wins; else the primary membership; else the first org.
    let primaryOrgId: string | null = legacy;
    if (!primaryOrgId) {
      const primMem = (memsByUser.get(u.id) ?? []).find((m) => m.isPrimary && orgMap.has(m.orgId));
      primaryOrgId = primMem?.orgId ?? orgRefs[0]?.id ?? null;
    }
    for (const r of orgRefs) r.isPrimary = r.id === primaryOrgId;

    return {
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone ?? null,
      role: u.role,
      isActive: u.is_active,
      status: u.status,
      lastLoginAt: u.last_login_at,
      authUserId: u.auth_user_id ?? null,
      primaryOrgId,
      orgs: orgRefs,
      groups: groupsByUser.get(u.id) ?? [],
    };
  });

  return { success: true, data: people };
}
