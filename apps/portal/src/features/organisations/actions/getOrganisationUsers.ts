"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrganisationUser, ActionResult } from "../types";
import { isValidUUID } from "../types";
import { listPeopleWithMemberships } from "../services/personOnboarding";
import { ADMIN_DENIED, requirePlatformAdmin } from "./_platformAdmin";

export async function getOrganisationUsers(
  organisationId: string,
  options?: { includeInactive?: boolean },
): Promise<ActionResult<OrganisationUser[]>> {
  const guard = await requirePlatformAdmin();
  if (!guard.ok || !isValidUUID(organisationId)) return ADMIN_DENIED;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  try {
    const people = await listPeopleWithMemberships(admin);
    const users: OrganisationUser[] = [];
    for (const person of people) {
      const membership = person.memberships.find((m) => m.orgId === organisationId);
      if (!membership || (options?.includeInactive === false && (!person.isActive || !membership.isActive))) continue;
      users.push({
        id: person.id,
        email: person.email,
        name: person.name,
        role: person.role,
        organisationId,
        authUserId: person.authUserId,
        isActive: person.isActive,
        status: person.status,
        invitedAt: person.invitedAt,
        invitedBy: person.invitedBy,
        invitedByName: null,
        lastLoginAt: person.lastLoginAt,
        createdAt: person.createdAt,
        updatedAt: person.updatedAt,
        membershipActive: membership.isActive,
        isPrimaryMembership: membership.isPrimary,
        personas: membership.personas,
        effectiveModules: membership.effectiveModules,
      });
    }
    return { success: true, data: users.sort((a, b) => a.name.localeCompare(b.name)) };
  } catch {
    return { success: false, error: "Failed to fetch users", code: "FETCH_FAILED" };
  }
}
