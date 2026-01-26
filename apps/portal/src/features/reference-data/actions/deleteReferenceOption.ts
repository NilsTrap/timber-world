"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import {
  VALID_REFERENCE_TABLES,
  isValidUUID,
  type ReferenceTableName,
  type ActionResult,
} from "../types";

/**
 * Delete Reference Option
 *
 * Permanently deletes a reference option from the database.
 * Super Admin only endpoint.
 */
export async function deleteReferenceOption(
  tableName: ReferenceTableName,
  id: string
): Promise<ActionResult<null>> {
  // 1. Check authentication
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

  // 2. Only Super Admin can delete reference options
  if (!isSuperAdmin(session)) {
    return {
      success: false,
      error: "Permission denied. Only Super Admin can delete reference options.",
      code: "FORBIDDEN",
    };
  }

  // 3. Validate table name
  if (!VALID_REFERENCE_TABLES.includes(tableName)) {
    return {
      success: false,
      error: "Invalid table name",
      code: "INVALID_TABLE",
    };
  }

  // 4. Validate UUID format
  if (!isValidUUID(id)) {
    return {
      success: false,
      error: "Invalid option ID",
      code: "INVALID_ID",
    };
  }

  const supabase = await createClient();

  // 5. Check if option exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchError } = await (supabase as any)
    .from(tableName)
    .select("id")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return {
      success: false,
      error: "Option not found",
      code: "NOT_FOUND",
    };
  }

  // 6. Delete the option
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any)
    .from(tableName)
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error(`Failed to delete option from ${tableName}:`, deleteError);
    return {
      success: false,
      error: "Failed to delete option",
      code: "DELETE_FAILED",
    };
  }

  return {
    success: true,
    data: null,
  };
}
