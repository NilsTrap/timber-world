"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { CrmCompanyType } from "../types";

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Get all CRM company types
 */
export async function getCompanyTypes(): Promise<ActionResult<CrmCompanyType[]>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client
    .from("crm_company_types")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to fetch company types:", error);
    return { success: false, error: "Failed to fetch company types" };
  }

  return { success: true, data: data as CrmCompanyType[] };
}

/**
 * Create a new company type
 */
export async function createCompanyType(name: string): Promise<ActionResult<CrmCompanyType>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { success: false, error: "Company type name is required" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client
    .from("crm_company_types")
    .insert({ name: trimmedName })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Company type already exists" };
    }
    console.error("Failed to create company type:", error);
    return { success: false, error: "Failed to create company type" };
  }

  revalidatePath("/admin/crm");
  return { success: true, data: data as CrmCompanyType };
}

/**
 * Delete a company type
 */
export async function deleteCompanyType(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { error } = await client
    .from("crm_company_types")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete company type:", error);
    return { success: false, error: "Failed to delete company type" };
  }

  revalidatePath("/admin/crm");
  return { success: true };
}

/**
 * Get types for a specific company
 */
export async function getCompanyCompanyTypes(companyId: string): Promise<ActionResult<CrmCompanyType[]>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client
    .from("crm_company_type_assignments")
    .select("type_id, crm_company_types(id, name, created_at)")
    .eq("company_id", companyId);

  if (error) {
    console.error("Failed to fetch company types:", error);
    return { success: false, error: "Failed to fetch company types" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const types = (data || []).map((row: any) => row.crm_company_types as CrmCompanyType);
  return { success: true, data: types };
}

/**
 * Add a type to a company
 */
export async function addTypeToCompany(
  companyId: string,
  typeId: string
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { error } = await client
    .from("crm_company_type_assignments")
    .insert({ company_id: companyId, type_id: typeId });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Type already assigned" };
    }
    console.error("Failed to add type to company:", error);
    return { success: false, error: "Failed to add type" };
  }

  revalidatePath(`/admin/crm/${companyId}`);
  return { success: true };
}

/**
 * Remove a type from a company
 */
export async function removeTypeFromCompany(
  companyId: string,
  typeId: string
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { error } = await client
    .from("crm_company_type_assignments")
    .delete()
    .eq("company_id", companyId)
    .eq("type_id", typeId);

  if (error) {
    console.error("Failed to remove type from company:", error);
    return { success: false, error: "Failed to remove type" };
  }

  revalidatePath(`/admin/crm/${companyId}`);
  return { success: true };
}
