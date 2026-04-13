"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { OrderFile, OrderFileCategory, ActionResult } from "../types";

/**
 * Get Order Files
 *
 * Fetches all files for an order, optionally filtered by category.
 */
export async function getOrderFiles(
  orderId: string,
  category?: OrderFileCategory
): Promise<ActionResult<OrderFile[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("order_files")
    .select("id, order_id, category, file_name, mime_type, file_size_bytes, uploaded_by, is_thumbnail, created_at, portal_users(name)")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch order files:", error);
    return { success: false, error: "Failed to fetch files", code: "FETCH_FAILED" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const files: OrderFile[] = ((data ?? []) as any[]).map((row: any) => ({
    id: row.id,
    orderId: row.order_id,
    category: row.category,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    uploadedByName: row.portal_users?.name ?? null,
    isThumbnail: row.is_thumbnail ?? false,
    createdAt: row.created_at,
  }));

  return { success: true, data: files };
}
