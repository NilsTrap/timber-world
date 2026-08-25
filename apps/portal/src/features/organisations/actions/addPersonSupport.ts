"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import type { AddPersonContext, AddablePerson } from "../addPersonTypes";
import { getOrganisationRoleGroup } from "../services/personOnboarding";
import { ADMIN_DENIED } from "./_platformAdmin";
import { requirePersonOnboardingAccess } from "./_personOnboardingAccess";

export async function getAddPersonContext(organisationId: string): Promise<ActionResult<AddPersonContext>> {
  if (!isValidUUID(organisationId)) return ADMIN_DENIED;
  const guard = await requirePersonOnboardingAccess(organisationId);
  if (!guard.ok) return ADMIN_DENIED;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const role = await getOrganisationRoleGroup(admin, organisationId);
  if (!role.ok) {
    return { success: false, error: "Set one company role before inviting people", code: role.code };
  }
  return {
    success: true,
    data: {
      mode: guard.mode === "admin" ? "admin" : "scoped",
      orgName: guard.target.name,
      groups: [],
      forcedGroupId: role.group.id,
      forcedGroupName: role.group.name,
    },
  };
}

export async function searchAddablePeople(
  organisationId: string,
  query: string,
): Promise<ActionResult<AddablePerson[]>> {
  if (!isValidUUID(organisationId)) return ADMIN_DENIED;
  const guard = await requirePersonOnboardingAccess(organisationId);
  if (!guard.ok) return ADMIN_DENIED;
  const q = query.replace(/[,()*\\]/g, " ").trim();
  if (q.length < 2) return { success: true, data: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: memberships, error: membershipError } = await admin.from("organization_memberships")
    .select("user_id, is_active")
    .eq("organization_id", organisationId);
  if (membershipError) return { success: false, error: "Failed to search people", code: "FETCH_FAILED" };
  const membershipByUser = new Map(
    ((memberships ?? []) as Array<{ user_id: string; is_active: boolean }>).map((m) => [m.user_id, m.is_active]),
  );
  const ids = Array.from(membershipByUser.keys());
  if (ids.length === 0) return { success: true, data: [] };

  const { data: users, error } = await admin.from("portal_users")
    .select("id, email, name, status, is_active")
    .in("id", ids)
    .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
    .order("name")
    .limit(20);
  if (error) return { success: false, error: "Failed to search people", code: "FETCH_FAILED" };
  return {
    success: true,
    data: ((users ?? []) as Array<{
      id: string;
      email: string;
      name: string;
      status: "created" | "invited" | "active";
      is_active: boolean;
    }>).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      status: u.status,
      isActive: u.is_active === true,
      membershipActive: membershipByUser.get(u.id) === true,
      alreadyMember: u.is_active === true && membershipByUser.get(u.id) === true,
    })),
  };
}
