"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { MarketingText, ActionResult } from "../types";

/**
 * Update Marketing Text
 *
 * Updates the value of a marketing text by section and key.
 * Admin only endpoint.
 */
export async function updateMarketingText(
  category: string,
  section: string,
  key: string,
  value: string,
  locale: string = "en"
): Promise<ActionResult<MarketingText>> {
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

  // 3. Update or insert text
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("marketing_texts")
    .upsert(
      {
        category,
        section,
        key,
        locale,
        value,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "category,section,key,locale",
      }
    )
    .select("*")
    .single();

  if (error) {
    console.error("Failed to update marketing text:", error);
    return {
      success: false,
      error: "Failed to update text",
      code: "UPDATE_FAILED",
    };
  }

  return {
    success: true,
    data: {
      id: data.id,
      category: data.category,
      section: data.section,
      key: data.key,
      locale: data.locale,
      value: data.value,
      sortOrder: data.sort_order,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  };
}
