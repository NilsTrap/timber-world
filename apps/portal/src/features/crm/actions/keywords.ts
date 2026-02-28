"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { CrmKeyword } from "../types";

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Get all CRM keywords
 */
export async function getKeywords(): Promise<ActionResult<CrmKeyword[]>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client
    .from("crm_keywords")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to fetch keywords:", error);
    return { success: false, error: "Failed to fetch keywords" };
  }

  return { success: true, data: data as CrmKeyword[] };
}

/**
 * Create a new keyword
 */
export async function createKeyword(name: string): Promise<ActionResult<CrmKeyword>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }

  const trimmedName = name.trim().toLowerCase();
  if (!trimmedName) {
    return { success: false, error: "Keyword name is required" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client
    .from("crm_keywords")
    .insert({ name: trimmedName })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Keyword already exists" };
    }
    console.error("Failed to create keyword:", error);
    return { success: false, error: "Failed to create keyword" };
  }

  revalidatePath("/admin/crm");
  return { success: true, data: data as CrmKeyword };
}

/**
 * Delete a keyword
 */
export async function deleteKeyword(id: string): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { error } = await client
    .from("crm_keywords")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete keyword:", error);
    return { success: false, error: "Failed to delete keyword" };
  }

  revalidatePath("/admin/crm");
  return { success: true };
}

/**
 * Get keywords for a specific company
 */
export async function getCompanyKeywords(companyId: string): Promise<ActionResult<CrmKeyword[]>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client
    .from("crm_company_keywords")
    .select("keyword_id, crm_keywords(id, name, created_at)")
    .eq("company_id", companyId);

  if (error) {
    console.error("Failed to fetch company keywords:", error);
    return { success: false, error: "Failed to fetch company keywords" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const keywords = (data || []).map((row: any) => row.crm_keywords as CrmKeyword);
  return { success: true, data: keywords };
}

/**
 * Add a keyword to a company
 */
export async function addKeywordToCompany(
  companyId: string,
  keywordId: string
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { error } = await client
    .from("crm_company_keywords")
    .insert({ company_id: companyId, keyword_id: keywordId });

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Keyword already assigned" };
    }
    console.error("Failed to add keyword to company:", error);
    return { success: false, error: "Failed to add keyword" };
  }

  revalidatePath(`/admin/crm/${companyId}`);
  return { success: true };
}

/**
 * Remove a keyword from a company
 */
export async function removeKeywordFromCompany(
  companyId: string,
  keywordId: string
): Promise<ActionResult<void>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { error } = await client
    .from("crm_company_keywords")
    .delete()
    .eq("company_id", companyId)
    .eq("keyword_id", keywordId);

  if (error) {
    console.error("Failed to remove keyword from company:", error);
    return { success: false, error: "Failed to remove keyword" };
  }

  revalidatePath(`/admin/crm/${companyId}`);
  return { success: true };
}
