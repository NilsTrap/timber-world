"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "../types";
import { isValidUUID } from "../types";
import { listPeopleWithMemberships, type OnboardingMembership } from "../services/personOnboarding";
import { ADMIN_DENIED, requirePlatformAdmin } from "./_platformAdmin";

export type PersonMembership = OnboardingMembership;

export async function getPersonMemberships(personId: string): Promise<ActionResult<PersonMembership[]>> {
  const guard = await requirePlatformAdmin();
  if (!guard.ok || !isValidUUID(personId)) return ADMIN_DENIED;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  try {
    const person = (await listPeopleWithMemberships(admin)).find((p) => p.id === personId);
    return person ? { success: true, data: person.memberships } : ADMIN_DENIED;
  } catch {
    return { success: false, error: "Failed to load memberships", code: "FETCH_FAILED" };
  }
}

export interface AddableOrg { id: string; name: string; code: string }

export async function getAddableOrganisationsForPerson(personId: string): Promise<ActionResult<AddableOrg[]>> {
  const guard = await requirePlatformAdmin();
  if (!guard.ok || !isValidUUID(personId)) return ADMIN_DENIED;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const [{ data: memberships }, { data: orgs, error }] = await Promise.all([
    admin.from("organization_memberships").select("organization_id, is_active").eq("user_id", personId),
    admin.from("organisations").select("id, name, code").eq("is_active", true).order("name"),
  ]);
  if (error) return { success: false, error: "Failed to load organisations", code: "FETCH_FAILED" };
  const active = new Set(((memberships ?? []) as Array<{ organization_id: string; is_active: boolean }>).filter((m) => m.is_active).map((m) => m.organization_id));
  return { success: true, data: ((orgs ?? []) as AddableOrg[]).filter((o) => !active.has(o.id)) };
}
