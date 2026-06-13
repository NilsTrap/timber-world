"use server";

import { createCrmClient } from "../lib/supabase";
import { getSession, isAdmin, getUserEnabledModules } from "@/lib/auth";
import type { CrmContact, CrmCompany } from "../types";

/**
 * Two-layer CRM permission gate (org ∩ user must have `crm.view`).
 * Admins bypass. Returns an error message string when denied, otherwise null.
 */
async function assertCrmAccess(): Promise<string | null> {
  const session = await getSession();
  if (!session) return "Unauthorized";
  if (!isAdmin(session)) {
    const orgId = session.currentOrganizationId || session.organisationId;
    const mods = await getUserEnabledModules(session.portalUserId ?? "", orgId);
    if (!mods.has("crm.view")) return "Permission denied";
  }
  return null;
}

type ContactWithCompany = CrmContact & {
  company: Pick<CrmCompany, "id" | "name" | "country"> | null;
};

type GetAllContactsResult =
  | { success: true; data: ContactWithCompany[] }
  | { success: false; error: string };

/**
 * Get all contacts across all companies
 */
export async function getAllContacts(): Promise<GetAllContactsResult> {
  const denied = await assertCrmAccess();
  if (denied) return { success: false, error: denied };

  const supabase = await createCrmClient();

  const { data, error } = await supabase
    .from("crm_contacts")
    .select(`
      *,
      company:crm_companies(id, name, country)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching contacts:", error);
    return { success: false, error: error.message };
  }

  return { success: true, data: data as ContactWithCompany[] };
}
