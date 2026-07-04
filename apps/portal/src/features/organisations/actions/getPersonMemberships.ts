"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, isSuperAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";

/**
 * K2 · Org memberships of ONE person, with their access groups per org — drives
 * the person-detail "Organisations" section. Admin-only (isSuperAdmin); reads on
 * the service-role client after the guard.
 *
 * The legacy home org (portal_users.organisation_id) is included and flagged
 * primary (matching removeUserFromOrganisation's primary semantics); otherwise
 * the primary membership, else the first org, is primary.
 */

export interface PersonMembership {
  orgId: string;
  orgName: string;
  orgCode: string;
  isPrimary: boolean;
  groups: { groupId: string; groupName: string }[];
}

export async function getPersonMemberships(
  personId: string,
): Promise<ActionResult<PersonMembership[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isSuperAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  if (!isValidUUID(personId)) return { success: false, error: "Invalid person ID", code: "INVALID_ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const [{ data: pu }, { data: memsData }, { data: uag }] = await Promise.all([
    admin.from("portal_users").select("organisation_id").eq("id", personId).maybeSingle(),
    admin
      .from("organization_memberships")
      .select("organization_id, is_primary")
      .eq("user_id", personId)
      .eq("is_active", true),
    admin.from("user_access_groups").select("group_id, organization_id").eq("user_id", personId),
  ]);

  const legacy = (pu?.organisation_id as string | null) ?? null;
  const mems = (memsData ?? []) as Array<{ organization_id: string; is_primary: boolean }>;
  const assignments = (uag ?? []) as Array<{ group_id: string; organization_id: string }>;

  // Distinct org ids (legacy + memberships).
  const orgIds: string[] = [];
  const seen = new Set<string>();
  if (legacy) { orgIds.push(legacy); seen.add(legacy); }
  for (const m of mems) if (!seen.has(m.organization_id)) { orgIds.push(m.organization_id); seen.add(m.organization_id); }

  if (orgIds.length === 0) return { success: true, data: [] };

  // Org names + group names in two batched reads.
  const groupIds = Array.from(new Set(assignments.map((a) => a.group_id)));
  const [{ data: orgs }, groupsRes] = await Promise.all([
    admin.from("organisations").select("id, name, code").in("id", orgIds),
    groupIds.length
      ? admin.from("access_groups").select("id, name").in("id", groupIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);
  const orgMap = new Map<string, { name: string; code: string }>();
  for (const o of (orgs ?? []) as Array<{ id: string; name: string; code: string }>) orgMap.set(o.id, { name: o.name, code: o.code });
  const groupNames = new Map<string, string>();
  for (const g of (groupsRes.data ?? []) as Array<{ id: string; name: string }>) groupNames.set(g.id, g.name);

  const groupsByOrg = new Map<string, { groupId: string; groupName: string }[]>();
  for (const a of assignments) {
    const list = groupsByOrg.get(a.organization_id) ?? [];
    list.push({ groupId: a.group_id, groupName: groupNames.get(a.group_id) ?? "?" });
    groupsByOrg.set(a.organization_id, list);
  }

  // Primary: legacy wins; else primary membership; else first.
  let primaryOrgId: string | null = legacy;
  if (!primaryOrgId) {
    primaryOrgId = mems.find((m) => m.is_primary)?.organization_id ?? orgIds[0] ?? null;
  }

  const data: PersonMembership[] = orgIds.map((id) => ({
    orgId: id,
    orgName: orgMap.get(id)?.name ?? "Unknown",
    orgCode: orgMap.get(id)?.code ?? "-",
    isPrimary: id === primaryOrgId,
    groups: groupsByOrg.get(id) ?? [],
  }));

  return { success: true, data };
}

export interface AddableOrg {
  id: string;
  name: string;
  code: string;
}

/**
 * K2 · Active organisations the person is NOT already in — the "Add to
 * organisation" picker on the person detail. Admin-only.
 */
export async function getAddableOrganisationsForPerson(
  personId: string,
): Promise<ActionResult<AddableOrg[]>> {
  const session = await getSession();
  if (!session) return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  if (!isSuperAdmin(session)) return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  if (!isValidUUID(personId)) return { success: false, error: "Invalid person ID", code: "INVALID_ID" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const [{ data: pu }, { data: memsData }, { data: orgs, error: orgErr }] = await Promise.all([
    admin.from("portal_users").select("organisation_id").eq("id", personId).maybeSingle(),
    admin.from("organization_memberships").select("organization_id").eq("user_id", personId).eq("is_active", true),
    admin.from("organisations").select("id, name, code").eq("is_active", true).order("name", { ascending: true }),
  ]);
  if (orgErr) return { success: false, error: "Failed to load organisations", code: "FETCH_FAILED" };

  const current = new Set<string>();
  const legacy = (pu?.organisation_id as string | null) ?? null;
  if (legacy) current.add(legacy);
  for (const m of (memsData ?? []) as Array<{ organization_id: string }>) current.add(m.organization_id);

  const data: AddableOrg[] = ((orgs ?? []) as Array<{ id: string; name: string; code: string }>)
    .filter((o) => !current.has(o.id))
    .map((o) => ({ id: o.id, name: o.name, code: o.code }));

  return { success: true, data };
}
