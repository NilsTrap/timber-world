"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ActionResult } from "../types";

/**
 * Get the count of saved product URLs for a source
 */
export async function getSavedUrlCount(
  source: string
): Promise<ActionResult<number>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }
  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (supabase as any)
    .from("scraper_product_urls")
    .select("id", { count: "exact", head: true })
    .eq("source", source)
    .eq("is_active", true);

  if (error) {
    console.error("Failed to count saved URLs:", error);
    return { success: false, error: "Failed to count saved URLs", code: "FETCH_FAILED" };
  }

  return { success: true, data: count ?? 0 };
}

export interface SavedUrl {
  url: string;
  species: string | null;
  panel_type: string | null;
  thickness_mm: number | null;
  width_mm: number | null;
  length_mm: number | null;
  quality: string | null;
}

/**
 * Get the list of saved product URLs for a source
 */
export async function getSavedUrls(
  source: string
): Promise<ActionResult<SavedUrl[]>> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Not authenticated", code: "UNAUTHENTICATED" };
  }
  if (!isAdmin(session)) {
    return { success: false, error: "Permission denied", code: "FORBIDDEN" };
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("scraper_product_urls")
    .select("url, species, panel_type, thickness_mm, width_mm, length_mm, quality")
    .eq("source", source)
    .eq("is_active", true)
;

  if (error) {
    console.error("Failed to fetch saved URLs:", error);
    return { success: false, error: "Failed to fetch saved URLs", code: "FETCH_FAILED" };
  }

  // Sort client-side: species → panel_type → quality → thickness → width → length
  const sorted = (data ?? []).sort((a: SavedUrl, b: SavedUrl) => {
    return (
      (a.species ?? "").localeCompare(b.species ?? "") ||
      (a.panel_type ?? "").localeCompare(b.panel_type ?? "") ||
      (a.quality ?? "").localeCompare(b.quality ?? "") ||
      (a.thickness_mm ?? 0) - (b.thickness_mm ?? 0) ||
      (a.width_mm ?? 0) - (b.width_mm ?? 0) ||
      (a.length_mm ?? 0) - (b.length_mm ?? 0)
    );
  });

  return { success: true, data: sorted };
}
