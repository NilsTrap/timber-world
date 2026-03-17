"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";

export interface MarketingSource {
  id: string;
  code: string;
  name: string;
  is_external: boolean;
  marketing_enabled: boolean;
  package_count: number;
}

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Get all active organisations with their marketing_enabled status and inventory count
 */
export async function getMarketingSources(): Promise<ActionResult<MarketingSource[]>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Permission denied" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any;

  const { data: orgs, error: orgsError } = await supabase
    .from("organisations")
    .select("id, code, name, is_external, marketing_enabled")
    .eq("is_active", true)
    .order("code");

  if (orgsError) {
    return { success: false, error: orgsError.message };
  }

  // Count available packages per org
  const { data: counts, error: countError } = await supabase
    .from("inventory_packages")
    .select("organisation_id")
    .eq("status", "available");

  if (countError) {
    return { success: false, error: countError.message };
  }

  const countMap: Record<string, number> = {};
  for (const row of (counts || []) as { organisation_id: string }[]) {
    countMap[row.organisation_id] = (countMap[row.organisation_id] || 0) + 1;
  }

  const sources: MarketingSource[] = ((orgs || []) as any[]).map((org) => ({
    id: org.id,
    code: org.code,
    name: org.name,
    is_external: org.is_external ?? false,
    marketing_enabled: org.marketing_enabled ?? false,
    package_count: countMap[org.id] || 0,
  }));

  return { success: true, data: sources };
}

/**
 * Toggle marketing_enabled for an organisation
 */
export async function toggleMarketingSource(
  orgId: string,
  enabled: boolean
): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session || !isAdmin(session)) {
    return { success: false, error: "Permission denied" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any;

  const { error } = await supabase
    .from("organisations")
    .update({ marketing_enabled: enabled })
    .eq("id", orgId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/marketing-stock");

  return { success: true, data: null };
}
