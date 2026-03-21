"use server";

import { createCrmClient } from "../lib/supabase";
import type { CrmCompany, CrmContact, CrmKeyword, CrmIndustry, CrmCompanyType } from "../types";

export type CompanyWithKeywords = CrmCompany & {
  keywords: CrmKeyword[];
  industries: CrmIndustry[];
  companyTypes: CrmCompanyType[];
};

type GetCompaniesResult =
  | { success: true; data: CompanyWithKeywords[] }
  | { success: false; error: string };

/**
 * Get all CRM companies with contact counts and keywords
 */
export async function getCompanies(): Promise<GetCompaniesResult> {
  const supabase = await createCrmClient();

  const { data, error } = await supabase
    .from("crm_companies")
    .select(`
      *,
      contacts_count:crm_contacts(count),
      crm_company_keywords(
        crm_keywords(id, name, created_at)
      ),
      crm_company_industries(
        crm_industries(id, name, created_at)
      ),
      crm_company_type_assignments(
        crm_company_types(id, name, created_at)
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching companies:", error);
    return { success: false, error: error.message };
  }

  // Transform the data
  const companies = (data || []).map((company: Record<string, unknown>) => {
    // Extract keywords from the nested structure
    const companyKeywords = company.crm_company_keywords as Array<{ crm_keywords: CrmKeyword }> | null;
    const keywords = companyKeywords?.map((ck) => ck.crm_keywords).filter(Boolean) || [];

    // Extract industries from the nested structure
    const companyIndustries = company.crm_company_industries as Array<{ crm_industries: CrmIndustry }> | null;
    const industries = companyIndustries?.map((ci) => ci.crm_industries).filter(Boolean) || [];

    // Extract company types from the nested structure
    const companyTypeAssignments = company.crm_company_type_assignments as Array<{ crm_company_types: CrmCompanyType }> | null;
    const companyTypes = companyTypeAssignments?.map((ct) => ct.crm_company_types).filter(Boolean) || [];

    return {
      ...company,
      contacts_count: (company.contacts_count as { count: number }[])?.[0]?.count || 0,
      keywords,
      industries,
      companyTypes,
      crm_company_keywords: undefined,
      crm_company_industries: undefined,
      crm_company_type_assignments: undefined,
    };
  }) as CompanyWithKeywords[];

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
