"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { OrderFile, OrderFileCategory, ActionResult } from "../types";
import { logOrderActivity } from "./logOrderActivity";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

/**
 * Upload Order File
 *
 * Uploads a file to Supabase Storage and creates an order_files record.
 */
export async function uploadOrderFile(
  orderId: string,
  category: OrderFileCategory,
  formData: FormData
): Promise<ActionResult<OrderFile>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return { success: false, error: "No file provided", code: "NO_FILE" };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: "File too large. Maximum size: 25MB", code: "FILE_TOO_LARGE" };
  }

  if (category !== "customer" && category !== "production") {
    return { success: false, error: "Invalid category", code: "INVALID_CATEGORY" };
  }

  const supabase = await createClient();

  // Build unique storage path
  const uniqueId = crypto.randomUUID();
  const storagePath = `${orderId}/${category}/${uniqueId}_${file.name}`;

  // Upload to storage
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("orders")
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
    });

  if (uploadError) {
    console.error("Failed to upload order file:", uploadError);
    return { success: false, error: "Failed to upload file", code: "UPLOAD_FAILED" };
  }

  // Insert DB record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error: insertError } = await (supabase as any)
    .from("order_files")
    .insert({
      order_id: orderId,
      category,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      file_size_bytes: file.size,
      uploaded_by: session.portalUserId ?? null,
    })
    .select("id, order_id, category, file_name, mime_type, file_size_bytes, created_at")
    .single();

  if (insertError) {
    console.error("Failed to insert order file record:", insertError);
    // Clean up uploaded file
    await supabase.storage.from("orders").remove([storagePath]);
    return { success: false, error: "Failed to save file record", code: "INSERT_FAILED" };
  }

  const fileTab = category === "customer" ? "list" : "production";
  await logOrderActivity(orderId, session.portalUserId, "file_uploaded", `Uploaded ${category} file: ${row.file_name}`, fileTab);

  return {
    success: true,
    data: {
      id: row.id,
      orderId: row.order_id,
      category: row.category,
      fileName: row.file_name,
      mimeType: row.mime_type,
      fileSizeBytes: row.file_size_bytes,
      uploadedByName: session.name ?? null,
      isThumbnail: false,
      createdAt: row.created_at,
    },
  };
}
