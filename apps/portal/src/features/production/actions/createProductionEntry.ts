"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Create a new production entry with status "draft".
 * Returns the new entry's ID for redirect.
 */
export async function createProductionEntry(
  processId: string
): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  if (!processId || !UUID_REGEX.test(processId)) {
    return { success: false, error: "Valid process selection is required", code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  const { data, error } = await (supabase as any)
    .from("portal_production_entries")
    .insert({
      process_id: processId,
      production_date: new Date().toISOString().split("T")[0],
      status: "draft",
      created_by: session.id,
      organisation_id: session.organisationId,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message, code: "INSERT_FAILED" };
  }

  // Invalidate the production page cache so the new draft shows when navigating back
  revalidatePath("/production");

  return { success: true, data: { id: data.id } };
}
