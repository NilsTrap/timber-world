"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import {
  VALID_REFERENCE_TABLES,
  type ReferenceTableName,
  type ReferenceOption,
  type ActionResult,
} from "../types";

/**
 * Get Reference Options
 *
 * Fetches options for a reference table, sorted by sort_order.
 * Admin only endpoint.
 *
 * @param tableName - The reference table to fetch from
 * @param options.includeInactive - If true, includes inactive options (for admin view). Default: false
 */
export async function getReferenceOptions(
  tableName: ReferenceTableName,
  options?: { includeInactive?: boolean }
): Promise<ActionResult<ReferenceOption[]>> {
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

  // 3. Validate table name (prevent SQL injection)
  if (!VALID_REFERENCE_TABLES.includes(tableName)) {
    return {
      success: false,
      error: "Invalid table name",
      code: "INVALID_TABLE",
    };
  }

  const supabase = await createClient();

  // 4. Fetch options sorted by sort_order
  const isProcesses = tableName === "ref_processes";
  const selectColumns = isProcesses
    ? "id, value, code, work_unit, work_formula, price, sort_order, is_active, created_at, updated_at"
    : "id, value, sort_order, is_active, created_at, updated_at";

  // Note: Using type assertion because reference tables aren't in generated Supabase types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from(tableName)
    .select(selectColumns);

  // Filter to active-only unless includeInactive is true (for admin management view)
  if (!options?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query.order("sort_order", { ascending: true });

  if (error) {
    console.error(`Failed to fetch ${tableName}:`, error);
    return {
      success: false,
      error: "Failed to fetch reference options",
      code: "FETCH_FAILED",
    };
  }

  // 5. Transform snake_case to camelCase
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const referenceOptions: ReferenceOption[] = (data || []).map((row: any) => ({
    id: row.id as string,
    value: row.value as string,
    ...(isProcesses && row.code ? { code: row.code as string } : {}),
    ...(isProcesses && row.work_unit ? { workUnit: row.work_unit as string } : {}),
    ...(isProcesses && row.work_formula ? { workFormula: row.work_formula } : {}),
    ...(isProcesses ? { price: row.price != null ? Number(row.price) : null } : {}),
    sortOrder: row.sort_order as number,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));

  return {
    success: true,
    data: referenceOptions,
  };
}
