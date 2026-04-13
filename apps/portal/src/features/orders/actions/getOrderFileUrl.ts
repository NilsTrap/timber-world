"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../types";

/**
 * Get Order File URL
 *
 * Generates a signed URL for downloading a file from the private orders bucket.
 * URL is valid for 5 minutes.
 */
export async function getOrderFileUrl(fileId: string): Promise<ActionResult<string>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const supabase = await createClient();

  // Fetch the file record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: file, error: fetchError } = await (supabase as any)
    .from("order_files")
    .select("storage_path")
    .eq("id", fileId)
    .single();

  if (fetchError || !file) {
    return { success: false, error: "File not found", code: "NOT_FOUND" };
  }

  // Generate signed URL (300 seconds = 5 minutes)
  const { data: signedData, error: signError } = await supabase.storage
    .from("orders")
    .createSignedUrl(file.storage_path, 300);

  if (signError || !signedData?.signedUrl) {
    console.error("Failed to create signed URL:", signError);
    return { success: false, error: "Failed to generate download URL", code: "SIGNED_URL_FAILED" };
  }

  return { success: true, data: signedData.signedUrl };
}
