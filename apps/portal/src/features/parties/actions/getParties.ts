"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { Party, ActionResult } from "../types";

/**
 * Get Parties
 *
 * Fetches all parties, sorted by code.
 * Admin only endpoint.
 *
 * @param options.includeInactive - If true, includes inactive parties (for admin view). Default: false
 */
export async function getParties(
  options?: { includeInactive?: boolean }
): Promise<ActionResult<Party[]>> {
  // 1. Check authentication
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  // 2. Check admin role
  if (!isAdmin(session)) {
    return {
      success: false,
      error: "Permission denied",
      code: "FORBIDDEN",
    };
  }

  const supabase = await createClient();

  // 3. Fetch parties
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("parties")
    .select("id, code, name, is_active, created_at, updated_at");

  // Filter to active-only unless includeInactive is true
  if (!options?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query.order("code", { ascending: true });

  if (error) {
    console.error("Failed to fetch parties:", error);
    return {
      success: false,
      error: "Failed to fetch parties",
      code: "FETCH_FAILED",
    };
  }

  // 4. Transform snake_case to camelCase
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parties: Party[] = (data || []).map((row: any) => ({
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));

  return {
    success: true,
    data: parties,
  };
}
