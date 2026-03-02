"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/auth";
import type { ScraperConfigDb, ScraperConfig, ActionResult } from "../types";
import { toScraperConfig } from "../types";

/**
 * Get scraper configuration for a specific source
 */
export async function getScraperConfig(
  source: string
): Promise<ActionResult<ScraperConfig>> {
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: "Not authenticated",
      code: "UNAUTHENTICATED",
    };
  }

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
    .from("scraper_config")
    .select("*")
    .eq("source", source)
    .single();

  if (error) {
    console.error("Failed to fetch scraper config:", error);
    return {
      success: false,
      error: "Failed to fetch scraper configuration",
      code: "FETCH_FAILED",
    };
  }

  return {
    success: true,
    data: toScraperConfig(data as ScraperConfigDb),
  };
}
