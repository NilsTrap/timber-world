"use server";

import { createCrmClient } from "../lib/supabase";
import type { CrmContact, CrmCompany } from "../types";

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
