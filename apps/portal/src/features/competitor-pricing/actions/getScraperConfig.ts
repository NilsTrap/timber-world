"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@timber/database/admin";
import { getSession, isAdmin } from "@/lib/auth";
import type { ScraperConfigDb, ScraperConfig, ActionResult } from "../types";
import { toScraperConfig } from "../types";

/**
 * Get scraper configuration for a specific source.
 * Auto-creates a default config row if none exists.
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
  let { data, error } = await (supabase as any)
    .from("scraper_config")
    .select("*")
    .eq("source", source)
    .single();

  // Auto-create config row for new sources
  if (error && error.code === "PGRST116") {
    const admin = createAdminClient();
    const { data: newRow, error: insertError } = await admin
      .from("scraper_config" as never)
      .insert({
        source,
        is_enabled: true,
        species: [],
        thicknesses: [],
        widths: [],
        lengths: [],
        panel_types: [],
        qualities: [],
      } as never)
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create scraper config:", insertError);
      return {
        success: false,
        error: "Failed to create scraper configuration",
        code: "INSERT_FAILED",
      };
    }

    data = newRow;
    error = null;
  }

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
