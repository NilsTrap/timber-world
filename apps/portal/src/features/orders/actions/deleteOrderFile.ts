"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../types";
import { logOrderActivity } from "./logOrderActivity";

/**
 * Delete Order File
 *
 * Removes a file from storage and deletes the order_files record.
 */
export async function deleteOrderFile(fileId: string): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const supabase = await createClient();

  // Fetch the file record to get the storage path
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: file, error: fetchError } = await (supabase as any)
    .from("order_files")
    .select("id, order_id, file_name, category, storage_path")
    .eq("id", fileId)
    .single();

  if (fetchError || !file) {
    return { success: false, error: "File not found", code: "NOT_FOUND" };
  }

  // Delete from storage
  await supabase.storage.from("orders").remove([file.storage_path]);

  // Delete DB record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabase as any)
    .from("order_files")
    .delete()
    .eq("id", fileId);

  if (deleteError) {
    console.error("Failed to delete order file record:", deleteError);
    return { success: false, error: "Failed to delete file", code: "DELETE_FAILED" };
  }

  const fileTab = file.category === "customer" ? "list" : "production";
  await logOrderActivity(file.order_id, session.portalUserId, "file_deleted", `Deleted ${file.category} file: ${file.file_name}`, fileTab);

  return { success: true, data: null };
}
