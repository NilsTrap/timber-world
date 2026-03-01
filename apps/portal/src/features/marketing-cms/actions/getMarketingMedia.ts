"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { MarketingMedia, MediaCategory, ActionResult } from "../types";

/**
 * Database row shape (snake_case)
 */
interface MarketingMediaRow {
  id: string;
  category: string;
  slot_key: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Transform database row to frontend type
 */
function transformRow(row: MarketingMediaRow, publicUrl?: string): MarketingMedia {
  return {
    id: row.id,
    category: row.category as MediaCategory,
    slotKey: row.slot_key,
    fileName: row.file_name,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    width: row.width,
    height: row.height,
    altText: row.alt_text,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publicUrl,
  };
}

/**
 * Get Marketing Media
 *
 * Fetches all marketing media optionally filtered by category.
 * Admin only endpoint.
 */
export async function getMarketingMedia(
  category?: MediaCategory
): Promise<ActionResult<MarketingMedia[]>> {
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

  // 3. Build query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("marketing_media")
    .select("*")
    .order("category")
    .order("sort_order");

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch marketing media:", error);
    return {
      success: false,
      error: "Failed to fetch media",
      code: "FETCH_FAILED",
    };
  }

  // 4. Generate public URLs for each media item (bucket is public)
  const mediaWithUrls: MarketingMedia[] = (data as MarketingMediaRow[]).map((row) => {
    // Get public URL for the file
    const { data: urlData } = supabase.storage
      .from("marketing")
      .getPublicUrl(row.storage_path);

    return transformRow(row, urlData?.publicUrl);
  });

  return {
    success: true,
    data: mediaWithUrls,
  };
}

/**
 * Get Marketing Media by Slot Key
 *
 * Fetches a single media item by its slot key.
 */
export async function getMarketingMediaBySlotKey(
  slotKey: string
): Promise<ActionResult<MarketingMedia | null>> {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("marketing_media")
    .select("*")
    .eq("slot_key", slotKey)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return { success: true, data: null };
    }
    console.error("Failed to fetch marketing media:", error);
    return {
      success: false,
      error: "Failed to fetch media",
      code: "FETCH_FAILED",
    };
  }

  // Generate public URL
  const { data: urlData } = supabase.storage
    .from("marketing")
    .getPublicUrl((data as MarketingMediaRow).storage_path);

  return {
    success: true,
    data: transformRow(data as MarketingMediaRow, urlData?.publicUrl),
  };
}
