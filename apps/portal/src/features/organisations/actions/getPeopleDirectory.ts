"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "../types";
import { listPeopleWithMemberships, type OrganisationPersona } from "../services/personOnboarding";
import { ADMIN_DENIED, requirePlatformAdmin } from "./_platformAdmin";

export interface PersonOrgRef {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  isPrimary: boolean;
  personas: OrganisationPersona[];
  effectiveModules: string[];
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
  primaryOrgId: string | null;
  orgs: PersonOrgRef[];
  groups: PersonGroupRef[];
  isCurrentUser: boolean;
}

/** One row per login person, with active and inactive memberships. */
export async function getPeopleDirectory(): Promise<ActionResult<DirectoryPerson[]>> {
  const guard = await requirePlatformAdmin();
  if (!guard.ok) return ADMIN_DENIED;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  try {
    const people = await listPeopleWithMemberships(admin);
    return {
      success: true,
      data: people.map((p) => ({
        ...p,
        isCurrentUser: p.id === guard.session.portalUserId,
        orgs: p.memberships.map((m) => ({
          id: m.orgId,
          name: m.orgName,
          code: m.orgCode,
          isActive: m.isActive,
          isPrimary: m.isPrimary,
          personas: m.personas,
          effectiveModules: m.effectiveModules,
        })),
        groups: p.memberships.flatMap((m) => m.groups.map((g) => ({ orgId: m.orgId, ...g }))),
      })),
    };
  } catch {
    return { success: false, error: "Failed to load people", code: "FETCH_FAILED" };
  }
}
