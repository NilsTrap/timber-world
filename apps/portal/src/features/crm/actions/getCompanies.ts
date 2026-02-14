"use server";

import { createCrmClient } from "../lib/supabase";
import type { CrmCompany, CrmContact } from "../types";

type GetCompaniesResult =
  | { success: true; data: CrmCompany[] }
  | { success: false; error: string };

/**
 * Get all CRM companies with contact counts
 */
export async function getCompanies(): Promise<GetCompaniesResult> {
  const supabase = await createCrmClient();

  const { data, error } = await supabase
    .from("crm_companies")
    .select(`
      *,
      contacts_count:crm_contacts(count)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching companies:", error);
    return { success: false, error: error.message };
  }

  // Transform the count from array to number
  const companies = (data || []).map((company: Record<string, unknown>) => ({
    ...company,
    contacts_count: (company.contacts_count as { count: number }[])?.[0]?.count || 0,
  })) as CrmCompany[];

  return { success: true, data: companies };
}

/**
 * Get a single company by ID with its contacts
 */
export async function getCompanyById(id: string): Promise<{
  success: true;
  data: CrmCompany & { contacts: CrmContact[] };
} | {
  success: false;
  error: string;
}> {
  const supabase = await createCrmClient();

  const { data: company, error: companyError } = await supabase
    .from("crm_companies")
    .select("*")
    .eq("id", id)
    .single();

  if (companyError) {
    console.error("Error fetching company:", companyError);
    return { success: false, error: companyError.message };
  }

  const { data: contacts, error: contactsError } = await supabase
    .from("crm_contacts")
    .select("*")
    .eq("company_id", id)
    .order("created_at", { ascending: false });

  if (contactsError) {
    console.error("Error fetching contacts:", contactsError);
    return { success: false, error: contactsError.message };
  }

  return {
    success: true,
    data: {
      ...(company as CrmCompany),
      contacts: (contacts || []) as CrmContact[],
    },
  };
}
