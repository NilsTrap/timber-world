"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { MarketingMedia, ActionResult } from "../types";

interface UpdateMarketingMediaInput {
  altText?: string;
  isActive?: boolean;
}

/**
 * Update Marketing Media Metadata
 *
 * Updates metadata (alt text, active status) for a media item.
 * Admin only endpoint.
 */
export async function updateMarketingMedia(
  slotKey: string,
  input: UpdateMarketingMediaInput
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

  const supabase = await createClient();

  // 3. Build update payload
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.altText !== undefined) {
    updatePayload.alt_text = input.altText;
  }

  if (input.isActive !== undefined) {
    updatePayload.is_active = input.isActive;
  }

  // 4. Update record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("marketing_media")
    .update(updatePayload)
    .eq("slot_key", slotKey)
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return {
        success: false,
        error: "Media not found",
        code: "NOT_FOUND",
      };
    }
    console.error("Failed to update marketing media:", error);
    return {
      success: false,
      error: "Failed to update media",
      code: "UPDATE_FAILED",
    };
  }

  // 5. Generate public URL
  const { data: urlData } = supabase.storage
    .from("marketing")
    .getPublicUrl(data.storage_path);

  return {
    success: true,
    data: {
      id: data.id,
      category: data.category,
      slotKey: data.slot_key,
      fileName: data.file_name,
      storagePath: data.storage_path,
      mimeType: data.mime_type,
      fileSizeBytes: data.file_size_bytes,
      width: data.width,
      height: data.height,
      altText: data.alt_text,
      sortOrder: data.sort_order,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      publicUrl: urlData?.publicUrl,
    },
  };
}
