"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import type { AddPersonContext, AddablePerson } from "../addPersonTypes";
import { listAssignableGroups } from "../services/personOnboarding";
import { ADMIN_DENIED, requirePlatformAdmin } from "./_platformAdmin";

export async function getAddPersonContext(organisationId: string): Promise<ActionResult<AddPersonContext>> {
  const guard = await requirePlatformAdmin();
  if (!guard.ok || !isValidUUID(organisationId)) return ADMIN_DENIED;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const [{ data: org }, groups] = await Promise.all([
    admin.from("organisations").select("name").eq("id", organisationId).eq("is_active", true).maybeSingle(),
    listAssignableGroups(admin, organisationId),
  ]);
  if (!org) return ADMIN_DENIED;
  return {
    success: true,
    data: {
      mode: "admin",
      orgName: org.name,
      groups,
      forcedGroupId: null,
      forcedGroupName: null,
    },
  };
}

export async function searchAddablePeople(
  organisationId: string,
  query: string,
): Promise<ActionResult<AddablePerson[]>> {
  const guard = await requirePlatformAdmin();
  if (!guard.ok || !isValidUUID(organisationId)) return ADMIN_DENIED;
  const q = query.replace(/[,()*\\]/g, " ").trim();
  if (q.length < 2) return { success: true, data: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: users, error } = await admin.from("portal_users")
    .select("id, email, name")
    .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
    .order("name")
    .limit(20);
  if (error) return { success: false, error: "Failed to search people", code: "FETCH_FAILED" };
  const ids = ((users ?? []) as Array<{ id: string }>).map((u) => u.id);
  const memberIds = new Set<string>();
  if (ids.length) {
    const { data: memberships } = await admin.from("organization_memberships")
      .select("user_id").eq("organization_id", organisationId).eq("is_active", true).in("user_id", ids);
    for (const row of (memberships ?? []) as Array<{ user_id: string }>) memberIds.add(row.user_id);
  }
  return {
    success: true,
    data: ((users ?? []) as Array<{ id: string; email: string; name: string }>).map((u) => ({ ...u, alreadyMember: memberIds.has(u.id) })),
  };
}
