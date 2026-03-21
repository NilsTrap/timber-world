"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { CrmIndustry } from "../types";

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Get all CRM industries
 */
export async function getIndustries(): Promise<ActionResult<CrmIndustry[]>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client
    .from("crm_industries")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to fetch industries:", error);
    return { success: false, error: "Failed to fetch industries" };
  }

  return { success: true, data: data as CrmIndustry[] };
}

/**
 * Create a new industry
 */
export async function createIndustry(name: string): Promise<ActionResult<CrmIndustry>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { success: false, error: "Industry name is required" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client
    .from("crm_industries")
    .insert({ name: trimmedName })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Industry already exists" };
    }
    console.error("Failed to create industry:", error);
    return { success: false, error: "Failed to create industry" };
  }

  revalidatePath("/admin/crm");
  return { success: true, data: data as CrmIndustry };
}

/**
 * Delete an industry
 */
export async function deleteIndustry(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { error } = await client
    .from("crm_industries")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete industry:", error);
    return { success: false, error: "Failed to delete industry" };
  }

  revalidatePath("/admin/crm");
  return { success: true };
}

/**
 * Get industries for a specific company
 */
export async function getCompanyIndustries(companyId: string): Promise<ActionResult<CrmIndustry[]>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client
    .from("crm_company_industries")
    .select("industry_id, crm_industries(id, name, created_at)")
    .eq("company_id", companyId);

  if (error) {
    console.error("Failed to fetch company industries:", error);
    return { success: false, error: "Failed to fetch company industries" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const industries = (data || []).map((row: any) => row.crm_industries as CrmIndustry);
  return { success: true, data: industries };
}

/**
 * Add an industry to a company
 */
export async function addIndustryToCompany(
  companyId: string,
  industryId: string
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { error } = await client
    .from("crm_company_industries")
    .insert({ company_id: companyId, industry_id: industryId });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Industry already assigned" };
    }
    console.error("Failed to add industry to company:", error);
    return { success: false, error: "Failed to add industry" };
  }

  revalidatePath(`/admin/crm/${companyId}`);
  return { success: true };
}

/**
 * Remove an industry from a company
 */
export async function removeIndustryFromCompany(
  companyId: string,
  industryId: string
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { error } = await client
    .from("crm_company_industries")
    .delete()
    .eq("company_id", companyId)
    .eq("industry_id", industryId);

  if (error) {
    console.error("Failed to remove industry from company:", error);
    return { success: false, error: "Failed to remove industry" };
  }

  revalidatePath(`/admin/crm/${companyId}`);
  return { success: true };
}
