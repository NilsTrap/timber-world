"use server";

import { createAdminClient } from "@timber/database/admin";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

export async function deleteCompetitorPrice(id: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }
  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("competitor_prices" as never)
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete competitor price:", error);
    return { success: false, error: "Failed to delete row", code: "DELETE_FAILED" };
  }

  return { success: true, data: null };
}
