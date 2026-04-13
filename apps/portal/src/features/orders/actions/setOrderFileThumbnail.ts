"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { ActionResult } from "../types";
import { logOrderActivity } from "./logOrderActivity";

/**
 * Set (or clear) which file is the thumbnail for an order.
 * Clears any existing thumbnail on the same order first.
 */
export async function setOrderFileThumbnail(
  fileId: string,
  isThumbnail: boolean
): Promise<ActionResult<null>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const supabase = await createClient();

  // Look up the order_id and category for this file
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: file, error: fetchError } = await (supabase as any)
    .from("order_files")
    .select("order_id, category")
    .eq("id", fileId)
    .single();

  if (fetchError || !file) {
    return { success: false, error: "File not found" };
  }

  // Clear thumbnails only within the same category (customer or production)
  // so each category can have its own thumbnail
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("order_files")
    .update({ is_thumbnail: false })
    .eq("order_id", file.order_id)
    .eq("category", file.category)
    .eq("is_thumbnail", true);

  // Set the new thumbnail if requested
  if (isThumbnail) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from("order_files")
      .update({ is_thumbnail: true })
      .eq("id", fileId);

    if (updateError) {
      return { success: false, error: "Failed to set thumbnail" };
    }
  }

  await logOrderActivity(file.order_id, session.portalUserId, "thumbnail_changed", isThumbnail ? "Thumbnail set" : "Thumbnail removed", "list");

  return { success: true, data: null };
}
