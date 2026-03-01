"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  type MarketingMedia,
  type ActionResult,
} from "../types";

/**
 * Upload Marketing Media
 *
 * Uploads a file to Supabase Storage and updates the marketing_media record.
 * Admin only endpoint.
 */
export async function uploadMarketingMedia(
  slotKey: string,
  formData: FormData
): Promise<ActionResult<MarketingMedia>> {
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

  // 3. Get file from form data
  const file = formData.get("file") as File | null;
  const altText = formData.get("altText") as string | null;

  if (!file) {
    return {
      success: false,
      error: "No file provided",
      code: "NO_FILE",
    };
  }

  // 4. Validate file type
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

  if (!isImage && !isVideo) {
    return {
      success: false,
      error: `Invalid file type: ${file.type}. Allowed: ${[...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].join(", ")}`,
      code: "INVALID_TYPE",
    };
  }

  // 5. Validate file size
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (file.size > maxSize) {
    const maxMB = maxSize / (1024 * 1024);
    return {
      success: false,
      error: `File too large. Maximum size: ${maxMB}MB`,
      code: "FILE_TOO_LARGE",
    };
  }

  const supabase = await createClient();

  // 6. Get existing media record to find category
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchError } = await (supabase as any)
    .from("marketing_media")
    .select("*")
    .eq("slot_key", slotKey)
    .single();

  if (fetchError || !existing) {
    return {
      success: false,
      error: "Media slot not found",
      code: "SLOT_NOT_FOUND",
    };
  }

  // 7. Build storage path
  const fileExt = file.name.split(".").pop() || "jpg";
  const fileName = `${slotKey}.${fileExt}`;
  const storagePath = `${existing.category}/${slotKey}/${fileName}`;

  // 8. Delete old file if exists (ignore errors)
  await supabase.storage
    .from("marketing")
    .remove([existing.storage_path]);

  // 9. Upload new file
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("marketing")
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("Failed to upload file:", uploadError);
    return {
      success: false,
      error: "Failed to upload file",
      code: "UPLOAD_FAILED",
    };
  }

  // 10. Update database record
  const updatePayload: Record<string, unknown> = {
    file_name: fileName,
    storage_path: storagePath,
    mime_type: file.type,
    file_size_bytes: file.size,
    updated_at: new Date().toISOString(),
  };

  if (altText !== null) {
    updatePayload.alt_text = altText;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: updateError } = await (supabase as any)
    .from("marketing_media")
    .update(updatePayload)
    .eq("slot_key", slotKey)
    .select("*")
    .single();

  if (updateError) {
    console.error("Failed to update media record:", updateError);
    return {
      success: false,
      error: "Failed to update record",
      code: "UPDATE_FAILED",
    };
  }

  // 11. Generate public URL
  const { data: urlData } = supabase.storage
    .from("marketing")
    .getPublicUrl(storagePath);

  return {
    success: true,
    data: {
      id: updated.id,
      category: updated.category,
      slotKey: updated.slot_key,
      fileName: updated.file_name,
      storagePath: updated.storage_path,
      mimeType: updated.mime_type,
      fileSizeBytes: updated.file_size_bytes,
      width: updated.width,
      height: updated.height,
      altText: updated.alt_text,
      sortOrder: updated.sort_order,
      isActive: updated.is_active,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
      publicUrl: urlData?.publicUrl,
    },
  };
}
